import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMFAFields1750154471600 implements MigrationInterface {
  name = 'AddMFAFields1750154471600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_USER_SESSIONS_USER_ID"`,
    );
    await queryRunner.query(
      `ALTER TABLE "polls" DROP CONSTRAINT "FK_polls_created_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "votes" DROP CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04"`,
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
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mfa_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mfa_secret" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "mfa_recovery_codes" text array`,
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
      `ALTER TABLE "votes" ADD CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" ADD CONSTRAINT "FK_483872b2fdc8f1ec750c9c7567c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "revoked_tokens" DROP CONSTRAINT "FK_483872b2fdc8f1ec750c9c7567c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "votes" DROP CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04"`,
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
      `ALTER TABLE "users" DROP COLUMN "mfa_recovery_codes"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_secret"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_enabled"`);
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
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
      `ALTER TABLE "votes" ADD CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "polls" ADD CONSTRAINT "FK_polls_created_by_user_id" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_USER_SESSIONS_USER_ID" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
