import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VenueVerificationState } from '../entities/venue.entity';

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
    description: 'Postal or ZIP code of the venue',
    example: '28205',
  })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Audience capacity of the venue',
    example: 750,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Verification state of the venue in the catalog',
    enum: VenueVerificationState,
    default: VenueVerificationState.UNVERIFIED,
    example: 'unverified',
  })
  @IsOptional()
  @IsEnum(VenueVerificationState)
  verificationState?: VenueVerificationState;
}
