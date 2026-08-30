import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class SdkKeysMigration20260829080000000 implements MigrationInterface {
  name = 'SdkKeysMigration20260829080000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const timestampType =
      queryRunner.connection.options.type === 'postgres'
        ? 'timestamp with time zone'
        : 'datetime';
    await queryRunner.createTable(
      new Table({
        name: 'sdk_key',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'environmentId', type: 'text' },
          { name: 'prefix', type: 'text' },
          { name: 'keyHash', type: 'text', isUnique: true },
          { name: 'createdAt', type: timestampType },
          { name: 'revokedAt', type: timestampType, isNullable: true },
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
    await queryRunner.dropTable('sdk_key', true);
  }
}
