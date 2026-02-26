import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rate_limits')
@Index(['ipAddress', 'endpoint'], { unique: true })
export class RateLimit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ip_address', type: 'inet' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 100 })
  endpoint: string;

  @Column({ type: 'int', default: 1 })
  attempts: number;

  @Column({ name: 'window_start', type: 'timestamp' })
  windowStart: Date;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;
}
