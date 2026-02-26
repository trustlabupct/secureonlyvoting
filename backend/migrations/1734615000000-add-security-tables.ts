import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSecurityTables1734615000000 implements MigrationInterface {
  name = 'AddSecurityTables1734615000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create rate_limits table
    await queryRunner.query(`
      CREATE TABLE "rate_limits" (
        "id" SERIAL PRIMARY KEY,
        "ip_address" INET NOT NULL,
        "endpoint" VARCHAR(100) NOT NULL,
        "attempts" INTEGER DEFAULT 1,
        "window_start" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create unique index on ip_address and endpoint
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_RATE_LIMITS_IP_ENDPOINT" 
      ON "rate_limits" ("ip_address", "endpoint")
    `);

    // Create index on window_start for cleanup queries
    await queryRunner.query(`
      CREATE INDEX "IDX_RATE_LIMITS_WINDOW_START" 
      ON "rate_limits" ("window_start")
    `);

    // Create revoked_tokens table
    await queryRunner.query(`
      CREATE TABLE "revoked_tokens" (
        "jti" VARCHAR(255) PRIMARY KEY,
        "user_id" UUID NOT NULL,
        "token_type" VARCHAR(20) DEFAULT 'access',
        "expires_at" TIMESTAMPTZ NOT NULL,
        "revoked_at" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "FK_REVOKED_TOKENS_USER_ID" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indices for revoked_tokens
    await queryRunner.query(`
      CREATE INDEX "IDX_REVOKED_TOKENS_EXPIRES_AT" 
      ON "revoked_tokens" ("expires_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_REVOKED_TOKENS_USER_ID" 
      ON "revoked_tokens" ("user_id")
    `);

    // Create user_sessions table
    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "refresh_token_hash" VARCHAR(255) UNIQUE NOT NULL,
        "ip_address" INET,
        "user_agent" TEXT,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "is_active" BOOLEAN DEFAULT TRUE,
        "created_at" TIMESTAMPTZ DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT "FK_USER_SESSIONS_USER_ID" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indices for user_sessions
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_USER_SESSIONS_REFRESH_TOKEN_HASH" 
      ON "user_sessions" ("refresh_token_hash")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_USER_SESSIONS_USER_ID" 
      ON "user_sessions" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_USER_SESSIONS_EXPIRES_AT" 
      ON "user_sessions" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TABLE "revoked_tokens"`);
    await queryRunner.query(`DROP TABLE "rate_limits"`);
  }
} 