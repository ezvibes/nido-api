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
import { IngestionCandidate } from './ingestion-candidate.entity';
import { SourceAsset } from './source-asset.entity';

@Entity({ name: 'ingestion_jobs' })
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sourceAssetId: string;

  @ManyToOne(() => SourceAsset, (sourceAsset) => sourceAsset.ingestionJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sourceAssetId' })
  sourceAsset: SourceAsset;

  @Column({ default: 'queued' })
  status: string;

  @Column({ nullable: true })
  stage?: string;

  @Column({ nullable: true, type: 'text' })
  errorMessage?: string;

  @Column({ nullable: true, type: 'text' })
  ocrText?: string;

  @Column({ nullable: true })
  ocrProvider?: string;

  @Column({ nullable: true, type: 'float' })
  ocrConfidence?: number;

  @Column({ nullable: true, type: 'timestamptz' })
  processingStartedAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  completedAt?: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  failedAt?: Date;

  @OneToMany(() => IngestionCandidate, (candidate) => candidate.ingestionJob)
  candidates: IngestionCandidate[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
