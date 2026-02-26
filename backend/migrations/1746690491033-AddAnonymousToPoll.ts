import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAnonymousToPoll1746690491033 implements MigrationInterface {
    name = 'AddAnonymousToPoll1746690491033'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" ADD "anonymous" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "polls" DROP COLUMN "anonymous"`);
    }

}
