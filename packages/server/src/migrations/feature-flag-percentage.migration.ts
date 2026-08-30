import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeatureFlagPercentageMigration20260829053406520
  implements MigrationInterface
{
  name = 'FeatureFlagPercentageMigration20260829053406520';

  async up(_queryRunner: QueryRunner): Promise<void> {}

  async down(_queryRunner: QueryRunner): Promise<void> {}
}
