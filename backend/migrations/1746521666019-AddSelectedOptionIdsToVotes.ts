import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSelectedOptionIdsToVotes1746521666019 implements MigrationInterface {
    name = 'AddSelectedOptionIdsToVotes1746521666019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "votes" ADD "selected_option_ids" uuid array`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "votes" DROP COLUMN "selected_option_ids"`);
    }

} 