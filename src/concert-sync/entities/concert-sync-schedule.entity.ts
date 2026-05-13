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
import { ConcertSyncJob } from './concert-sync-job.entity';

@Entity({ name: 'concert_sync_schedules' })
export class ConcertSyncSchedule {
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

  @Column({ type: 'varchar', length: 40, default: 'active' })
  status: string;

  @Column({ name: 'cadence_minutes', type: 'integer', default: 60 })
  cadenceMinutes: number;

  @Column({ name: 'lookahead_days', type: 'integer', default: 30 })
  lookaheadDays: number;

  @Column({ name: 'refresh_top_picks', type: 'boolean', default: true })
  refreshTopPicks: boolean;

  @Column({ name: 'encrypted_refresh_token', type: 'text' })
  encryptedRefreshToken: string;

  @Column({ name: 'gemini_prompt', type: 'text', nullable: true })
  geminiPrompt?: string | null;

  @Column({ name: 'gemini_context', type: 'text', nullable: true })
  geminiContext?: string | null;

  @Column({ name: 'next_run_at', type: 'timestamptz' })
  nextRunAt: Date;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt?: Date | null;

  @Column({ name: 'last_job_id', type: 'uuid', nullable: true })
  lastJobId?: string | null;

  @ManyToOne(() => ConcertSyncJob, {
    onDelete: 'SET NULL',
    eager: false,
    nullable: true,
  })
  @JoinColumn({ name: 'last_job_id' })
  lastJob?: ConcertSyncJob | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'schedule_metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  scheduleMetadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
