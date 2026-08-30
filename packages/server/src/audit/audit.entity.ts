import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'audit_entry' })
export class AuditEntryEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  projectId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'text' })
  actorId!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text' })
  resourceType!: string;

  @Column({ type: 'text' })
  resourceId!: string;

  @Column({ type: 'text', nullable: true })
  environmentId!: string | null;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'simple-json', nullable: true, default: null })
  before!: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true, default: null })
  after!: Record<string, unknown> | null;
}
