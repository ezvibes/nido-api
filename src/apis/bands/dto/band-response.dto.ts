import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BandResponseDto {
  @ApiProperty({ description: 'The unique UUID of the band', example: 'd3b07384-d113-41e8-ae36-418ae1688d35' })
  id: string;

  @ApiProperty({ description: 'The name of the band / performer', example: 'The Floozies' })
  name: string;

  @ApiProperty({ description: 'Unique slug used for routing and matching', example: 'the-floozies' })
  slug: string;

  @ApiPropertyOptional({ description: 'Array of genres', example: ['funk', 'electronic'], nullable: true })
  genres: string[] | null;

  @ApiPropertyOptional({ description: 'Square or landscape promo photo URL', example: 'https://example.com/band.jpg', nullable: true })
  promoImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Spotify band page URL', example: 'https://open.spotify.com/artist/123', nullable: true })
  spotifyUrl?: string | null;

  @ApiPropertyOptional({ description: 'Instagram handle', example: 'flooziesduo', nullable: true })
  instagramHandle?: string | null;

  @ApiPropertyOptional({ description: 'Official band website URL', example: 'https://flooziesduo.com', nullable: true })
  websiteUrl?: string | null;

  @ApiProperty({ description: 'Flag to prioritize band in curation feeds', example: false })
  isFeatured: boolean;

  @ApiProperty({ description: 'Dynamic social media links', example: { youtube: 'https://youtube.com/user' } })
  socials: Record<string, string>;

  @ApiProperty({ description: 'Record creation timestamp', example: '2026-06-16T01:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ description: 'Record update timestamp', example: '2026-06-16T01:00:00.000Z' })
  updatedAt: string;
}
