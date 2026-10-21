import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { IngestionJob } from './ingestion-job.entity';

export interface FieldProvenance {
  rawValue?: string;
  normalizedValue?: any;
  confidence?: number;
  source?: 'hint' | 'ocr' | 'extraction';
  warnings?: string[];
}

export interface CandidateProvenance {
  title?: FieldProvenance;
  date?: FieldProvenance;
  time?: FieldProvenance;
  timezone?: FieldProvenance;
  venueHints?: FieldProvenance;
  venueExtracted?: FieldProvenance;
  performerLineup?: FieldProvenance;
  genres?: FieldProvenance;
}

@Entity({ name: 'ingestion_candidates' })
export class IngestionCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ingestion_job_id', type: 'uuid' })
  ingestionJobId: string;

  @ManyToOne(() => IngestionJob, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ingestion_job_id' })
  ingestionJob: IngestionJob;

  @Column({ name: 'candidate_index', default: 0 })
  candidateIndex: number;

  @Column({ type: 'jsonb', nullable: true })
  provenance: CandidateProvenance | null;

  @Column({ name: 'suggested_venue_id', nullable: true })
  suggestedVenueId: string | null;

  @Column({ name: 'suggested_band_ids', type: 'jsonb', nullable: true })
  suggestedBandIds: string[] | null;

  @Column({ name: 'suggested_genre_ids', type: 'jsonb', nullable: true })
  suggestedGenreIds: string[] | null;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'published_concert_id', nullable: true })
  publishedConcertId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
