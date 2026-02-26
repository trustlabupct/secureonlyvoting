import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    name: 'refresh_token_hash',
  })
  refreshTokenHash: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'jti',
  })
  @Index('IDX_USER_SESSIONS_JTI')
  jti: string | null;

  @Column({ type: 'inet', nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}
