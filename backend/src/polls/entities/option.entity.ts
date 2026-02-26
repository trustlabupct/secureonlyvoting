import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Poll } from './poll.entity'; // Renamed entity
import { Vote } from '../../votes/entities/vote.entity';

@Entity('options')
export class Option {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'poll_id', type: 'uuid' }) // Renamed column
  pollId: string; // Renamed field

  @ManyToOne(() => Poll, (poll) => poll.options, {
    // Renamed entity and relation
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'poll_id' }) // Renamed foreign key column
  poll: Poll; // Renamed field

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @OneToMany(() => Vote, (vote) => vote.option)
  votes: Vote[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
