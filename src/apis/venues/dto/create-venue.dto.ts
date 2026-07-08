import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVenueDto {
  @ApiProperty({
    description: 'The name of the venue',
    example: 'The Evening Muse',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Full street address of the venue',
    example: '3227 N Davidson St, Charlotte, NC 28205',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'City where the venue is located',
    example: 'Charlotte',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({
    description: 'Fuzzy-matchable URL-friendly city slug',
    example: 'charlotte',
  })
  @IsString()
  @IsNotEmpty()
  citySlug: string;

  @ApiProperty({
    description: 'State or region where the venue is located',
    example: 'North Carolina',
  })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({
    description: 'Fuzzy-matchable URL-friendly region slug',
    example: 'nc',
  })
  @IsString()
  @IsNotEmpty()
  regionSlug: string;

  @ApiPropertyOptional({
    description: 'Latitude coordinates of the venue location',
    example: 35.24729,
  })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitude coordinates of the venue location',
    example: -80.80559,
  })
  @IsOptional()
  @IsNumber()
  lng?: number;
}
