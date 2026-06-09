import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
}
