import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class SdkConfigVersionMigration20260829080000001
  implements MigrationInterface
{
  name = 'SdkConfigVersionMigration20260829080000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sdk_config_version',
        columns: [
          { name: 'environmentId', type: 'text', isPrimary: true },
          { name: 'version', type: 'integer' },
          { name: 'fingerprint', type: 'text' },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['environmentId'],
            referencedTableName: 'environment',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sdk_config_version', true);
  }
}
