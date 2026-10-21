import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ConcertUpload } from './concert-upload.entity';
import { IngestionStage } from '../interfaces/ingestion-enums';

@Entity({ name: 'ingestion_jobs' })
@Unique(['concertUploadId', 'pipelineVersion'])
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'concert_upload_id' })
  concertUploadId: string;

  @ManyToOne(
    () => ConcertUpload,
    (concertUpload) => concertUpload.ingestionJobs,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'concert_upload_id' })
  concertUpload: ConcertUpload;

  @Column({ name: 'pipeline_version', default: 'v1' })
  pipelineVersion: string;

  @Column({ default: 'queued' })
  status: string;

  @Column({
    type: 'enum',
    enum: IngestionStage,
    default: IngestionStage.QUEUED,
  })
  stage: IngestionStage;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', default: 5 })
  maxAttempts: number;

  @Column({ name: 'idempotency_key', unique: true })
  @Index()
  idempotencyKey: string;

  @Column({ name: 'task_name', nullable: true })
  taskName: string | null;

  @Column({ name: 'lease_owner', nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
  leaseExpiresAt: Date | null;

  @Column({ default: true })
  retryable: boolean;

  @Column({ name: 'error_code', nullable: true })
  errorCode: string | null;

  @Column({ name: 'ocr_provider', nullable: true })
  ocrProvider?: string;

  @Column({ name: 'ocr_confidence', type: 'real', nullable: true })
  ocrConfidence?: number;

  @Column({ name: 'parser_version', nullable: true })
  parserVersion?: string;

  @Column({ name: 'parse_confidence', type: 'real', nullable: true })
  parseConfidence?: number;

  @Column({ name: 'error_message', nullable: true, type: 'text' })
  errorMessage?: string;

  @Column({ name: 'ocr_text', nullable: true, type: 'text' })
  ocrText?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
