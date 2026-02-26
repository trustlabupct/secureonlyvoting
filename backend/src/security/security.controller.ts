import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  HttpException,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/auth.interfaces';
import { SecurityCleanupService } from './security-cleanup.service';
import { RateLimit, RateLimitGuard } from './guards/rate-limit.guard';
import { SecurityService } from './security.service';

// DTOs for policy management
class CreatePolicyDto {
  endpoint: string;
  maxAttempts: number;
  windowMs: number;
  description?: string;
  isActive: boolean = true;
}

class UpdatePolicyDto {
  maxAttempts?: number;
  windowMs?: number;
  description?: string;
  isActive?: boolean;
}

@Controller('admin/security')
@UseGuards(RateLimitGuard)
export class SecurityController {
  private readonly logger = new Logger(SecurityController.name);

  constructor(
    private readonly securityCleanupService: SecurityCleanupService,
    private readonly securityService: SecurityService,
  ) {}

  /**
   * Manual cleanup endpoint for administrators
   * Triggers immediate cleanup of expired tokens, sessions, and rate limits
   *
   * @returns Success message with timestamp
   */
  @Post('cleanup')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 3, windowMs: 300000 }) // 3 attempts per 5 minutes (stricter)
  async triggerCleanup() {
    try {
      await this.securityCleanupService.performManualCleanup();
      return {
        success: true,
        message: 'Security cleanup completed successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Manual cleanup failed:', error);
      throw new HttpException(
        'Cleanup operation failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get current system metrics (HTTPS-only, highly restricted)
   * Returns metrics for monitoring rate limits, cleanups, and errors
   *
   * @returns Array of metrics with counts and timestamps
   */
  @Get('metrics')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 1, windowMs: 60000 }) // 1 request per minute (very restrictive)
  async getMetrics() {
    try {
      const metrics = await this.securityService.getMetrics();
      return {
        success: true,
        metrics,
        timestamp: new Date().toISOString(),
        count: metrics.length,
      };
    } catch (error) {
      this.logger.error('Failed to fetch metrics:', error);
      throw new HttpException(
        'Failed to fetch metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get database performance statistics
   * Monitor query performance for rate limiting operations
   */
  @Get('performance')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 2, windowMs: 300000 }) // 2 requests per 5 minutes
  async getPerformanceStats() {
    try {
      const stats = await this.securityService.getPerformanceStats();
      return {
        success: true,
        performanceStats: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch performance stats:', error);
      throw new HttpException(
        'Failed to fetch performance statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create or update a rate limit policy
   */
  @Post('policies')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 5, windowMs: 300000 }) // 5 policy changes per 5 minutes
  async createPolicy(@Body() createPolicyDto: CreatePolicyDto) {
    try {
      const policy = await this.securityService.upsertRateLimitPolicy(
        createPolicyDto.endpoint,
        createPolicyDto.maxAttempts,
        createPolicyDto.windowMs,
        createPolicyDto.description,
        createPolicyDto.isActive,
      );

      this.logger.log(
        `Rate limit policy created/updated for ${createPolicyDto.endpoint}`,
      );

      return {
        success: true,
        policy,
        message: 'Rate limit policy created/updated successfully',
      };
    } catch (error) {
      this.logger.error('Failed to create/update policy:', error);
      throw new HttpException(
        'Failed to create/update rate limit policy',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * List all rate limit policies
   */
  @Get('policies')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 10, windowMs: 60000 }) // 10 requests per minute
  async listPolicies(@Query('active') activeOnly?: string) {
    try {
      // Force a cache refresh to get latest policies
      await this.securityService.refreshPolicyCache();

      // For now, we'll need to query directly since we don't have a public method
      // This would typically be handled by adding a getPolicies method to SecurityService
      return {
        success: true,
        message:
          'Use the database directly or add getPolicies method to SecurityService',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to list policies:', error);
      throw new HttpException(
        'Failed to list rate limit policies',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Refresh policy cache manually
   */
  @Post('policies/refresh')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 1, windowMs: 60000 }) // 1 cache refresh per minute (more restrictive)
  async refreshPolicyCache() {
    try {
      const result = await this.securityService.refreshPolicyCache();
      this.logger.log(
        `Policy cache manually refreshed: ${result.policiesLoaded} policies loaded`,
      );

      return {
        success: true,
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to refresh policy cache:', error);
      throw new HttpException(
        'Failed to refresh policy cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get policy cache status for monitoring
   */
  @Get('policies/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 10, windowMs: 60000 }) // 10 status checks per minute
  async getPolicyStatus() {
    try {
      const cacheStatus = this.securityService.getPolicyCacheStatus();

      return {
        success: true,
        cache: cacheStatus,
        system: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to get policy status:', error);
      throw new HttpException(
        'Failed to get policy cache status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check endpoint for monitoring
   * Performs comprehensive system health checks for CI and production monitoring
   */
  @Get('health')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 30, windowMs: 60000 }) // 30 health checks per minute
  async healthCheck() {
    try {
      const healthStatus = await this.securityService.getSystemHealth();

      // Track health check execution
      await this.securityService.incrementMetric('health_check:performed');

      // Return appropriate HTTP status based on health
      if (healthStatus.status === 'unhealthy') {
        throw new HttpException(
          {
            success: false,
            ...healthStatus,
            message: 'System is unhealthy',
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        success: true,
        ...healthStatus,
        message:
          healthStatus.status === 'healthy'
            ? 'All systems operational'
            : 'Some systems degraded',
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          success: false,
          status: 'unhealthy',
          error: 'Health check execution failed',
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Public health check endpoint for CI and load balancers
   * Simplified health check without authentication
   */
  @Get('health/public')
  @RateLimit({ maxAttempts: 60, windowMs: 60000 }) // 60 requests per minute for public endpoint
  async publicHealthCheck() {
    try {
      const healthStatus = await this.securityService.getSystemHealth();

      const response = {
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        database: healthStatus.database.connected,
        responseTime: `${healthStatus.database.responseTime}ms`,
      };

      if (healthStatus.status === 'unhealthy') {
        throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
      }

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          database: false,
          error: 'Health check failed',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Get comprehensive dashboard metrics (admin only)
   * Returns real system metrics for the admin dashboard
   */
  @Get('dashboard/metrics')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 10, windowMs: 60000 }) // 10 requests per minute
  async getDashboardMetrics() {
    try {
      const dashboardMetrics = await this.securityService.getDashboardMetrics();
      return {
        success: true,
        data: dashboardMetrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch dashboard metrics:', error);
      throw new HttpException(
        'Failed to fetch dashboard metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get daily activity data for the last 7 days (admin only)
   * Returns real voting and poll creation activity by day
   */
  @Get('dashboard/activity')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 15, windowMs: 60000 }) // 15 requests per minute
  async getDailyActivity() {
    try {
      const activityData = await this.securityService.getDailyActivity();
      return {
        success: true,
        data: activityData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch daily activity:', error);
      throw new HttpException(
        'Failed to fetch daily activity data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get recent security events (admin only)
   * Returns real security events based on system activity
   */
  @Get('dashboard/events')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  @RateLimit({ maxAttempts: 10, windowMs: 60000 }) // 10 requests per minute
  async getSecurityEvents() {
    try {
      const securityEvents = await this.securityService.getSecurityEvents();
      return {
        success: true,
        data: securityEvents,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to fetch security events:', error);
      throw new HttpException(
        'Failed to fetch security events',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
