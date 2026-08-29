import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'sdk_config_version' })
export class SdkConfigVersionEntity {
  @PrimaryColumn({ type: 'text' }) environmentId!: string;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'text' }) fingerprint!: string;
}
