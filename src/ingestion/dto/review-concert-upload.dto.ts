import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { UploadReviewStatus } from '../entities/concert-upload.entity';

export class ReviewConcertUploadDto {
  @ApiProperty({
    description: 'Admin review decision for an uploaded concert asset.',
    enum: ['submitted', 'approved', 'rejected', 'past'],
    example: 'approved',
  })
  @IsIn(['submitted', 'approved', 'rejected', 'past'])
  status: UploadReviewStatus;

  @ApiPropertyOptional({
    description: 'Optional private admin review note.',
    maxLength: 2000,
    example: 'Looks valid; approve for ingestion job creation.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Concert title to publish when approving the upload. Required for approved uploads.',
    example: 'Doctor S at The Pour House',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  concertTitle?: string;

  @ApiPropertyOptional({
    description:
      'Genre label to publish when approving the upload. Defaults to Live Music.',
    example: 'Live Music',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  concertGenre?: string;

  @ApiPropertyOptional({
    description:
      'Start date/time to publish when approving the upload. Required for approved uploads.',
    example: '2026-07-10T23:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  concertStartsAt?: string;

  @ApiPropertyOptional({
    description:
      'Primary venue name to publish when approving the upload. Defaults to Venue TBD.',
    example: 'The Pour House',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  concertVenueName?: string;

  @ApiPropertyOptional({
    description:
      'Primary artist/lineup name to publish when approving the upload. Defaults to the concert title.',
    example: 'Doctor S',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  concertArtistName?: string;

  @ApiPropertyOptional({
    description: 'Public description to publish when approving the upload.',
    example: 'Uploaded flyer approved by admin review.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  concertDescription?: string;
}
