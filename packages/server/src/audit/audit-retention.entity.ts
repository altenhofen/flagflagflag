import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'audit_retention' })
export class AuditRetentionEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'integer' })
  retentionDays!: number;

  @UpdateDateColumn()
  updatedAt!: Date;
}
