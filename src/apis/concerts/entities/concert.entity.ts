import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Venue } from '../../venues/entities/venue.entity';
import { ConcertBandLineup } from './concert-band-lineup.entity';
import { ConcertSet } from './concert-set.entity';

@Entity({ name: 'concerts' })
export class Concert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 120 })
  genre: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  @Column({ name: 'venue_id', type: 'uuid', nullable: true })
  venueId?: string | null;

  @ManyToOne(() => Venue, {
    onDelete: 'SET NULL',
    nullable: true,
    eager: true,
  })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue | null;

  @OneToMany(() => ConcertBandLineup, (cbl) => cbl.concert, {
    cascade: true,
    eager: true,
  })
  lineup: ConcertBandLineup[];

  @OneToMany(() => ConcertSet, (set) => set.concert, {
    cascade: true,
    eager: true,
  })
  sets: ConcertSet[];

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_top_pick', type: 'boolean', default: false })
  isTopPick: boolean;

  @Column({ name: 'top_pick_score', type: 'real', nullable: true })
  topPickScore?: number | null;

  @Column({
    name: 'top_pick_refreshed_at',
    type: 'timestamptz',
    nullable: true,
  })
  topPickRefreshedAt?: Date | null;

  @Column({ name: 'is_admin_approved', type: 'boolean', default: false })
  isAdminApproved: boolean;

  @Column({ name: 'admin_approved_at', type: 'timestamptz', nullable: true })
  adminApprovedAt?: Date | null;

  @Column({ name: 'admin_approved_by_user_id', type: 'integer', nullable: true })
  adminApprovedByUserId?: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
