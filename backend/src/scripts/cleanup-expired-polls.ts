import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Poll } from '../polls/entities/poll.entity';
import { Vote } from '../votes/entities/vote.entity';
import { Option } from '../polls/entities/option.entity';
import { Repository } from 'typeorm';

interface CleanupStats {
  expiredPolls: number;
  deletedVotes: number;
  deletedOptions: number;
  deletedPollNames: string[];
}

async function cleanupExpiredPolls(): Promise<CleanupStats> {
  const app = await NestFactory.createApplicationContext(AppModule);

  const pollRepository = app.get<Repository<Poll>>(getRepositoryToken(Poll));
  const voteRepository = app.get<Repository<Vote>>(getRepositoryToken(Vote));
  const optionRepository = app.get<Repository<Option>>(
    getRepositoryToken(Option),
  );

  const stats: CleanupStats = {
    expiredPolls: 0,
    deletedVotes: 0,
    deletedOptions: 0,
    deletedPollNames: [],
  };

  try {
    console.log('🔍 Finding expired polls...');

    // Find all expired polls
    const expiredPolls = await pollRepository
      .createQueryBuilder('poll')
      .where('poll.endTime < NOW()')
      .getMany();

    console.log(`📊 Found ${expiredPolls.length} expired polls`);

    if (expiredPolls.length === 0) {
      console.log('✅ No expired polls to clean up');
      await app.close();
      return stats;
    }

    console.log('\n🗑️  Starting cleanup process...');

    for (const poll of expiredPolls) {
      console.log(`\n📋 Processing poll: "${poll.name}" (ID: ${poll.id})`);
      console.log(`   ⏰ Ended: ${poll.endTime}`);

      // Delete votes for this poll
      const votesResult = await voteRepository
        .createQueryBuilder()
        .delete()
        .where('poll_id = :pollId', { pollId: poll.id })
        .execute();

      stats.deletedVotes += votesResult.affected || 0;
      console.log(`   🗳️  Deleted ${votesResult.affected || 0} votes`);

      // Delete options for this poll
      const optionsResult = await optionRepository
        .createQueryBuilder()
        .delete()
        .where('poll_id = :pollId', { pollId: poll.id })
        .execute();

      stats.deletedOptions += optionsResult.affected || 0;
      console.log(`   📝 Deleted ${optionsResult.affected || 0} options`);

      // Delete the poll itself
      await pollRepository.delete(poll.id);
      stats.expiredPolls++;
      stats.deletedPollNames.push(poll.name);
      console.log(`   ✅ Deleted poll: "${poll.name}"`);
    }

    console.log('\n📈 Cleanup Summary:');
    console.log(`   🗳️  Polls deleted: ${stats.expiredPolls}`);
    console.log(`   🗳️  Votes deleted: ${stats.deletedVotes}`);
    console.log(`   📝 Options deleted: ${stats.deletedOptions}`);

    console.log('\n📋 Deleted Poll Names:');
    stats.deletedPollNames.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });

    console.log('\n✅ Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await app.close();
  }

  return stats;
}

// Execute the cleanup if this script is run directly
if (require.main === module) {
  cleanupExpiredPolls()
    .then((stats) => {
      console.log('\n🎉 Cleanup process finished successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Cleanup process failed:', error);
      process.exit(1);
    });
}

export { cleanupExpiredPolls, CleanupStats };
