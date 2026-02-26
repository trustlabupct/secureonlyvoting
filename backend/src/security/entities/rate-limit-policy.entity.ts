import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('rate_limit_policies')
export class RateLimitPolicy {
  @PrimaryColumn({ length: 100 })
  endpoint: string;

  @Column({ type: 'int' })
  maxAttempts: number;

  @Column({ type: 'int', comment: 'window size in milliseconds' })
  windowMs: number;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'human readable description of this policy',
  })
  description?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
