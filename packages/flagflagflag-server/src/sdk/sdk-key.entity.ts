import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EnvironmentEntity } from '../environment/environment.entity.js';

@Entity({ name: 'sdk_key' })
export class SdkKeyEntity {
  @PrimaryColumn({ type: 'text' }) id!: string;
  @Column({ type: 'text' }) environmentId!: string;
  @Column({ type: 'text' }) prefix!: string;
  @Column({ type: 'text', unique: true }) keyHash!: string;
  @Column({ type: 'datetime' }) createdAt!: Date;
  @Column({ type: 'datetime', nullable: true }) revokedAt!: Date | null;
  @ManyToOne(() => EnvironmentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environmentId' }) environment!: EnvironmentEntity;
}
