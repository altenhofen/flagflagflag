import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { ProjectEntity } from '../project/project.entity.js';

@Entity({ name: 'environment' })
@Unique('environment_project_name_uidx', ['projectId', 'name'])
export class EnvironmentEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  projectId!: string;

  @ManyToOne(() => ProjectEntity, (project) => project.environments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project!: ProjectEntity;
}
