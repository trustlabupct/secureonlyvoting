import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateBlindTokenTable1750160000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'blind_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'token_hash',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'used',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'poll_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'blinded_signature',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['poll_id'],
            referencedTableName: 'polls',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "idx_blind_tokens_user_id" 
      ON "blind_tokens" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_blind_tokens_used" 
      ON "blind_tokens" ("used")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_blind_tokens_expires_at" 
      ON "blind_tokens" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('blind_tokens');
  }
}
