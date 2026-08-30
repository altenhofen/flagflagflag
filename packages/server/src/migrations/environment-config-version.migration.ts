import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class EnvironmentConfigVersionMigration20260829083000000
  implements MigrationInterface
{
  name = 'EnvironmentConfigVersionMigration20260829083000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('environment');
    if (table && !table.findColumnByName('configVersion')) {
      await queryRunner.addColumn(
        'environment',
        new TableColumn({
          name: 'configVersion',
          type: 'integer',
          default: 0,
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('environment');
    if (table?.findColumnByName('configVersion')) {
      await queryRunner.dropColumn('environment', 'configVersion');
    }
  }
}
