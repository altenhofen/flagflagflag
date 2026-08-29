import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('app_user')
export class UserEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { unique: true })
  username!: string;

  @Column('text', { unique: true })
  email!: string;

  @Column('text')
  name!: string;

  @Column('text')
  passwordHash!: string;
}
