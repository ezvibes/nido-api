import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface Venue {
  name: string;
  city?: string;
  state?: string;
  country?: string;
}

export class VenueDto implements Venue {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
