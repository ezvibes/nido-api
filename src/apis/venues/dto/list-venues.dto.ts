import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
