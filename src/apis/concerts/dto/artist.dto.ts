import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface Artist {
  name: string;
  role?: string;
  genre?: string;
}

export class ArtistDto implements Artist {
  @ApiProperty({
    description: 'Artist, band, DJ, or performer name.',
    example: 'DJ Luna',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Role in the lineup when known.',
    example: 'headliner',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Artist-specific genre hint.',
    example: 'Electronic',
  })
  @IsOptional()
  @IsString()
  genre?: string;
}
