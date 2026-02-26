import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PollsService } from '../polls/polls.service';
import { VotesService } from '../votes/votes.service';
import { TallyService } from '../tally/tally.service';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface CleanupConfig {
  dryRun?: boolean;
  archiveAfterDays?: number;
  deleteAfterDays?: number;
  batchSize?: number;
  preserveActivePolls?: boolean;
  preserveRecentPolls?: boolean;
}

interface CleanupResult {
  archivedPolls: number;
  deletedPolls: number;
  deletedVotes: number;
  deletedEncryptedBallots: number;
  freedSpaceMB: number;
  errors: string[];
}

export class PollCleanupService {
  private readonly logger = new Logger('PollCleanupService');

  constructor(
    private readonly pollsService: PollsService,
    private readonly votesService: VotesService,
    private readonly tallyService: TallyService,
    private readonly dataSource: DataSource,
  ) {}

  async performCleanup(config: CleanupConfig = {}): Promise<CleanupResult> {
    const {
      dryRun = false,
      archiveAfterDays = 90,
      deleteAfterDays = 365,
      batchSize = 50,
      preserveActivePolls = true,
      preserveRecentPolls = true,
    } = config;

    this.logger.log('🧹 Starting automated poll cleanup...');
    this.logger.log(`Configuration: ${JSON.stringify(config, null, 2)}`);

    const result: CleanupResult = {
      archivedPolls: 0,
      deletedPolls: 0,
      deletedVotes: 0,
      deletedEncryptedBallots: 0,
      freedSpaceMB: 0,
      errors: [],
    };

    try {
      // Calculate cutoff dates
      const archiveCutoff = new Date();
      archiveCutoff.setDate(archiveCutoff.getDate() - archiveAfterDays);

      const deleteCutoff = new Date();
      deleteCutoff.setDate(deleteCutoff.getDate() - deleteAfterDays);

      this.logger.log(`Archive cutoff: ${archiveCutoff.toISOString()}`);
      this.logger.log(`Delete cutoff: ${deleteCutoff.toISOString()}`);

      // Step 1: Archive old polls
      await this.archiveOldPolls(
        archiveCutoff,
        batchSize,
        preserveActivePolls,
        preserveRecentPolls,
        dryRun,
        result,
      );

      // Step 2: Delete very old polls and associated data
      await this.deleteVeryOldPolls(
        deleteCutoff,
        batchSize,
        preserveActivePolls,
        dryRun,
        result,
      );

      // Step 3: Clean up orphaned data
      await this.cleanupOrphanedData(dryRun, result);

      // Step 4: Calculate space savings
      result.freedSpaceMB = await this.calculateSpaceSavings(result);

      this.logger.log('🎉 Poll cleanup completed successfully');
      this.logger.log(`Summary: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      this.logger.error('❌ Poll cleanup failed:', error);
      result.errors.push(`Cleanup failed: ${error.message}`);
    }

    return result;
  }

  private async archiveOldPolls(
    cutoffDate: Date,
    batchSize: number,
    preserveActive: boolean,
    preserveRecent: boolean,
    dryRun: boolean,
    result: CleanupResult,
  ): Promise<void> {
    this.logger.log('📦 Step 1: Archiving old polls...');

    const queryBuilder = this.dataSource
      .getRepository('Poll')
      .createQueryBuilder('poll')
      .where('poll.endTime < :cutoff', { cutoff: cutoffDate })
      .andWhere('poll.archived != :archived', { archived: true });

    if (preserveActive) {
      queryBuilder.andWhere('poll.endTime < NOW()');
    }

    if (preserveRecent) {
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 30); // Don't archive polls less than 30 days old
      queryBuilder.andWhere('poll.endTime < :recentCutoff', { recentCutoff });
    }

    const pollsToArchive = await queryBuilder.take(batchSize).getMany();

    this.logger.log(`Found ${pollsToArchive.length} polls to archive`);

    for (const poll of pollsToArchive) {
      try {
        if (!dryRun) {
          await this.dataSource.getRepository('Poll').update(poll.id, {
            archived: true,
            archivedAt: new Date(),
          });
        }

        result.archivedPolls++;
        this.logger.debug(
          `${dryRun ? '[DRY RUN] ' : ''}Archived poll: ${poll.id} - "${poll.title}"`,
        );
      } catch (error) {
        this.logger.error(`Failed to archive poll ${poll.id}:`, error);
        result.errors.push(
          `Archive failed for poll ${poll.id}: ${error.message}`,
        );
      }
    }
  }

  private async deleteVeryOldPolls(
    cutoffDate: Date,
    batchSize: number,
    preserveActive: boolean,
    dryRun: boolean,
    result: CleanupResult,
  ): Promise<void> {
    this.logger.log('🗑️ Step 2: Deleting very old polls...');

    const queryBuilder = this.dataSource
      .getRepository('Poll')
      .createQueryBuilder('poll')
      .where('poll.endTime < :cutoff', { cutoff: cutoffDate });

    if (preserveActive) {
      queryBuilder.andWhere('poll.endTime < NOW()');
    }

    const pollsToDelete = await queryBuilder.take(batchSize).getMany();

    this.logger.log(`Found ${pollsToDelete.length} polls to delete`);

    for (const poll of pollsToDelete) {
      try {
        await this.deletePollAndAssociatedData(poll.id, dryRun, result);
        result.deletedPolls++;
        this.logger.debug(
          `${dryRun ? '[DRY RUN] ' : ''}Deleted poll: ${poll.id} - "${poll.title}"`,
        );
      } catch (error) {
        this.logger.error(`Failed to delete poll ${poll.id}:`, error);
        result.errors.push(
          `Delete failed for poll ${poll.id}: ${error.message}`,
        );
      }
    }
  }

  private async deletePollAndAssociatedData(
    pollId: string,
    dryRun: boolean,
    result: CleanupResult,
  ): Promise<void> {
    if (!dryRun) {
      // Use transaction to ensure data consistency
      await this.dataSource.transaction(async (manager) => {
        // Delete votes
        const votesDeleteResult = await manager
          .getRepository('Vote')
          .delete({ pollId });
        result.deletedVotes += votesDeleteResult.affected || 0;

        // Delete poll options
        await manager.getRepository('Option').delete({ pollId });

        // Delete encrypted ballots
        const ballotsDeleteResult = await manager
          .getRepository('EncryptedBallot')
          .delete({ pollId });
        result.deletedEncryptedBallots += ballotsDeleteResult.affected || 0;

        // Finally delete the poll
        await manager.getRepository('Poll').delete({ id: pollId });
      });
    } else {
      // For dry run, just count what would be deleted
      const voteCount = await this.dataSource
        .getRepository('Vote')
        .count({ where: { pollId } });

      const ballotCount = await this.dataSource
        .getRepository('EncryptedBallot')
        .count({ where: { pollId } });

      result.deletedVotes += voteCount;
      result.deletedEncryptedBallots += ballotCount;
    }
  }

  private async cleanupOrphanedData(
    dryRun: boolean,
    result: CleanupResult,
  ): Promise<void> {
    this.logger.log('🧽 Step 3: Cleaning up orphaned data...');

    try {
      // Clean up orphaned votes (votes for non-existent polls)
      const orphanedVotesQuery = `
        DELETE FROM votes 
        WHERE poll_id NOT IN (SELECT id FROM polls)
      `;

      if (!dryRun) {
        const orphanedVotesResult =
          await this.dataSource.query(orphanedVotesQuery);
        result.deletedVotes += orphanedVotesResult.affectedRows || 0;
      } else {
        const countQuery = `
          SELECT COUNT(*) as count FROM votes 
          WHERE poll_id NOT IN (SELECT id FROM polls)
        `;
        const countResult = await this.dataSource.query(countQuery);
        result.deletedVotes += countResult[0]?.count || 0;
      }

      // Clean up orphaned encrypted ballots
      const orphanedBallotsQuery = `
        DELETE FROM encrypted_ballots 
        WHERE poll_id NOT IN (SELECT id FROM polls)
      `;

      if (!dryRun) {
        const orphanedBallotsResult =
          await this.dataSource.query(orphanedBallotsQuery);
        result.deletedEncryptedBallots +=
          orphanedBallotsResult.affectedRows || 0;
      } else {
        const countQuery = `
          SELECT COUNT(*) as count FROM encrypted_ballots 
          WHERE poll_id NOT IN (SELECT id FROM polls)
        `;
        const countResult = await this.dataSource.query(countQuery);
        result.deletedEncryptedBallots += countResult[0]?.count || 0;
      }

      // Clean up orphaned options
      const orphanedOptionsQuery = `
        DELETE FROM options 
        WHERE poll_id NOT IN (SELECT id FROM polls)
      `;

      if (!dryRun) {
        await this.dataSource.query(orphanedOptionsQuery);
      }
    } catch (error) {
      this.logger.error('Failed to clean up orphaned data:', error);
      result.errors.push(`Orphaned data cleanup failed: ${error.message}`);
    }
  }

  private async calculateSpaceSavings(result: CleanupResult): Promise<number> {
    // Rough estimation of space savings
    const avgPollSize = 0.1; // MB
    const avgVoteSize = 0.001; // MB
    const avgBallotSize = 0.01; // MB

    return (
      result.deletedPolls * avgPollSize +
      result.deletedVotes * avgVoteSize +
      result.deletedEncryptedBallots * avgBallotSize
    );
  }

  async getCleanupStatistics(): Promise<{
    totalPolls: number;
    archivedPolls: number;
    activePolls: number;
    oldPolls: number;
    veryOldPolls: number;
    estimatedSavingsMB: number;
  }> {
    const now = new Date();
    const archiveCutoff = new Date();
    archiveCutoff.setDate(archiveCutoff.getDate() - 90);

    const deleteCutoff = new Date();
    deleteCutoff.setDate(deleteCutoff.getDate() - 365);

    const [totalPolls, archivedPolls, activePolls, oldPolls, veryOldPolls] =
      await Promise.all([
        this.dataSource.getRepository('Poll').count(),
        this.dataSource
          .getRepository('Poll')
          .count({ where: { archived: true } }),
        this.dataSource.getRepository('Poll').count({
          where: { endTime: { $gte: now } },
        }),
        this.dataSource.getRepository('Poll').count({
          where: {
            endTime: { $lt: archiveCutoff, $gte: deleteCutoff },
            archived: false,
          },
        }),
        this.dataSource.getRepository('Poll').count({
          where: { endTime: { $lt: deleteCutoff } },
        }),
      ]);

    const estimatedSavingsMB = veryOldPolls * 0.1 + oldPolls * 0.05;

    return {
      totalPolls,
      archivedPolls,
      activePolls,
      oldPolls,
      veryOldPolls,
      estimatedSavingsMB,
    };
  }
}

async function runCleanup() {
  const logger = new Logger('PollCleanupScript');

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const force = args.includes('--force');
    const archiveDays = parseInt(
      args.find((arg) => arg.startsWith('--archive-after='))?.split('=')[1] ||
        '90',
    );
    const deleteDays = parseInt(
      args.find((arg) => arg.startsWith('--delete-after='))?.split('=')[1] ||
        '365',
    );
    const batchSize = parseInt(
      args.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] ||
        '50',
    );

    logger.log('🚀 Starting poll cleanup script...');
    logger.log(
      `Arguments: dry-run=${dryRun}, force=${force}, archive-after=${archiveDays}, delete-after=${deleteDays}, batch-size=${batchSize}`,
    );

    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule);

    const pollsService = app.get(PollsService);
    const votesService = app.get(VotesService);
    const tallyService = app.get(TallyService);
    const dataSource = app.get(DataSource);

    const cleanupService = new PollCleanupService(
      pollsService,
      votesService,
      tallyService,
      dataSource,
    );

    // Get statistics before cleanup
    const statsBefore = await cleanupService.getCleanupStatistics();
    logger.log('📊 Statistics before cleanup:');
    logger.log(JSON.stringify(statsBefore, null, 2));

    if (!force && !dryRun) {
      logger.warn(
        '⚠️  This operation will permanently delete data. Use --dry-run to preview or --force to confirm.',
      );
      process.exit(1);
    }

    // Perform cleanup
    const result = await cleanupService.performCleanup({
      dryRun,
      archiveAfterDays: archiveDays,
      deleteAfterDays: deleteDays,
      batchSize,
      preserveActivePolls: true,
      preserveRecentPolls: true,
    });

    // Get statistics after cleanup
    const statsAfter = await cleanupService.getCleanupStatistics();
    logger.log('📊 Statistics after cleanup:');
    logger.log(JSON.stringify(statsAfter, null, 2));

    // Summary
    logger.log('✅ Cleanup completed successfully');
    logger.log(`📈 Results: ${JSON.stringify(result, null, 2)}`);

    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Cleanup script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  runCleanup();
}
