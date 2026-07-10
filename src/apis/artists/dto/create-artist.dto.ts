import { IsNotEmpty, IsOptional, IsString, IsArray, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArtistDto {
  @ApiProperty({ description: 'The name of the artist / band', example: 'The Floozies' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Optional unique slug (auto-generated if omitted)', example: 'the-floozies' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: 'Array of genre tags', example: ['funk', 'electronic'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genres?: string[];

  @ApiPropertyOptional({ description: 'GCS or public promotional photo URL', example: 'https://example.com/artist.jpg' })
  @IsOptional()
  @IsUrl()
  promoImageUrl?: string;

  @ApiPropertyOptional({ description: 'Spotify artist page URL', example: 'https://open.spotify.com/artist/123' })
  @IsOptional()
  @IsUrl()
  spotifyUrl?: string;

  @ApiPropertyOptional({ description: 'Instagram handle', example: 'flooziesduo' })
  @IsOptional()
  @IsString()
  instagramHandle?: string;

  @ApiPropertyOptional({ description: 'Official band website URL', example: 'https://flooziesduo.com' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({ description: 'Flag to prioritize artist in curation feeds', example: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
