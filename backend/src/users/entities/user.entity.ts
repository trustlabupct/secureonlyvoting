import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Vote } from '../../votes/entities/vote.entity'; // Correct path
import { UserSession } from '../../security/entities/user-session.entity';

@Entity('users')
@Unique(['username']) // Ensure username is unique at the database level
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 50, default: 'user' })
  role: string; // 'user', 'admin', etc.

  // Certificate authentication fields
  @Column({
    name: 'certificate_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  certificateId: string | null;

  @Column({
    name: 'certificate_fingerprint',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  certificateFingerprint: string | null;

  @Column({ name: 'certificate_enabled', type: 'boolean', default: false })
  certificateEnabled: boolean;

  // MFA fields
  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_secret', type: 'varchar', length: 255, nullable: true })
  mfaSecret: string | null;

  @Column({
    name: 'mfa_recovery_codes',
    type: 'text',
    array: true,
    nullable: true,
  })
  mfaRecoveryCodes: string[] | null;

  @OneToMany(() => Vote, (vote) => vote.user)
  votes: Vote[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
