import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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
    description: 'Upload source classification.',
    enum: ['flyer_upload', 'manual_upload', 'partner_upload'],
    example: 'flyer_upload',
  })
  @IsOptional()
  @IsString()
  @IsIn(['flyer_upload', 'manual_upload', 'partner_upload'])
  @MaxLength(60)
  source?: string;
}
