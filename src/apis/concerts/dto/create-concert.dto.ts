import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PerformanceRole } from '../entities/concert-band-lineup.entity';

export class LineupItemDto {
  @ApiProperty({
    description: 'The UUID of the band performing.',
    example: 'd3b07384-d113-41e8-ae36-418ae1688d35',
  })
  @IsUUID()
  bandId: string;

  @ApiPropertyOptional({
    description: 'Performance role / billing tier.',
    enum: PerformanceRole,
    example: PerformanceRole.HEADLINER,
  })
  @IsOptional()
  @IsEnum(PerformanceRole)
  role?: PerformanceRole;

  @ApiPropertyOptional({
    description: 'Performance billing order index (0-indexed opener to headliner).',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class ConcertSetDto {
  @ApiProperty({
    description: 'The UUID of the band performing.',
    example: 'd3b07384-d113-41e8-ae36-418ae1688d35',
  })
  @IsUUID()
  bandId: string;

  @ApiProperty({
    description: 'The stage name.',
    example: 'Main Stage',
  })
  @IsString()
  @IsNotEmpty()
  stageName: string;

  @ApiProperty({
    description: 'The start time of the set.',
    example: '2026-06-16T01:00:00.000Z',
  })
  @IsISO8601()
  startsAt: string;

  @ApiProperty({
    description: 'The end time of the set.',
    example: '2026-06-16T02:00:00.000Z',
  })
  @IsISO8601()
  endsAt: string;
}

export class CreateConcertDto {
  @ApiProperty({
    description: 'Public concert title shown in discovery surfaces.',
    example: 'Doctor S Presents: Neon Tide with DJ Luna',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Primary genre used for filtering and ranking.',
    example: 'Electronic',
  })
  @IsString()
  @IsNotEmpty()
  genre: string;

  @ApiProperty({
    description: 'Concert start time in ISO-8601 format.',
    example: '2026-06-16T01:00:00.000Z',
  })
  @IsISO8601()
  startsAt: string;

  @ApiPropertyOptional({
    description: 'Concert end time in ISO-8601 format, when known.',
    example: '2026-06-16T03:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiProperty({
    description: 'The UUID of the venue hosting the concert.',
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  @IsUUID()
  @IsNotEmpty()
  venueId: string;

  @ApiPropertyOptional({
    description: 'Legacy array of band UUIDs (backwards-compatible).',
    example: ['d3b07384-d113-41e8-ae36-418ae1688d35'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  bandIds?: string[];

  @ApiPropertyOptional({
    description: 'Rich performance lineup with role and ordering.',
    type: [LineupItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineupItemDto)
  lineup?: LineupItemDto[];

  @ApiPropertyOptional({
    description: 'Sets with stages and performance timings.',
    type: [ConcertSetDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConcertSetDto)
  sets?: ConcertSetDto[];

  @ApiPropertyOptional({
    description: 'Short public description for the concert.',
    example: 'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
