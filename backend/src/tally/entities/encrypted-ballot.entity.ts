import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Poll } from '../../polls/entities/poll.entity';

@Entity('encrypted_ballots')
@Index('idx_encrypted_ballots_poll_id', ['pollId'])
export class EncryptedBallot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'poll_id', type: 'uuid' })
  pollId: string;

  @Column({ name: 'ciphertext', type: 'text' })
  ciphertext: string;

  @Column({ name: 'context_data', type: 'text', nullable: true })
  contextData: string | null;

  @Column({ name: 'vote_index', type: 'integer' })
  voteIndex: number;

  @Column({ name: 'processing_time', type: 'integer', nullable: true })
  processingTime: number | null;

  @ManyToOne(() => Poll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll: Poll;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
