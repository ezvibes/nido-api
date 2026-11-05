import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueVerificationState } from '../entities/venue.entity';

export class ListVenuesDto {
  @ApiPropertyOptional({
    description: 'Filter venues by city slug',
    example: 'charlotte',
  })
  @IsOptional()
  @IsString()
  citySlug?: string;

  @ApiPropertyOptional({
    description: 'Filter venues by region slug',
    example: 'nc',
  })
  @IsOptional()
  @IsString()
  regionSlug?: string;

  @ApiPropertyOptional({
    description: 'Filter venues by verification state',
    enum: VenueVerificationState,
    example: 'unverified',
  })
  @IsOptional()
  @IsEnum(VenueVerificationState)
  verificationState?: VenueVerificationState;
}
