import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class FeatureFlagsMigration20260829053406500 implements MigrationInterface {
  name = 'FeatureFlagsMigration20260829053406500';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'feature_flag',
        columns: [
          { name: 'name', type: 'text', isPrimary: true },
          { name: 'enabled', type: 'boolean' },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('feature_flag', true);
  }
}
