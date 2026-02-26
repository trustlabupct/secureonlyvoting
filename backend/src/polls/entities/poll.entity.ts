import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Check,
} from 'typeorm';
import { Option } from './option.entity';
import { Vote } from '../../votes/entities/vote.entity';

export enum PollVisibility {
  EVERYONE = 'everyone',
  ADMIN_ONLY = 'admin-only',
  SPECIFIC_GROUPS = 'specific-groups',
}

export enum ShowResultsTo {
  VOTERS = 'voters',
  ADMINS = 'admins',
  EVERYONE_AFTER_CLOSE = 'everyone-after-close', // Example, can be adjusted
}

@Entity('polls')
@Check(`"end_time" > "start_time"`)
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({
    name: 'voting_mechanism',
    type: 'varchar',
    length: 50,
    default: 'multiple-choice',
  })
  votingMechanism: string;

  @Column({ name: 'rating_scale', type: 'jsonb', nullable: true })
  ratingScale: {
    min: number;
    max: number;
    step?: number;
    labels?: { min?: string; max?: string; mid?: string };
  } | null;

  @Column({ name: 'allow_comments', type: 'boolean', default: false })
  allowComments: boolean;

  @Column({
    type: 'enum',
    enum: PollVisibility,
    default: PollVisibility.EVERYONE,
  })
  visibility: PollVisibility;

  @Column({
    name: 'allowed_groups',
    type: 'varchar',
    array: true,
    nullable: true,
  })
  allowedGroups: string[] | null;

  @Column({
    name: 'show_results_to',
    type: 'enum',
    enum: ShowResultsTo,
    array: true,
    default: [ShowResultsTo.VOTERS, ShowResultsTo.ADMINS],
  })
  showResultsTo: ShowResultsTo[];

  @Column({ type: 'boolean', default: true })
  anonymous: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @OneToMany(() => Option, (option) => option.poll, { cascade: true })
  options: Option[];

  @OneToMany(() => Vote, (vote) => vote.poll, { cascade: true })
  votes: Vote[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
