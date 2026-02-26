import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProcessingTimeToEncryptedBallots1750263000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'encrypted_ballots',
      new TableColumn({
        name: 'processing_time',
        type: 'integer',
        isNullable: true,
        default: null,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('encrypted_ballots', 'processing_time');
  }
} 