import { MigrationInterface, QueryRunner } from 'typeorm';

export class FeatureFlagTargetingRulesMigration20260829070000000
  implements MigrationInterface
{
  name = 'FeatureFlagTargetingRulesMigration20260829070000000';

  async up(_queryRunner: QueryRunner): Promise<void> {}

  async down(_queryRunner: QueryRunner): Promise<void> {}
}
