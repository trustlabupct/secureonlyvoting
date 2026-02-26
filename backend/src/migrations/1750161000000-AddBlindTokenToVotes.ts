import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlindTokenToVotes1750161000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add blind_token_id column to votes table
    await queryRunner.query(`
      ALTER TABLE "votes" 
      ADD COLUMN "blind_token_id" UUID NULL
    `);

    // Make user_id nullable for anonymous votes
    await queryRunner.query(`
      ALTER TABLE "votes" 
      ALTER COLUMN "user_id" DROP NOT NULL
    `);

    // Add foreign key constraint for blind_token_id
    await queryRunner.query(`
      ALTER TABLE "votes" 
      ADD CONSTRAINT "FK_votes_blind_token_id" 
      FOREIGN KEY ("blind_token_id") 
      REFERENCES "blind_tokens"("id") 
      ON DELETE RESTRICT
    `);

    // Add unique constraint for blind_token_id and poll_id
    await queryRunner.query(`
      ALTER TABLE "votes" 
      ADD CONSTRAINT "unique_blind_token_poll_vote" 
      UNIQUE ("blind_token_id", "poll_id")
    `);

    // Create index for blind_token_id
    await queryRunner.query(`
      CREATE INDEX "idx_votes_blind_token_id" 
      ON "votes" ("blind_token_id")
    `);

    // Add check constraint to ensure either user_id or blind_token_id is provided
    await queryRunner.query(`
      ALTER TABLE "votes" 
      ADD CONSTRAINT "check_user_or_blind_token" 
      CHECK (
        (user_id IS NOT NULL AND blind_token_id IS NULL) OR 
        (user_id IS NULL AND blind_token_id IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove check constraint
    await queryRunner.query(`
      ALTER TABLE "votes" 
      DROP CONSTRAINT "check_user_or_blind_token"
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX "idx_votes_blind_token_id"
    `);

    // Drop unique constraint
    await queryRunner.query(`
      ALTER TABLE "votes" 
      DROP CONSTRAINT "unique_blind_token_poll_vote"
    `);

    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "votes" 
      DROP CONSTRAINT "FK_votes_blind_token_id"
    `);

    // Make user_id NOT NULL again
    await queryRunner.query(`
      ALTER TABLE "votes" 
      ALTER COLUMN "user_id" SET NOT NULL
    `);

    // Drop blind_token_id column
    await queryRunner.query(`
      ALTER TABLE "votes" 
      DROP COLUMN "blind_token_id"
    `);
  }
}
