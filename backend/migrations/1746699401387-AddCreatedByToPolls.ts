import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddCreatedByToPolls1746699401387 implements MigrationInterface {
    name = 'AddCreatedByToPolls1746699401387'

    // Define the foreign key name for easier rollback
    private readonly fkName = "FK_polls_created_by_user_id";

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if 'createdBy' (camelCase) column exists and drop it.
        const table = await queryRunner.getTable("polls");
        if (table) { // Ensure table is defined
            const oldColumn = table.columns.find(col => col.name === "createdBy");
            if (oldColumn) {
                await queryRunner.dropColumn("polls", "createdBy");
            }
        }

        // Add the correctly named column 'created_by'
        await queryRunner.addColumn("polls", new TableColumn({
            name: "created_by",
            type: "uuid",
            isNullable: true, // As per entity definition
        }));

        // Add the foreign key constraint
        await queryRunner.createForeignKey("polls", new TableForeignKey({
            name: this.fkName,
            columnNames: ["created_by"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "SET NULL", 
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the foreign key first
        const table = await queryRunner.getTable("polls");
        if (table) { // Ensure table is defined
            const foreignKey = table.foreignKeys.find(fk => fk.name === this.fkName);
            if (foreignKey) {
                await queryRunner.dropForeignKey("polls", this.fkName);
            }
            
            // Drop the column
            const column = table.columns.find(col => col.name === "created_by");
            if (column) {
                await queryRunner.dropColumn("polls", "created_by");
            }
        }
    }

}
