import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const concertSortOptions = [
  'soonest',
  'latest',
  'recently_added',
  'featured',
  'top_picks',
  'trending_week',
] as const;
export type ConcertSortOption = (typeof concertSortOptions)[number];

export class ListConcertsDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive search over concert title, band, venue, and description.',
    example: 'doctor s',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact genre.',
    example: 'Electronic',
  })
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional({
    description: 'Filter by venue city name or city slug (e.g. raleigh).',
    example: 'raleigh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by venue state/region name or slug (e.g. nc).',
    example: 'nc',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({
    description: 'Filter by venue UUID for venue schedule queries.',
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({
    description: 'Filter by band UUID for artist schedule queries.',
    example: 'a91f4d62-4e82-47d2-b78c-1f542d4f0a21',
  })
  @IsOptional()
  @IsUUID()
  bandId?: string;

  @ApiPropertyOptional({
    description:
      'Only return concerts starting at or after this ISO-8601 timestamp.',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  startsAfter?: string;

  @ApiPropertyOptional({
    description:
      'Only return concerts starting before this ISO-8601 timestamp.',
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  startsBefore?: string;

  @ApiPropertyOptional({
    description: 'Sort mode for discovery results.',
    enum: concertSortOptions,
    default: 'soonest',
    example: 'soonest',
  })
  @IsOptional()
  @IsIn(concertSortOptions)
  sort?: ConcertSortOption = 'soonest';

  @ApiPropertyOptional({
    description: 'Page number.',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description: 'Number of concerts per page.',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
