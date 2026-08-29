import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, VersionColumn } from 'typeorm';
import { EnvironmentEntity } from '../environment/environment.entity.js';
import type { Rollout, TargetingRule } from './schemas.js';

@Entity({ name: 'feature_flag' })
export class FeatureFlagEntity {
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @PrimaryColumn({ type: 'text' })
  environmentId!: string;

  @Column({ type: 'text' })
  name!: string;

  @ManyToOne(() => EnvironmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environmentId' })
  environment!: EnvironmentEntity;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'boolean', default: false })
  defaultValue!: boolean;

  @Column({ type: 'simple-json', nullable: true, default: null })
  rollout!: Rollout | null;

  @Column({ type: 'simple-json', default: '[]' })
  rules!: TargetingRule[];
  @VersionColumn()
  version!: number;
}
