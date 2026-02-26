import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Poll } from '../../polls/entities/poll.entity'; // Renamed import
import { Option } from '../../polls/entities/option.entity'; // Renamed import path
import { BlindToken } from '../../blind-tokens/entities/blind-token.entity';

@Entity('votes')
@Unique('unique_user_poll_vote', ['userId', 'pollId']) // Renamed constraint, updated field
@Unique('unique_blind_token_poll_vote', ['blindTokenId', 'pollId']) // New constraint for blind tokens
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'blind_token_id', type: 'uuid', nullable: true })
  blindTokenId: string | null;

  @Column({ name: 'poll_id', type: 'uuid' }) // Renamed column
  pollId: string; // Renamed field

  @Column({ name: 'option_id', type: 'uuid', nullable: true })
  optionId: string | null;

  @Column({ name: 'rating_value', type: 'integer', nullable: true })
  ratingValue: number | null;

  @Column({
    name: 'ranked_option_ids',
    type: 'uuid',
    array: true,
    nullable: true,
  })
  rankedOptionIds: string[] | null;

  @Column({ name: 'text_response', type: 'text', nullable: true })
  textResponse: string | null;

  @Column({
    name: 'selected_option_ids',
    type: 'uuid',
    array: true,
    nullable: true,
  })
  selectedOptionIds: string[] | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ManyToOne(() => User, (user) => user.votes, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => BlindToken, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'blind_token_id' })
  blindToken: BlindToken | null;

  @ManyToOne(() => Poll, (poll) => poll.votes, {
    // Renamed entity and relation
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'poll_id' }) // Renamed join column
  poll: Poll; // Renamed field

  @ManyToOne(() => Option, (option) => option.votes, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'option_id' })
  option: Option | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // No UpdateDateColumn needed for votes as they are typically immutable
}
