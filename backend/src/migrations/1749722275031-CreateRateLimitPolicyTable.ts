import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRateLimitPolicyTable1749722275031
  implements MigrationInterface
{
  name = 'CreateRateLimitPolicyTable1749722275031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_USER_SESSIONS_USER_ID"`,
    );
    await queryRunner.query(
      `ALTER TABLE "polls" DROP CONSTRAINT "FK_polls_created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" DROP CONSTRAINT "FK_REVOKED_TOKENS_USER_ID"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_USER_SESSIONS_REFRESH_TOKEN_HASH"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_USER_SESSIONS_USER_ID"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_USER_SESSIONS_EXPIRES_AT"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_USERS_CERTIFICATE_ID"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_REVOKED_TOKENS_EXPIRES_AT"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_REVOKED_TOKENS_USER_ID"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_RATE_LIMITS_IP_ENDPOINT"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_RATE_LIMITS_WINDOW_START"`,
    );

    // Create rate_limit_policies table
    await queryRunner.query(
      `CREATE TABLE "rate_limit_policies" ("endpoint" character varying(100) NOT NULL, "maxAttempts" integer NOT NULL, "windowMs" integer NOT NULL, "description" text, "isActive" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_59fad8b146cc27122741cbbf638" PRIMARY KEY ("endpoint")); COMMENT ON COLUMN "rate_limit_policies"."windowMs" IS 'window size in milliseconds'; COMMENT ON COLUMN "rate_limit_policies"."description" IS 'human readable description of this policy'`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ALTER COLUMN "is_active" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ALTER COLUMN "token_type" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ALTER COLUMN "revoked_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ALTER COLUMN "revoked_at" SET DEFAULT NOW()`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ALTER COLUMN "attempts" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" DROP COLUMN "window_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ADD "window_start" TIMESTAMP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_79d580cb1badf46c959a398176" ON "rate_limits" ("ip_address", "endpoint") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ADD CONSTRAINT "FK_483872b2fdc8f1ec750c9c7567c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Seed comprehensive rate limit policies using UPSERT for idempotency
    await queryRunner.query(`
            INSERT INTO rate_limit_policies (endpoint, "maxAttempts", "windowMs", description) VALUES
            ('POST:/auth/login', 5, 60000, 'Login attempts - 5 per minute'),
            ('POST:/auth/refresh', 10, 60000, 'Token refresh - 10 per minute'),
            ('POST:/auth/logout', 20, 60000, 'Logout requests - 20 per minute'),
            ('GET:/auth/profile', 30, 60000, 'Profile requests - 30 per minute'),
            ('POST:/votes', 3, 60000, 'Vote submissions - 3 per minute (strict)'),
            ('GET:/votes/check', 15, 60000, 'Vote status checks - 15 per minute'),
            ('GET:/polls', 20, 60000, 'Poll list requests - 20 per minute'),
            ('GET:/polls/:id', 30, 60000, 'Individual poll views - 30 per minute'),
            ('GET:/polls/:id/results', 15, 60000, 'Poll results - 15 per minute'),
            ('GET:/polls/:id/vote-count', 25, 60000, 'Vote count requests - 25 per minute'),
            ('POST:/admin/polls', 5, 300000, 'Admin poll creation - 5 per 5 minutes'),
            ('PUT:/admin/polls/:id', 10, 300000, 'Admin poll updates - 10 per 5 minutes'),
            ('DELETE:/admin/polls/:id', 3, 300000, 'Admin poll deletion - 3 per 5 minutes'),
            ('GET:/admin/security/metrics', 1, 60000, 'Security metrics viewing - 1 per minute (admin only)'),
            ('GET:/admin/security/performance', 5, 300000, 'Performance stats - 5 per 5 minutes'),
            ('GET:/admin/security/health', 30, 60000, 'Health check requests - 30 per minute'),
            ('POST:/admin/security/policies', 5, 300000, 'Policy management - 5 per 5 minutes'),
            ('POST:/admin/security/policies/refresh', 1, 60000, 'Policy cache refresh - 1 per minute'),
            ('POST:/admin/security/cleanup', 3, 300000, 'Manual cleanup operations - 3 per 5 minutes'),
            ('POST:/admin/security/test-metrics', 10, 60000, 'Test metrics endpoint - 10 per minute')
            ON CONFLICT (endpoint) DO UPDATE SET
                "maxAttempts" = EXCLUDED."maxAttempts",
                "windowMs" = EXCLUDED."windowMs",
                description = EXCLUDED.description,
                "updated_at" = now()
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" DROP CONSTRAINT "FK_483872b2fdc8f1ec750c9c7567c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_79d580cb1badf46c959a398176"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ADD "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" DROP COLUMN "window_start"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ADD "window_start" TIMESTAMP WITH TIME ZONE NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "rate_limits" ALTER COLUMN "attempts" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ALTER COLUMN "revoked_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ALTER COLUMN "revoked_at" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ALTER COLUMN "token_type" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ALTER COLUMN "is_active" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(`DROP TABLE "rate_limit_policies"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_RATE_LIMITS_WINDOW_START" ON "rate_limits" ("window_start") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_RATE_LIMITS_IP_ENDPOINT" ON "rate_limits" ("ip_address", "endpoint") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_REVOKED_TOKENS_USER_ID" ON "revoked_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_REVOKED_TOKENS_EXPIRES_AT" ON "revoked_tokens" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_USERS_CERTIFICATE_ID" ON "users" ("certificate_id") WHERE (certificate_id IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_USER_SESSIONS_EXPIRES_AT" ON "user_sessions" ("expires_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_USER_SESSIONS_USER_ID" ON "user_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_USER_SESSIONS_REFRESH_TOKEN_HASH" ON "user_sessions" ("refresh_token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ADD CONSTRAINT "FK_REVOKED_TOKENS_USER_ID" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "polls" ADD CONSTRAINT "FK_polls_created_by_user_id" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_USER_SESSIONS_USER_ID" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
