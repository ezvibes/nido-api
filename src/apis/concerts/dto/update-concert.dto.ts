import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { VenueDto } from './venue.dto';
import { ArtistDto } from './artist.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Replacement venue list.',
    type: [VenueDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VenueDto)
  venues?: VenueDto[];

  @ApiPropertyOptional({
    description: 'Replacement artist list.',
    type: [ArtistDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArtistDto)
  artists?: ArtistDto[];

  @ApiPropertyOptional({
    description: 'Updated public description, or null to clear it.',
    example: 'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;
}
