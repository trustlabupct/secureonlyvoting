import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddPollPermissions1746525597423 implements MigrationInterface {
    name = 'AddPollPermissions1746525597423'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."polls_visibility_enum" AS ENUM('everyone', 'admin-only', 'specific-groups')`);
        await queryRunner.addColumn("polls", new TableColumn({
            name: "visibility",
            type: "enum",
            enumName: "polls_visibility_enum",
            default: "'everyone'",
            isNullable: false,
        }));

        await queryRunner.addColumn("polls", new TableColumn({
            name: "allowed_groups",
            type: "varchar",
            isArray: true,
            isNullable: true,
        }));
        
        await queryRunner.query(`CREATE TYPE "public"."polls_show_results_to_enum" AS ENUM('voters', 'admins', 'everyone-after-close')`);
        await queryRunner.addColumn("polls", new TableColumn({
            name: "show_results_to",
            type: "enum",
            enumName: "polls_show_results_to_enum",
            isArray: true,
            default: "'{voters,admins}'", // Default for array enum
            isNullable: false,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("polls", "show_results_to");
        await queryRunner.query(`DROP TYPE "public"."polls_show_results_to_enum"`);
        await queryRunner.dropColumn("polls", "allowed_groups");
        await queryRunner.dropColumn("polls", "visibility");
        await queryRunner.query(`DROP TYPE "public"."polls_visibility_enum"`);
    }

}
