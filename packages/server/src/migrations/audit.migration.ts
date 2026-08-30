import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AuditMigration20260829090000 implements MigrationInterface {
  name = 'AuditMigration20260829090000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const timestampType =
      queryRunner.connection.options.type === 'postgres'
        ? 'timestamp with time zone'
        : 'datetime';

    await queryRunner.createTable(
      new Table({
        name: 'audit_entry',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'projectId', type: 'text' },
          {
            name: 'createdAt',
            type: timestampType,
            default: 'CURRENT_TIMESTAMP',
          },
          { name: 'actorId', type: 'text' },
          { name: 'action', type: 'text' },
          { name: 'resourceType', type: 'text' },
          { name: 'resourceId', type: 'text' },
          { name: 'environmentId', type: 'text', isNullable: true },
          { name: 'summary', type: 'text' },
          { name: 'before', type: 'text', isNullable: true },
          { name: 'after', type: 'text', isNullable: true },
        ],
      }),
      true,
    );
    const table = await queryRunner.getTable('audit_entry');
    if (
      !table?.indices.some(
        (index) => index.name === 'idx_audit_project_created',
      )
    ) {
      await queryRunner.createIndex(
        'audit_entry',
        new TableIndex({
          name: 'idx_audit_project_created',
          columnNames: ['projectId', 'createdAt', 'id'],
        }),
      );
    }
    await queryRunner.createTable(
      new Table({
        name: 'audit_retention',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'retentionDays', type: 'integer' },
          {
            name: 'updatedAt',
            type: timestampType,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_retention', true);
    await queryRunner.dropTable('audit_entry', true);
  }
}
