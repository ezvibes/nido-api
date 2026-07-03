import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UploadReviewStatus } from '../entities/concert-upload.entity';

export class IngestionUploadResponseDto {
  @ApiProperty({ example: '87c28620-0a38-4187-89c8-c83a0246e828' })
  concertUploadId: string;

  @ApiProperty({ example: 'nido-ingestion-dev' })
  bucket: string;

  @ApiProperty({
    example: 'ingestion/dev-user/87c28620-0a38-4187-89c8-c83a0246e828.jpg',
  })
  objectName: string;

  @ApiProperty({
    example:
      'gs://nido-ingestion-dev/ingestion/dev-user/87c28620-0a38-4187-89c8-c83a0246e828.jpg',
  })
  storageUri: string;

  @ApiProperty({ example: 'image/jpeg' })
  contentType: string;

  @ApiProperty({ example: 245913 })
  size: number;

  @ApiProperty({ example: 'doctor-s-flyer.jpg' })
  originalFilename: string;

  @ApiPropertyOptional({ example: 'Charlotte' })
  city?: string;

  @ApiPropertyOptional({ example: 'NC' })
  state?: string;

  @ApiProperty({ example: 'flyer_upload' })
  source: string;

  @ApiPropertyOptional({ example: 7 })
  uploadedByUserId?: number;

  @ApiProperty({ example: '2026-05-28T23:40:28.817Z' })
  uploadedAt: string;
}

export class AdminConcertUploadResponseDto {
  @ApiProperty({ example: '87c28620-0a38-4187-89c8-c83a0246e828' })
  id: string;

  @ApiProperty({
    example:
      'gs://nido-ingestion-dev/ingestion/dev-user/87c28620-0a38-4187-89c8-c83a0246e828.jpg',
  })
  storageUri: string;

  @ApiProperty({ example: 'nido-ingestion-dev' })
  bucket: string;

  @ApiProperty({
    example: 'ingestion/dev-user/87c28620-0a38-4187-89c8-c83a0246e828.jpg',
  })
  objectName: string;

  @ApiProperty({ example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ example: 'doctor-s-flyer.jpg' })
  originalFilename: string;

  @ApiProperty({ example: 245913 })
  size: number;

  @ApiPropertyOptional({ example: 'Charlotte' })
  city?: string;

  @ApiPropertyOptional({ example: 'NC' })
  state?: string;

  @ApiProperty({ example: 'flyer_upload' })
  source: string;

  @ApiProperty({ example: 'dev-user' })
  uploadedByUid: string;

  @ApiPropertyOptional({ example: 7 })
  uploadedByUserId?: number;

  @ApiPropertyOptional({ example: 'dev@example.local' })
  uploadedByUserEmail?: string;

  @ApiProperty({ example: '2026-05-28T23:40:28.817Z' })
  createdAt: string;

  @ApiProperty({
    enum: ['submitted', 'approved', 'rejected', 'past'],
    example: 'submitted',
  })
  reviewStatus: UploadReviewStatus;

  @ApiPropertyOptional({ example: 'Looks valid for review.' })
  reviewNotes?: string;

  @ApiPropertyOptional({ example: '2026-05-28T23:47:20.531Z' })
  reviewedAt?: string;

  @ApiPropertyOptional({ example: 7 })
  reviewedByUserId?: number;

  @ApiPropertyOptional({ example: 'admin@example.local' })
  reviewedByUserEmail?: string;

  @ApiPropertyOptional({ example: '87c28620-0a38-4187-89c8-c83a0246e828' })
  concertId?: string;
}

export class AdminConcertUploadListResponseDto {
  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ type: [AdminConcertUploadResponseDto] })
  items: AdminConcertUploadResponseDto[];
}
