import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface Artist {
  name: string;
  role?: string;
  genre?: string;
}

export class ArtistDto implements Artist {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  genre?: string;
}
