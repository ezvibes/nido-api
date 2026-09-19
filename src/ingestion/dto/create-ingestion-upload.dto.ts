import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIngestionUploadDto {
  @ApiPropertyOptional({
    description: 'User-provided city hint for the uploaded concert asset.',
    maxLength: 120,
    example: 'Brooklyn',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({
    description: 'Two-letter state hint for the uploaded concert asset.',
    maxLength: 2,
    example: 'NY',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiPropertyOptional({
    description: 'User-selected genre hint for the uploaded concert asset.',
    maxLength: 120,
    example: 'Electronic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  genre?: string;

  @ApiPropertyOptional({
    description: 'Upload source classification.',
    enum: ['flyer_upload', 'manual_upload', 'partner_upload'],
    example: 'flyer_upload',
  })
  @IsOptional()
  @IsString()
  @IsIn(['flyer_upload', 'manual_upload', 'partner_upload'])
  @MaxLength(60)
  source?: string;

  @ApiPropertyOptional({
    description: 'User-selected concert date hint (ISO string or date string).',
    example: '2026-05-28T20:00:00.000Z',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsDateString()
  concertDate?: string;

  @ApiPropertyOptional({
    description: 'User-selected venue hint ID.',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({
    description: 'User-selected band hint ID.',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsUUID()
  bandId?: string;
}
