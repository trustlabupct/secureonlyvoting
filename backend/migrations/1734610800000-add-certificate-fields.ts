import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCertificateFields1734610800000 implements MigrationInterface {
  name = 'AddCertificateFields1734610800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add certificate_id column with unique constraint
    await queryRunner.addColumn('users', new TableColumn({
      name: 'certificate_id',
      type: 'varchar',
      length: '255',
      isNullable: true,
      isUnique: true,
    }));

    // Add certificate_fingerprint column
    await queryRunner.addColumn('users', new TableColumn({
      name: 'certificate_fingerprint',
      type: 'varchar',
      length: '64',
      isNullable: true,
    }));

    // Add certificate_enabled column
    await queryRunner.addColumn('users', new TableColumn({
      name: 'certificate_enabled',
      type: 'boolean',
      default: false,
    }));

    // Create index for certificate_id lookups
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_USERS_CERTIFICATE_ID" 
      ON "users" ("certificate_id") 
      WHERE "certificate_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_USERS_CERTIFICATE_ID"');

    // Drop columns
    await queryRunner.dropColumn('users', 'certificate_enabled');
    await queryRunner.dropColumn('users', 'certificate_fingerprint');
    await queryRunner.dropColumn('users', 'certificate_id');
  }
} 