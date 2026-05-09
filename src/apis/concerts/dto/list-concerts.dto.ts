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

export const concertSortOptions = [
  'soonest',
  'featured',
  'trending_week',
] as const;
export type ConcertSortOption = (typeof concertSortOptions)[number];

export class ListConcertsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsISO8601()
  startsAfter?: string;

  @IsOptional()
  @IsISO8601()
  startsBefore?: string;

  @IsOptional()
  @IsIn(concertSortOptions)
  sort?: ConcertSortOption = 'soonest';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
