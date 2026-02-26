import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddJtiToUserSessions1750155000000 implements MigrationInterface {
  name = 'AddJtiToUserSessions1750155000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add jti column to user_sessions table
    await queryRunner.addColumn(
      'user_sessions',
      new TableColumn({
        name: 'jti',
        type: 'varchar',
        length: '255',
        isNullable: true, // Allow null for existing sessions
      }),
    );

    // Create index on jti column for fast lookups
    await queryRunner.createIndex(
      'user_sessions',
      new TableIndex({
        name: 'IDX_USER_SESSIONS_JTI',
        columnNames: ['jti'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.dropIndex('user_sessions', 'IDX_USER_SESSIONS_JTI');

    // Drop jti column
    await queryRunner.dropColumn('user_sessions', 'jti');
  }
}
