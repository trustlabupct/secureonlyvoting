import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_metrics')
export class AppMetrics {
  @PrimaryColumn()
  name: string;

  @Column({ type: 'bigint', default: 0 })
  count: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'last_updated' })
  lastUpdated: Date;
}
