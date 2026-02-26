import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('blind_tokens')
@Index('idx_blind_tokens_used', ['used'])
export class BlindToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 512 })
  tokenHash: string;

  @Column({ name: 'used', type: 'boolean', default: false })
  used: boolean;

  @Column({ name: 'poll_id', type: 'uuid', nullable: true })
  pollId: string | null;

  @Column({ name: 'blinded_signature', type: 'text' })
  blindedSignature: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
