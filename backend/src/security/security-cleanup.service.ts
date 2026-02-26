import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SecurityService } from './security.service';
import { DataSource, LessThan } from 'typeorm';
import { AppMetrics } from './entities/app-metrics.entity';
import { Poll } from '../polls/entities/poll.entity';

@Injectable()
export class SecurityCleanupService {
  private readonly logger = new Logger(SecurityCleanupService.name);

  constructor(
    private readonly securityService: SecurityService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cleanup expired security data daily at 3:00 AM
   * This includes:
   * - Expired revoked tokens
   * - Expired user sessions
   * - Old rate limit entries
   */
  @Cron('0 3 * * *')
  async handleDailyCleanup() {
    await this.runCleanupWithLock(42, 'daily');
  }

  /**
   * Cleanup polls closed over 90 days ago daily at 4:00 AM UTC
   * This runs after the regular security cleanup to avoid conflicts
   */
  @Cron('0 4 * * *', { timeZone: 'UTC' })
  async handlePollCleanup() {
    await this.runCleanupWithLock(45, 'poll-cleanup');
  }

  /**
   * Additional cleanup for rate limits every hour (more frequent)
   * Rate limits can accumulate quickly and should be cleaned more often
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyCleanup() {
    await this.runCleanupWithLock(43, 'hourly');
  }

  private async runCleanupWithLock(lockId: number, cleanupType: string) {
    try {
      // Try to acquire advisory lock
      const [{ pg_try_advisory_lock }] = await this.dataSource.query(
        `SELECT pg_try_advisory_lock($1)`,
        [lockId],
      );

      if (!pg_try_advisory_lock) {
        this.logger.log(
          `${cleanupType} cleanup already running on another instance, skipping`,
        );
        return;
      }

      this.logger.log(
        `Starting ${cleanupType} cleanup with advisory lock ${lockId}`,
      );

      // Perform cleanup
      if (cleanupType === 'daily') {
        await this.securityService.cleanupExpiredData();
        await this.pruneOldMetrics(); // Prune metrics during daily cleanup
      } else if (cleanupType === 'hourly') {
        await this.securityService.cleanupRateLimitEntries();
      } else if (cleanupType === 'poll-cleanup') {
        await this.pruneOldPolls(); // Clean polls older than 90 days
      } else if (cleanupType === 'manual') {
        await this.securityService.cleanupExpiredData();
        await this.securityService.cleanupRateLimitEntries();
        await this.pruneOldMetrics();
        await this.pruneOldPolls();
      }

      this.logger.log(`${cleanupType} cleanup completed successfully`);
    } catch (error) {
      this.logger.error(`${cleanupType} cleanup failed:`, error);
    } finally {
      try {
        // Release advisory lock
        await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [lockId]);
      } catch (unlockError) {
        this.logger.error('Failed to release advisory lock:', unlockError);
      }
    }
  }

  /**
   * Manual cleanup trigger for testing or emergency use
   */
  async performManualCleanup(): Promise<void> {
    await this.runCleanupWithLock(44, 'manual');
  }

  /**
   * Prune old metrics to prevent infinite growth
   * Removes metrics older than 90 days using TypeORM QueryBuilder
   */
  private async pruneOldMetrics(): Promise<void> {
    try {
      const retentionDays = 90;
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - retentionDays);

      this.logger.log(
        `Pruning metrics older than ${retentionDays} days (before ${retentionDate.toISOString()})`,
      );

      // Use QueryBuilder for a type-safer DELETE operation
      const result = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from(AppMetrics)
        .where({
          createdAt: LessThan(retentionDate),
        })
        .execute();

      this.logger.log(
        `Pruned ${result.affected ?? 0} metric entries older than ${retentionDays} days`,
      );

      // Track cleanup metrics
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(AppMetrics)
        .values({
          name: 'cleanup:metrics_pruned',
          count: result.affected ?? 0,
          createdAt: () => 'now()',
          lastUpdated: () => 'now()',
        })
        .onConflict(
          `("name") DO UPDATE SET "count" = app_metrics.count + EXCLUDED.count, "last_updated" = now()`,
        )
        .execute();
    } catch (error) {
      this.logger.error('Metrics pruning failed:', error);
      // Track cleanup errors
      try {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(AppMetrics)
          .values({
            name: 'error:metrics_pruning',
            count: 1,
            createdAt: () => 'now()',
            lastUpdated: () => 'now()',
          })
          .onConflict(
            `("name") DO UPDATE SET "count" = app_metrics.count + 1, "last_updated" = now()`,
          )
          .execute();
      } catch (metricError) {
        this.logger.error(
          'Failed to track metrics pruning error:',
          metricError,
        );
      }
    }
  }

  /**
   * Prune polls closed over 90 days ago to prevent database bloat
   * Uses TypeORM QueryBuilder with transaction for safety
   */
  private async pruneOldPolls(): Promise<void> {
    try {
      const retentionDays = 90;
      const cutoffDate = new Date(
        Date.now() - retentionDays * 24 * 60 * 60 * 1000,
      );

      this.logger.log(
        `Pruning polls closed over ${retentionDays} days ago (before ${cutoffDate.toISOString()})`,
      );

      await this.dataSource.transaction(async (transactionalEntityManager) => {
        const deleteResult = await transactionalEntityManager
          .createQueryBuilder()
          .delete()
          .from(Poll)
          .where('end_time < :cutoff', { cutoff: cutoffDate })
          .execute();

        if (deleteResult.affected && deleteResult.affected > 0) {
          this.logger.log(
            `Successfully pruned ${deleteResult.affected} polls and their related data older than ${retentionDays} days.`,
          );
        } else {
          this.logger.log(
            `No polls found older than ${retentionDays} days to prune.`,
          );
        }

        // Track cleanup metrics
        await transactionalEntityManager
          .createQueryBuilder()
          .insert()
          .into(AppMetrics)
          .values({
            name: 'cleanup:polls_pruned',
            count: deleteResult.affected ?? 0,
            createdAt: () => 'now()',
            lastUpdated: () => 'now()',
          })
          .onConflict(
            `("name") DO UPDATE SET "count" = app_metrics.count + EXCLUDED.count, "last_updated" = now()`,
          )
          .execute();
      });
    } catch (error) {
      this.logger.error('Poll pruning failed:', error);
      // Track cleanup errors
      try {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into(AppMetrics)
          .values({
            name: 'error:poll_pruning',
            count: 1,
            createdAt: () => 'now()',
            lastUpdated: () => 'now()',
          })
          .onConflict(
            `("name") DO UPDATE SET "count" = app_metrics.count + 1, "last_updated" = now()`,
          )
          .execute();
      } catch (metricError) {
        this.logger.error('Failed to track poll pruning error:', metricError);
      }
    }
  }
}
