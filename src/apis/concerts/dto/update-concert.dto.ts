import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LineupItemDto, ConcertSetDto } from './create-concert.dto';

export class UpdateConcertDto {
  @ApiPropertyOptional({
    description: 'Updated public concert title.',
    example: 'Doctor S Presents: Neon Tide with DJ Luna',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated primary genre.',
    example: 'Electronic',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  genre?: string;

  @ApiPropertyOptional({
    description: 'Updated concert start time in ISO-8601 format.',
    example: '2026-06-16T01:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'Updated concert end time in ISO-8601 format, or null.',
    example: '2026-06-16T03:30:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601()
  endsAt?: string | null;

  @ApiPropertyOptional({
    description: 'Updated venue hosting the concert.',
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  venueId?: string;

  @ApiPropertyOptional({
    description: 'Replacement legacy band lineup list.',
    example: ['d3b07384-d113-41e8-ae36-418ae1688d35'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  bandIds?: string[];

  @ApiPropertyOptional({
    description: 'Updated performance lineup details.',
    type: [LineupItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupItemDto)
  lineup?: LineupItemDto[];

  @ApiPropertyOptional({
    description: 'Updated sets with stages and timings.',
    type: [ConcertSetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConcertSetDto)
  sets?: ConcertSetDto[];

  @ApiPropertyOptional({
    description: 'Updated public description, or null to clear it.',
    example: 'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;
}
