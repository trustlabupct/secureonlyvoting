import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, DataSource, IsNull } from 'typeorm';
import { RateLimit } from './entities/rate-limit.entity';
import { RateLimitPolicy } from './entities/rate-limit-policy.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { UserSession } from './entities/user-session.entity';
import { AppMetrics } from './entities/app-metrics.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  // In-memory cache for policies (refreshed every 5 minutes)
  private policyCache = new Map<string, RateLimitPolicy>();
  private policyCacheExpiry = 0;
  private readonly POLICY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectRepository(RateLimit)
    private rateLimitRepository: Repository<RateLimit>,
    @InjectRepository(RateLimitPolicy)
    private policyRepository: Repository<RateLimitPolicy>,
    @InjectRepository(RevokedToken)
    private revokedTokenRepository: Repository<RevokedToken>,
    @InjectRepository(UserSession)
    private userSessionRepository: Repository<UserSession>,
    @InjectRepository(AppMetrics)
    private appMetricsRepository: Repository<AppMetrics>,
    private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  /**
   * TypeORM-native atomic UPSERT implementation
   * Returns true if under the limit, throws TooManyRequestsException if exceeded
   * Implements fail-closed strategy for security
   */
  async checkRateLimit(
    ipAddress: string,
    endpoint: string,
    maxAttempts: number,
    windowMs: number,
  ): Promise<boolean> {
    const start = Date.now();

    try {
      // Build and execute a single-statement UPSERT via QueryBuilder
      const result = await this.rateLimitRepository
        .createQueryBuilder()
        .insert()
        .into(RateLimit)
        .values({
          ipAddress,
          endpoint,
          attempts: 1,
          windowStart: () => 'now()',
        })
        .onConflict(
          `("ip_address", "endpoint") DO UPDATE
           SET
             attempts = CASE
               WHEN rate_limits.window_start < now() - INTERVAL '${windowMs} milliseconds'
               THEN 1
               ELSE rate_limits.attempts + 1
             END,
             window_start = CASE
               WHEN rate_limits.window_start < now() - INTERVAL '${windowMs} milliseconds'
               THEN now()
               ELSE rate_limits.window_start
             END`,
        )
        .returning(['attempts'])
        .execute();

      const attempts = result.raw[0]?.attempts ?? 0;
      const elapsed = Date.now() - start;

      // Log slow queries for monitoring
      if (elapsed > 10) {
        this.logger.warn(
          `Slow rate limit query: ${elapsed}ms on ${endpoint} for ${ipAddress}`,
        );
        await this.incrementMetric('slow_query:rate_limit');
      }

      if (attempts > maxAttempts) {
        await this.incrementMetric(`rate_limit:429:${endpoint}`);
        throw new HttpException(
          `Rate limit exceeded (${attempts}/${maxAttempts} in last ${windowMs}ms)`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error; // Re-throw rate limit exceptions
      }

      this.logger.error(
        'Rate limit check failed. Blocking request as a precaution.',
        error,
      );
      await this.incrementMetric('error:rate_limit_check');

      // Fail CLOSED on error for security
      throw new HttpException(
        'Could not process rate limit. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /**
   * Policy-driven rate limit enforcement
   * Loads policy from cache or database and enforces it
   */
  async enforcePolicy(ipAddress: string, endpoint: string): Promise<boolean> {
    try {
      const policy = await this.getRateLimitPolicy(endpoint);

      if (!policy) {
        // Fail-closed: apply strict default policy for unknown endpoints
        this.logger.warn(
          `No rate limit policy found for ${endpoint}. Applying strict default.`,
        );
        await this.incrementMetric('policy:missing');
        return this.checkRateLimit(ipAddress, endpoint, 10, 60000); // 10 requests per minute default
      }

      if (!policy.isActive) {
        // Policy exists but is disabled - allow request but log it
        this.logger.debug(`Rate limit policy disabled for ${endpoint}`);
        await this.incrementMetric('policy:disabled');
        return true;
      }

      return this.checkRateLimit(
        ipAddress,
        endpoint,
        policy.maxAttempts,
        policy.windowMs,
      );
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        throw error;
      }

      this.logger.error(
        'Policy enforcement failed. Applying strict default.',
        error,
      );
      await this.incrementMetric('error:policy_enforcement');

      // Fail-closed with strict default
      throw new ForbiddenException(
        'Security policy enforcement failed. Access denied.',
      );
    }
  }

  /**
   * Get rate limit policy with caching
   */
  private async getRateLimitPolicy(
    endpoint: string,
  ): Promise<RateLimitPolicy | null> {
    const now = Date.now();

    // Refresh cache if expired
    if (now > this.policyCacheExpiry) {
      try {
        const policies = await this.policyRepository.find({
          where: { isActive: true },
        });
        this.policyCache.clear();

        for (const policy of policies) {
          this.policyCache.set(policy.endpoint, policy);
        }

        this.policyCacheExpiry = now + this.POLICY_CACHE_TTL;
        this.logger.debug(
          `Refreshed policy cache with ${policies.length} policies`,
        );
      } catch (error) {
        this.logger.error('Failed to refresh policy cache:', error);
        // Continue with existing cache if refresh fails
      }
    }

    return this.policyCache.get(endpoint) || null;
  }

  /**
   * Refresh policy cache manually (for admin use)
   */
  async refreshPolicyCache(): Promise<{
    message: string;
    policiesLoaded: number;
  }> {
    this.policyCacheExpiry = 0; // Force refresh
    await this.getRateLimitPolicy('__force_refresh__');

    return {
      message: 'Rate limit policies refreshed successfully',
      policiesLoaded: this.policyCache.size,
    };
  }

  /**
   * Get policy cache status for monitoring
   */
  getPolicyCacheStatus(): {
    size: number;
    expiresAt: Date;
    isExpired: boolean;
  } {
    const now = Date.now();
    return {
      size: this.policyCache.size,
      expiresAt: new Date(this.policyCacheExpiry),
      isExpired: now > this.policyCacheExpiry,
    };
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      const revokedToken = await this.revokedTokenRepository.findOne({
        where: { jti },
      });
      return !!revokedToken;
    } catch (error) {
      this.logger.error('Token revocation check failed:', error);
      return false; // Fail open for authentication (different security domain)
    }
  }

  async revokeToken(
    jti: string,
    userId: string,
    expiresAt: Date,
    _tokenType: string = 'access',
  ): Promise<void> {
    try {
      await this.revokedTokenRepository.save({
        jti,
        userId,
        expiresAt,
      });
    } catch (error) {
      this.logger.error('Token revocation failed:', error);
    }
  }

  async createSession(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
    jti?: string,
  ): Promise<UserSession> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    const session = await this.userSessionRepository.save({
      userId,
      refreshTokenHash,
      jti: jti || null,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return session;
  }

  async findValidSession(refreshToken: string): Promise<UserSession | null> {
    try {
      // Try to extract jti from the refresh token for efficient lookup
      let targetSession: UserSession | null = null;

      try {
        const decoded = this.jwtService.verify(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
          ignoreExpiration: true, // We'll check expiration manually
        });

        if (decoded.tokenId) {
          // Direct lookup by jti for O(1) performance
          targetSession = await this.userSessionRepository.findOne({
            where: {
              jti: decoded.tokenId,
              isActive: true,
              expiresAt: MoreThan(new Date()),
            },
          });

          if (targetSession) {
            // Verify the token hash matches
            const isValid = await bcrypt.compare(
              refreshToken,
              targetSession.refreshTokenHash,
            );
            if (isValid) {
              return targetSession;
            }
          }
        }
      } catch (jwtError) {
        // Token might be malformed or use different secret, fall back to old method
        this.logger.debug(
          'Failed to extract jti from refresh token, falling back to full scan',
        );
      }

      // Fallback: old method for legacy sessions without jti
      const sessions = await this.userSessionRepository.find({
        where: {
          isActive: true,
          expiresAt: MoreThan(new Date()),
          jti: IsNull(), // Only check sessions that don't have jti set
        },
      });

      for (const session of sessions) {
        const isValid = await bcrypt.compare(
          refreshToken,
          session.refreshTokenHash,
        );
        if (isValid) {
          return session;
        }
      }
      return null;
    } catch (error) {
      this.logger.error('Session lookup failed:', error);
      return null;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    try {
      await this.userSessionRepository.update(sessionId, { isActive: false });
    } catch (error) {
      this.logger.error('Session revocation failed:', error);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      await this.userSessionRepository.update({ userId }, { isActive: false });
    } catch (error) {
      this.logger.error('User session revocation failed:', error);
    }
  }

  async cleanupExpiredData(): Promise<void> {
    try {
      const now = new Date();

      // Clean up expired revoked tokens
      const expiredTokensResult = await this.revokedTokenRepository.delete({
        expiresAt: LessThan(now),
      });

      // Clean up expired sessions
      const expiredSessionsResult = await this.userSessionRepository.delete({
        expiresAt: LessThan(now),
      });

      this.logger.log(
        `Daily cleanup completed: ${expiredTokensResult.affected || 0} tokens, ${expiredSessionsResult.affected || 0} sessions`,
      );
      await this.incrementMetric('cleanup:daily_runs');
    } catch (error) {
      this.logger.error('Daily cleanup failed:', error);
      await this.incrementMetric('error:daily_cleanup');
    }
  }

  async cleanupRateLimitEntries(): Promise<void> {
    try {
      // Clean up old rate limit entries (older than 1 hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await this.rateLimitRepository.delete({
        windowStart: LessThan(oneHourAgo),
      });

      this.logger.log(
        `Rate limit cleanup completed: ${result.affected || 0} entries removed`,
      );
      await this.incrementMetric('cleanup:rate_limits');
    } catch (error) {
      this.logger.error('Rate limit cleanup failed:', error);
      await this.incrementMetric('error:rate_limit_cleanup');
    }
  }

  /**
   * Increment a metric counter using atomic UPSERT
   */
  async incrementMetric(metricName: string): Promise<void> {
    try {
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(AppMetrics)
        .values({
          name: metricName,
          count: 1,
          createdAt: () => 'now()',
          lastUpdated: () => 'now()',
        })
        .onConflict(
          `("name") DO UPDATE SET "count" = app_metrics.count + 1, "last_updated" = now()`,
        )
        .execute();
    } catch (error) {
      this.logger.error(`Failed to increment metric ${metricName}:`, error);
    }
  }

  /**
   * Get current metrics for monitoring (admin only)
   */
  async getMetrics(): Promise<AppMetrics[]> {
    try {
      return await this.appMetricsRepository.find({
        order: { lastUpdated: 'DESC' },
        take: 100, // Limit to prevent excessive data transfer
      });
    } catch (error) {
      this.logger.error('Failed to fetch metrics:', error);
      return [];
    }
  }

  /**
   * Get performance statistics for database queries
   */
  async getPerformanceStats(): Promise<any[]> {
    try {
      const result = await this.dataSource.query(`
        SELECT 
          query,
          calls,
          mean_exec_time,
          max_exec_time,
          total_exec_time
        FROM pg_stat_statements
        WHERE query LIKE '%rate_limits%' 
           OR query LIKE '%rate_limit_policies%'
           OR query LIKE '%app_metrics%'
        ORDER BY mean_exec_time DESC
        LIMIT 10;
      `);

      return result || [];
    } catch (error) {
      this.logger.error('Failed to fetch performance stats:', error);
      return [];
    }
  }

  /**
   * Create or update a rate limit policy
   */
  async upsertRateLimitPolicy(
    endpoint: string,
    maxAttempts: number,
    windowMs: number,
    description?: string,
    isActive: boolean = true,
  ): Promise<RateLimitPolicy> {
    try {
      const result = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(RateLimitPolicy)
        .values({
          endpoint,
          maxAttempts,
          windowMs,
          description,
          isActive,
          createdAt: () => 'now()',
          updatedAt: () => 'now()',
        })
        .onConflict(
          `("endpoint") DO UPDATE SET 
          "maxAttempts" = excluded."maxAttempts",
          "windowMs" = excluded."windowMs", 
          "description" = excluded."description",
          "isActive" = excluded."isActive",
          "updated_at" = now()`,
        )
        .returning('*')
        .execute();

      // Refresh cache after policy change
      await this.refreshPolicyCache();

      return result.raw[0];
    } catch (error) {
      this.logger.error('Failed to upsert rate limit policy:', error);
      throw error;
    }
  }

  /**
   * Comprehensive health check for CI and monitoring
   * Returns detailed system status including database, policies, and metrics
   */
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    database: { connected: boolean; responseTime: number; error?: string };
    policies: { loaded: number; cacheStatus: string; error?: string };
    metrics: { available: boolean; error?: string };
    tables: { rateLimitPolicies: boolean; appMetrics: boolean; error?: string };
    timestamp: string;
  }> {
    const healthCheck: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      database: { connected: boolean; responseTime: number; error?: string };
      policies: { loaded: number; cacheStatus: string; error?: string };
      metrics: { available: boolean; error?: string };
      tables: {
        rateLimitPolicies: boolean;
        appMetrics: boolean;
        error?: string;
      };
      timestamp: string;
    } = {
      status: 'healthy',
      database: { connected: false, responseTime: 0 },
      policies: { loaded: 0, cacheStatus: 'unknown' },
      metrics: { available: false },
      tables: { rateLimitPolicies: false, appMetrics: false },
      timestamp: new Date().toISOString(),
    };

    try {
      // Test database connectivity
      const dbStart = Date.now();
      await this.dataSource.query('SELECT 1');
      healthCheck.database.connected = true;
      healthCheck.database.responseTime = Date.now() - dbStart;

      // Check required tables exist and have data
      try {
        const policyCount = await this.dataSource.query(
          'SELECT COUNT(*) FROM rate_limit_policies',
        );
        healthCheck.tables.rateLimitPolicies = true;

        if (parseInt(policyCount[0].count) === 0) {
          healthCheck.policies.error = 'No rate limit policies found';
          healthCheck.status = 'degraded';
        }
      } catch (error) {
        healthCheck.tables.rateLimitPolicies = false;
        healthCheck.policies.error = 'rate_limit_policies table not accessible';
        healthCheck.status = 'unhealthy';
      }

      try {
        await this.dataSource.query('SELECT COUNT(*) FROM app_metrics');
        healthCheck.tables.appMetrics = true;
        healthCheck.metrics.available = true;
      } catch (error) {
        healthCheck.tables.appMetrics = false;
        healthCheck.metrics.error = 'app_metrics table not accessible';
        healthCheck.status = 'degraded';
      }

      // Check policy cache
      try {
        const cacheStatus = this.getPolicyCacheStatus();
        healthCheck.policies.loaded = cacheStatus.size;
        healthCheck.policies.cacheStatus = cacheStatus.isExpired
          ? 'expired'
          : 'fresh';

        if (cacheStatus.size === 0) {
          healthCheck.policies.error = 'Policy cache is empty';
          healthCheck.status = 'degraded';
        }
      } catch (error) {
        healthCheck.policies.error = 'Policy cache not accessible';
        healthCheck.status = 'degraded';
      }
    } catch (error) {
      healthCheck.database.connected = false;
      healthCheck.database.error = error.message;
      healthCheck.status = 'unhealthy';
    }

    return healthCheck;
  }

  /**
   * Get comprehensive dashboard metrics for admin panel
   */
  async getDashboardMetrics(): Promise<any> {
    try {
      // Get user count
      const userCount = await this.dataSource.getRepository('User').count();

      // Get poll counts
      const pollRepository = this.dataSource.getRepository('Poll');
      const totalPolls = await pollRepository.count();

      // Get active polls (between start and end dates)
      const now = new Date();
      const activePolls = await pollRepository
        .createQueryBuilder('poll')
        .where('poll.startTime <= :now', { now })
        .andWhere('poll.endTime >= :now', { now })
        .getCount();

      // Get vote counts
      const voteRepository = this.dataSource.getRepository('Vote');
      const totalVotes = await voteRepository.count();

      // Get anonymous votes count
      const anonymousVotes = await voteRepository
        .createQueryBuilder('vote')
        .innerJoin('vote.poll', 'poll')
        .where('poll.anonymous = true')
        .getCount();

      // Get rate limit metrics
      const rateLimitPolicies = await this.policyRepository.count();
      const rateLimitViolations = await this.rateLimitRepository.count();

      // Get top violated endpoints
      const topViolatedEndpoints = await this.rateLimitRepository
        .createQueryBuilder('rate_limit')
        .select('rate_limit.endpoint', 'endpoint')
        .addSelect('COUNT(*)', 'violations')
        .groupBy('rate_limit.endpoint')
        .orderBy('violations', 'DESC')
        .limit(5)
        .getRawMany();

      // Get security metrics
      const userSessionRepository =
        this.dataSource.getRepository('UserSession');
      const activeSessions = await userSessionRepository
        .createQueryBuilder('session')
        .where('session.expiresAt > :now', { now })
        .andWhere('session.isActive = :active', { active: true })
        .getCount();

      const revokedTokensRepository =
        this.dataSource.getRepository('RevokedToken');
      const revokedTokens = await revokedTokensRepository.count();

      // Get homomorphic encryption metrics
      const encryptedBallotRepository =
        this.dataSource.getRepository('EncryptedBallot');
      const encryptedBallots = await encryptedBallotRepository.count();

      // Calculate average processing time from recent ballots
      const recentBallots = await encryptedBallotRepository
        .createQueryBuilder('ballot')
        .where('ballot.createdAt > :since', {
          since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .getMany();

      const avgProcessingTime =
        recentBallots.length > 0
          ? recentBallots.reduce((sum, ballot) => {
              const processingTime = ballot.processingTime || 0;
              return sum + processingTime;
            }, 0) / recentBallots.length
          : 0;

      // Count completed aggregations (assuming we track this in app metrics)
      const completedAggregations = await this.appMetricsRepository
        .createQueryBuilder('metrics')
        .where('metrics.name = :name', {
          name: 'homomorphic_aggregations_completed',
        })
        .getOne();

      // Calculate dynamic security score
      const securityScore = await this.calculateSecurityScore(
        rateLimitViolations,
        userCount,
        activeSessions,
      );

      return {
        userCount,
        pollCount: totalPolls,
        voteCount: totalVotes,
        activePolls,
        anonymousVotes,
        rateLimitPolicies,
        rateLimitViolations,
        topViolatedEndpoints: topViolatedEndpoints.map((row) => ({
          endpoint: row.endpoint,
          violations: parseInt(row.violations),
        })),
        activeSessions,
        activeTokens: activeSessions, // Active sessions are effectively active tokens
        expiredTokens: 0, // We don't store expired tokens, they're cleaned up
        revokedTokens,
        encryptedBallots,
        completedAggregations: completedAggregations
          ? parseInt(completedAggregations.count.toString())
          : 0,
        avgProcessingTime: Math.round(avgProcessingTime),
        securityScore,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to calculate dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate a dynamic security score based on various health indicators
   */
  private async calculateSecurityScore(
    rateLimitViolations: number,
    userCount: number,
    activeSessions: number,
  ): Promise<number> {
    let score = 100; // Start with perfect score

    // Deduct points for rate limit violations (last 24 hours)
    const recentViolations = await this.rateLimitRepository
      .createQueryBuilder('rate_limit')
      .where('rate_limit.windowStart > :since', {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .getCount();

    score -= Math.min(recentViolations * 2, 30); // Max 30 point deduction for violations

    // Check MFA adoption rate
    const usersWithMFA = await this.dataSource
      .getRepository('User')
      .createQueryBuilder('user')
      .where('user.mfaSecret IS NOT NULL')
      .getCount();

    const mfaAdoptionRate =
      userCount > 0 ? (usersWithMFA / userCount) * 100 : 100;
    if (mfaAdoptionRate < 50) {
      score -= 20; // Deduct points for low MFA adoption
    } else if (mfaAdoptionRate < 80) {
      score -= 10;
    }

    // Check for old sessions (older than 7 days)
    const oldSessions = await this.dataSource
      .getRepository('UserSession')
      .createQueryBuilder('session')
      .where('session.createdAt < :weekAgo', {
        weekAgo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      })
      .andWhere('session.isActive = :active', { active: true })
      .getCount();

    if (oldSessions > 0) {
      score -= Math.min(oldSessions * 5, 15); // Max 15 point deduction for old sessions
    }

    return Math.max(score, 0); // Ensure score doesn't go below 0
  }

  /**
   * Get daily activity data for the last 7 days
   */
  async getDailyActivity(): Promise<
    Array<{ date: string; votes: number; polls: number }>
  > {
    try {
      const activityData: Array<{
        date: string;
        votes: number;
        polls: number;
      }> = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dateStr = date.toISOString().split('T')[0];

        // Get votes for this day
        const dayVotes = await this.dataSource
          .getRepository('Vote')
          .createQueryBuilder('vote')
          .where('vote.createdAt >= :startDate', { startDate: date })
          .andWhere('vote.createdAt < :endDate', { endDate: nextDate })
          .getCount();

        // Get polls created this day
        const dayPolls = await this.dataSource
          .getRepository('Poll')
          .createQueryBuilder('poll')
          .where('poll.createdAt >= :startDate', { startDate: date })
          .andWhere('poll.createdAt < :endDate', { endDate: nextDate })
          .getCount();

        activityData.push({
          date: dateStr,
          votes: dayVotes,
          polls: dayPolls,
        });
      }

      return activityData;
    } catch (error) {
      this.logger.error('Failed to get daily activity:', error);
      throw error;
    }
  }

  /**
   * Get recent security events
   */
  async getSecurityEvents(): Promise<
    Array<{
      id: string;
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
      timestamp: string;
      endpoint?: string;
    }>
  > {
    try {
      const events: Array<{
        id: string;
        type: string;
        description: string;
        severity: 'low' | 'medium' | 'high';
        timestamp: string;
        endpoint?: string;
      }> = [];

      // Check for recent rate limit violations
      const recentViolations = await this.rateLimitRepository
        .createQueryBuilder('rate_limit')
        .where('rate_limit.windowStart > :since', {
          since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .orderBy('rate_limit.windowStart', 'DESC')
        .limit(5)
        .getMany();

      for (const violation of recentViolations) {
        events.push({
          id: `violation-${violation.ipAddress}-${violation.endpoint}`,
          type: 'Rate Limit Violation',
          description: `${violation.attempts} attempts from ${violation.ipAddress} on ${violation.endpoint}`,
          severity:
            violation.attempts > 50
              ? 'high'
              : violation.attempts > 20
                ? 'medium'
                : 'low',
          timestamp: violation.windowStart.toISOString(),
          endpoint: violation.endpoint,
        });
      }

      // Check for failed login attempts by looking at recent app metrics
      const loginFailures = await this.appMetricsRepository
        .createQueryBuilder('metrics')
        .where('metrics.name LIKE :pattern', { pattern: 'auth_failure:%' })
        .andWhere('metrics.createdAt > :since', {
          since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .orderBy('metrics.createdAt', 'DESC')
        .limit(3)
        .getMany();

      for (const failure of loginFailures) {
        events.push({
          id: `auth-failure-${failure.name}`,
          type: 'Authentication Failure',
          description: `Failed authentication attempt detected`,
          severity: 'medium' as const,
          timestamp: failure.createdAt.toISOString(),
        });
      }

      // Check for new user registrations (potential account enumeration)
      const recentUsers = await this.dataSource
        .getRepository('User')
        .createQueryBuilder('user')
        .where('user.createdAt > :since', {
          since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .getCount();

      if (recentUsers > 0) {
        events.push({
          id: `new-users-${Date.now()}`,
          type: 'User Activity',
          description: `${recentUsers} new user(s) registered in the last 24 hours`,
          severity: 'low' as const,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for admin actions
      const adminActions = await this.appMetricsRepository
        .createQueryBuilder('metrics')
        .where('metrics.name LIKE :pattern', { pattern: 'admin:%' })
        .andWhere('metrics.createdAt > :since', {
          since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        })
        .orderBy('metrics.createdAt', 'DESC')
        .limit(2)
        .getMany();

      for (const action of adminActions) {
        events.push({
          id: `admin-action-${action.name}`,
          type: 'Admin Activity',
          description: `Administrative action: ${action.name.replace('admin:', '')}`,
          severity: 'low' as const,
          timestamp: action.createdAt.toISOString(),
        });
      }

      // Sort by timestamp and return most recent events
      return events
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 10);
    } catch (error) {
      this.logger.error('Failed to get security events:', error);
      throw error;
    }
  }
}
