import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../apis/users/entities/user.entity';
import { Concert } from '../../apis/concerts/entities/concert.entity';
import { ConcertSyncJob } from './concert-sync-job.entity';

@Entity({ name: 'concert_sync_events' })
@Unique('UQ_concert_sync_event_owner_calendar_event', [
  'owner',
  'calendarId',
  'calendarEventId',
])
export class ConcertSyncEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @ManyToOne(() => Concert, {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'concert_id' })
  concert?: Concert | null;

  @ManyToOne(() => ConcertSyncJob, {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'last_job_id' })
  lastJob?: ConcertSyncJob | null;

  @Column({ name: 'calendar_id', type: 'varchar', length: 255 })
  calendarId: string;

  @Column({ name: 'calendar_event_id', type: 'varchar', length: 255 })
  calendarEventId: string;

  @Column({ name: 'event_fingerprint', type: 'varchar', length: 128 })
  eventFingerprint: string;

  @Column({ name: 'source_updated_at', type: 'timestamptz', nullable: true })
  sourceUpdatedAt?: Date | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt?: Date | null;

  @Column({ name: 'extraction_confidence', type: 'real', nullable: true })
  extractionConfidence?: number | null;

  @Column({ name: 'needs_guidance', type: 'boolean', default: false })
  needsGuidance: boolean;

  @Column({
    name: 'extraction_warnings',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  extractionWarnings: string[];

  @Column({ name: 'raw_event', type: 'jsonb' })
  rawEvent: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
