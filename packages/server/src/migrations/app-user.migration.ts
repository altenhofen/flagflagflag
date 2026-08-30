import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AppUserMigration20260829061530000 implements MigrationInterface {
  name = 'AppUserMigration20260829061530000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'app_user',
        columns: [
          { name: 'id', type: 'text', isPrimary: true },
          { name: 'username', type: 'text', isUnique: true },
          { name: 'email', type: 'text', isUnique: true },
          { name: 'name', type: 'text' },
          { name: 'passwordHash', type: 'text' },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('app_user', true);
  }
}
