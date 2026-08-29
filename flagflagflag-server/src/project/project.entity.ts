import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { EnvironmentEntity } from '../environment/environment.entity.js';

@Entity({ name: 'project' })
export class ProjectEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', unique: true })
  name!: string;

  @OneToMany(() => EnvironmentEntity, (environment) => environment.project)
  environments!: EnvironmentEntity[];
}
