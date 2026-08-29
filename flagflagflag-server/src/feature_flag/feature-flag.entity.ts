import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EnvironmentEntity } from '../environment/environment.entity.js';
import type { TargetingRule } from './schemas.js';

@Entity({ name: 'feature_flag' })
export class FeatureFlagEntity {
  @PrimaryColumn({ type: 'text' })
  name!: string;

  @PrimaryColumn({ type: 'text' })
  environmentId!: string;

  @ManyToOne(() => EnvironmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environmentId' })
  environment!: EnvironmentEntity;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;
  @Column({ type: 'integer', default: 100 })
  percentage!: number;
  @Column({ type: 'simple-json', default: '[]' })
  rules!: TargetingRule[];
}
