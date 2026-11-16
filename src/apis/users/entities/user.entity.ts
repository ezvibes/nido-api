import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Venue } from '../../venues/entities/venue.entity';

export type VenueClaimStatus = 'none' | 'pending' | 'verified';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  uid: string;

  @Column({ nullable: true })
  picture?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @Column({ name: 'claimed_venue_id', type: 'uuid', nullable: true })
  claimedVenueId?: string | null;

  @ManyToOne(() => Venue, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'claimed_venue_id' })
  claimedVenue?: Venue | null;

  @Column({
    name: 'venue_claim_status',
    type: 'varchar',
    length: 32,
    default: 'none',
  })
  venueClaimStatus: VenueClaimStatus;

  @Column({
    name: 'onboarding_completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  onboardingCompletedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
