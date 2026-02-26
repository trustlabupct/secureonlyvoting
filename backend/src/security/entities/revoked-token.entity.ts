import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('revoked_tokens')
export class RevokedToken {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  jti: string; // JWT ID

  @Column({ name: 'userId', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ name: 'revokedAt', type: 'timestamp', default: () => 'NOW()' })
  revokedAt: Date;

  @Column({ name: 'expiresAt', type: 'timestamptz' })
  expiresAt: Date;
}
