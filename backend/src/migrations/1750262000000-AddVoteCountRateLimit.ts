import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoteCountRateLimit1750262000000 implements MigrationInterface {
  name = 'AddVoteCountRateLimit1750262000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Insert the missing rate limit policy for vote count endpoint
    await queryRunner.query(`
            INSERT INTO "rate_limit_policies" 
            ("endpoint", "max_attempts", "window_ms", "description", "is_active", "created_at", "updated_at") 
            VALUES 
            ('GET:/api/polls/:id/vote-count', 30, 60000, 'Vote count requests - 30 per minute', true, NOW(), NOW())
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the rate limit policy
    await queryRunner.query(`
            DELETE FROM "rate_limit_policies" 
            WHERE "endpoint" = 'GET:/api/polls/:id/vote-count'
        `);
  }
}
