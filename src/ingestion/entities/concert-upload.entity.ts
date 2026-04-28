import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../apis/users/entities/user.entity';
import { IngestionJob } from './ingestion-job.entity';

@Entity({ name: 'concert_uploads' })
export class ConcertUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'storage_uri' })
  storageUri: string;

  @Column({ name: 'object_name' })
  objectName: string;

  @Column()
  bucket: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'original_filename' })
  originalFilename: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ default: 'flyer_upload' })
  source: string;

  @Column({ name: 'uploaded_by_uid' })
  uploadedByUid: string;

  @Column({ name: 'uploaded_by_user_id', nullable: true })
  uploadedByUserId?: number;

  @ManyToOne(() => User, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedByUser?: User;

  @Column({ type: 'bigint' })
  size: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => IngestionJob, (ingestionJob) => ingestionJob.concertUpload)
  ingestionJobs: IngestionJob[];
}
