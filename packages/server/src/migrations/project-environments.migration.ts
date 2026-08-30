import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class ProjectEnvironmentsMigration20260829053406510
  implements MigrationInterface
{
  name = 'ProjectEnvironmentsMigration20260829053406510';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'project',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'name', type: 'text', isUnique: true },
        ],
      }),
      true,
    );
    await queryRunner.createTable(
      new Table({
        name: 'environment',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'name', type: 'text' },
          { name: 'projectId', type: 'text' },
        ],
        uniques: [{ columnNames: ['projectId', 'name'] }],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['projectId'],
            referencedTableName: 'project',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
      true,
    );


    await queryRunner.createTable(
      new Table({
        name: 'feature_flag_normalized',
        columns: [
          { name: 'key', type: 'text', isPrimary: true },
          { name: 'environmentId', type: 'text', isPrimary: true },
          { name: 'name', type: 'text' },
          { name: 'enabled', type: 'boolean', default: false },
          { name: 'defaultValue', type: 'boolean', default: false },
          { name: 'rollout', type: 'text', isNullable: true },
          { name: 'rules', type: 'text', default: "'[]'" },
          { name: 'version', type: 'integer', default: 1 },
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
    await queryRunner.dropTable('feature_flag', true);
    await queryRunner.renameTable('feature_flag_normalized', 'feature_flag');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('feature_flag', true);
    await queryRunner.dropTable('environment', true);
    await queryRunner.dropTable('project', true);
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
}
