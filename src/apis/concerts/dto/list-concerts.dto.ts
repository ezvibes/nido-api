import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const concertSortOptions = [
  'soonest',
  'featured',
  'top_picks',
  'trending_week',
] as const;
export type ConcertSortOption = (typeof concertSortOptions)[number];

export class ListConcertsDto {
  @ApiPropertyOptional({
    description:
      'Case-insensitive search over title, artist, venue, and description.',
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
