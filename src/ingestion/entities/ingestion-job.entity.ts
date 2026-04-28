import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConcertUpload } from './concert-upload.entity';

@Entity({ name: 'ingestion_jobs' })
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'concert_upload_id' })
  concertUploadId: string;

  @ManyToOne(() => ConcertUpload, (concertUpload) => concertUpload.ingestionJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'concert_upload_id' })
  concertUpload: ConcertUpload;

  @Column({ default: 'queued' })
  status: string;

  @Column({ nullable: true })
  stage?: string;

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
