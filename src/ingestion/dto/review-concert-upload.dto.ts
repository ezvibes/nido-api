import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UploadReviewStatus } from '../entities/concert-upload.entity';

export class ReviewConcertUploadDto {
  @IsIn(['submitted', 'approved', 'rejected', 'past'])
  status: UploadReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
