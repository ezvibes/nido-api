import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VenueVerificationState {
  UNVERIFIED = 'unverified',
  VERIFIED = 'verified',
  FLAGGED = 'flagged',
  CANONICAL = 'canonical',
}

@Entity('venues')
export class Venue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column()
  city: string;

  @Column({ name: 'city_slug' })
  @Index('IDX_venues_city_slug')
  citySlug: string;

  @Column()
  region: string;

  @Column({ name: 'region_slug' })
  regionSlug: string;

  @Column({ name: 'postal_code', type: 'varchar', nullable: true })
  postalCode: string | null;

  @Column({ type: 'integer', nullable: true })
  capacity: number | null;

  @Column({
    name: 'verification_state',
    type: 'enum',
    enum: VenueVerificationState,
    default: VenueVerificationState.UNVERIFIED,
  })
  @Index('IDX_venues_verification_state')
  verificationState: VenueVerificationState;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
