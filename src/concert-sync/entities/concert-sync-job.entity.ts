import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../apis/users/entities/user.entity';

@Entity({ name: 'concert_sync_jobs' })
export class ConcertSyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'calendar_id', type: 'varchar', length: 255 })
  calendarId: string;

  @Column({
    name: 'calendar_timezone',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  calendarTimezone?: string | null;

  @Column({ type: 'varchar', length: 40, default: 'queued' })
  status: string;

  @Column({
    name: 'requested_range_start',
    type: 'timestamptz',
    nullable: true,
  })
  requestedRangeStart?: Date | null;

  @Column({ name: 'requested_range_end', type: 'timestamptz', nullable: true })
  requestedRangeEnd?: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'refresh_top_picks', type: 'boolean', default: true })
  refreshTopPicks: boolean;

  @Column({ name: 'total_events_fetched', type: 'integer', default: 0 })
  totalEventsFetched: number;

  @Column({ name: 'events_processed', type: 'integer', default: 0 })
  eventsProcessed: number;

  @Column({ name: 'events_created', type: 'integer', default: 0 })
  eventsCreated: number;

  @Column({ name: 'events_updated', type: 'integer', default: 0 })
  eventsUpdated: number;

  @Column({ name: 'events_skipped', type: 'integer', default: 0 })
  eventsSkipped: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'job_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  jobMetadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
