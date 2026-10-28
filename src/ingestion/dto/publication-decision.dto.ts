import { IsString, IsOptional, IsArray, IsIn, IsNumber, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublishCandidateDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  date: string; // YYYY-MM-DD

  @ApiProperty()
  @IsString()
  time: string; // HH:mm

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venueName?: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  bandIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bandNames?: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  genreIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty()
  @IsNumber()
  reviewDurationMs: number;
}

export class DuplicateDecisionDto {
  @ApiProperty({ enum: ['link', 'merge', 'publish_separately', 'reject'] })
  @IsIn(['link', 'merge', 'publish_separately', 'reject'])
  decision: 'link' | 'merge' | 'publish_separately' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetConcertId?: string;

  @ApiPropertyOptional({ type: PublishCandidateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublishCandidateDto)
  publishData?: PublishCandidateDto;

  @ApiProperty()
  @IsNumber()
  reviewDurationMs: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectReason?: string;
}

export class RejectCandidateDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
