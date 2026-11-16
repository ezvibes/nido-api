import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
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

  @ApiPropertyOptional({
    description: 'Direct ticket purchase URL, or null/empty to clear.',
    maxLength: 1000,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  ticketUrl?: string | null;

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
