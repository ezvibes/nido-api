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

export class CreateConcertDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  genre: string;

  @IsISO8601()
  startsAt: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VenueDto)
  venues: VenueDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ArtistDto)
  artists: ArtistDto[];

  @IsOptional()
  @IsString()
  description?: string;
}
