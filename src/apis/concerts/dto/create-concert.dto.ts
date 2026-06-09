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
import { ArtistDto } from './artist.dto';
import { VenueDto } from './venue.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'One or more venues associated with the concert.',
    type: [VenueDto],
    example: [
      {
        name: 'The Evening Muse',
        city: 'Charlotte',
        state: 'NC',
        country: 'US',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VenueDto)
  venues: VenueDto[];

  @ApiProperty({
    description: 'One or more artists or performers in the lineup.',
    type: [ArtistDto],
    example: [
      {
        name: 'DJ Luna',
        role: 'headliner',
        genre: 'Electronic',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArtistDto)
  artists: ArtistDto[];

  @ApiPropertyOptional({
    description: 'Short public description for the concert.',
    example: 'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
