import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { IngestionJob } from './ingestion-job.entity';

@Entity({ name: 'source_assets' })
export class SourceAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storageUri: string;

  @Column()
  objectName: string;

  @Column()
  bucket: string;

  @Column()
  mimeType: string;

  @Column()
  originalFilename: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ default: 'flyer_upload' })
  source: string;

  @Column()
  uploadedByUid: string;

  @Column({ type: 'bigint' })
  size: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => IngestionJob, (ingestionJob) => ingestionJob.sourceAsset)
  ingestionJobs: IngestionJob[];
}
