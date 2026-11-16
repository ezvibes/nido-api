import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Venue } from '../../venues/entities/venue.entity';
import { User } from './user.entity';

export type VenuePartnerInviteStatus = 'active' | 'redeemed' | 'revoked';

@Entity('venue_partner_invites')
export class VenuePartnerInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  code: string;

  @Column({ name: 'venue_id', type: 'uuid' })
  venueId: string;

  @ManyToOne(() => Venue, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({
    name: 'invited_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  invitedEmail?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: VenuePartnerInviteStatus;

  @Column({ name: 'redeemed_by_user_id', type: 'integer', nullable: true })
  redeemedByUserId?: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'redeemed_by_user_id' })
  redeemedByUser?: User | null;

  @Column({ name: 'redeemed_at', type: 'timestamptz', nullable: true })
  redeemedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'created_by_user_id', type: 'integer', nullable: true })
  createdByUserId?: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
