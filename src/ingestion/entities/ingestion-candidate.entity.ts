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
import { SourceAsset } from './source-asset.entity';

@Entity({ name: 'ingestion_candidates' })
export class IngestionCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ingestionJobId: string;

  @ManyToOne(() => IngestionJob, (ingestionJob) => ingestionJob.candidates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ingestionJobId' })
  ingestionJob: IngestionJob;

  @Column()
  sourceAssetId: string;

  @ManyToOne(() => SourceAsset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceAssetId' })
  sourceAsset: SourceAsset;

  @Column({ default: 'needs_review' })
  status: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true, type: 'text' })
  description?: string;

  @Column({ nullable: true, type: 'timestamptz' })
  startAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  endAt?: Date;

  @Column({ nullable: true })
  venueName?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  region?: string;

  @Column({ nullable: true, type: 'simple-json' })
  artistNames?: string[];

  @Column({ nullable: true, type: 'simple-json' })
  genreHints?: string[];

  @Column({ nullable: true })
  parserVersion?: string;

  @Column({ nullable: true, type: 'float' })
  parseConfidence?: number;

  @Column({ nullable: true, type: 'simple-json' })
  parseWarnings?: string[];

  @Column({ nullable: true, type: 'simple-json' })
  rawExtractedFields?: Record<string, unknown>;

  @Column({ type: 'text' })
  rawOcrText: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
