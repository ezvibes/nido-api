import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VenueResponseDto {
  @ApiProperty({
    description: 'The unique UUID of the venue',
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  id: string;

  @ApiProperty({
    description: 'The name of the venue',
    example: 'The Evening Muse',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Street address of the venue',
    example: '3227 N Davidson St, Charlotte, NC 28205',
    nullable: true,
  })
  address?: string;

  @ApiProperty({
    description: 'City where the venue is located',
    example: 'Charlotte',
  })
  city: string;

  @ApiProperty({
    description: 'Fuzzy-matchable URL-friendly city slug',
    example: 'charlotte',
  })
  citySlug: string;

  @ApiProperty({
    description: 'State or region where the venue is located',
    example: 'North Carolina',
  })
  region: string;

  @ApiProperty({
    description: 'Fuzzy-matchable URL-friendly region slug',
    example: 'nc',
  })
  regionSlug: string;

  @ApiPropertyOptional({
    description: 'Latitude coordinates of the venue location',
    example: 35.24729,
    nullable: true,
  })
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitude coordinates of the venue location',
    example: -80.80559,
    nullable: true,
  })
  lng?: number;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-06-16T01:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Record last updated timestamp',
    example: '2026-06-16T01:00:00.000Z',
  })
  updatedAt: Date;
}
