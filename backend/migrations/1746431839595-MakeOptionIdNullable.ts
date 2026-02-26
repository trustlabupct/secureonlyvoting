import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeOptionIdNullable1746431839595 implements MigrationInterface {
    name = 'MakeOptionIdNullable1746431839595'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "options" DROP CONSTRAINT "options_election_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "votes_user_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "votes_election_id_fkey"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "votes_option_id_fkey"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_username"`);
        await queryRunner.query(`DROP INDEX "public"."idx_options_election_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_elections_start_time"`);
        await queryRunner.query(`DROP INDEX "public"."idx_elections_end_time"`);
        await queryRunner.query(`DROP INDEX "public"."idx_votes_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_votes_election_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_votes_option_id"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP CONSTRAINT "elections_check_times"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "votes" ALTER COLUMN "option_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "polls" ADD CONSTRAINT "CHK_2fc824c98fd180e98e8d186baa" CHECK ("end_time" > "start_time")`);
        await queryRunner.query(`ALTER TABLE "options" ADD CONSTRAINT "FK_4e0972d6db48eb74f59164ebd61" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_27be2cab62274f6876ad6a31641" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "FK_649757246b34f4ab075819e62e6" FOREIGN KEY ("option_id") REFERENCES "options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_649757246b34f4ab075819e62e6"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_176c7eedc76e4c0e41d17fe7a04"`);
        await queryRunner.query(`ALTER TABLE "votes" DROP CONSTRAINT "FK_27be2cab62274f6876ad6a31641"`);
        await queryRunner.query(`ALTER TABLE "options" DROP CONSTRAINT "FK_4e0972d6db48eb74f59164ebd61"`);
        await queryRunner.query(`ALTER TABLE "polls" DROP CONSTRAINT "CHK_2fc824c98fd180e98e8d186baa"`);
        await queryRunner.query(`ALTER TABLE "votes" ALTER COLUMN "option_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "polls" ADD CONSTRAINT "elections_check_times" CHECK ((end_time > start_time))`);
        await queryRunner.query(`CREATE INDEX "idx_votes_option_id" ON "votes" ("option_id") `);
        await queryRunner.query(`CREATE INDEX "idx_votes_election_id" ON "votes" ("poll_id") `);
        await queryRunner.query(`CREATE INDEX "idx_votes_user_id" ON "votes" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_elections_end_time" ON "polls" ("end_time") `);
        await queryRunner.query(`CREATE INDEX "idx_elections_start_time" ON "polls" ("start_time") `);
        await queryRunner.query(`CREATE INDEX "idx_options_election_id" ON "options" ("poll_id") `);
        await queryRunner.query(`CREATE INDEX "idx_users_username" ON "users" ("username") `);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "votes_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "votes_election_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "options" ADD CONSTRAINT "options_election_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
