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
import { Concert } from '../../apis/concerts/entities/concert.entity';
import { Venue } from '../../apis/venues/entities/venue.entity';
import { Band } from '../../apis/bands/entities/band.entity';
import { IngestionJob } from './ingestion-job.entity';

export type UploadReviewStatus = 'submitted' | 'approved' | 'rejected' | 'past';

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

  @Column({ type: 'varchar', length: 120, nullable: true })
  genre?: string | null;

  @Column({ name: 'concert_date', type: 'timestamptz', nullable: true })
  concertDate?: Date | null;

  @Column({ name: 'venue_id', type: 'uuid', nullable: true })
  venueId?: string | null;

  @ManyToOne(() => Venue, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'venue_id' })
  venue?: Venue | null;

  @Column({ name: 'band_id', type: 'uuid', nullable: true })
  bandId?: string | null;

  @ManyToOne(() => Band, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'band_id' })
  band?: Band | null;

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

  @Column({ name: 'review_status', default: 'submitted' })
  reviewStatus: UploadReviewStatus;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'reviewed_by_user_id', nullable: true })
  reviewedByUserId?: number;

  @ManyToOne(() => User, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedByUser?: User;

  @Column({ name: 'concert_id', type: 'uuid', nullable: true })
  concertId?: string | null;

  @ManyToOne(() => Concert, {
    eager: false,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'concert_id' })
  concert?: Concert | null;

  @OneToMany(() => IngestionJob, (ingestionJob) => ingestionJob.concertUpload)
  ingestionJobs: IngestionJob[];
}
