import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const SOURCE_TYPES = ['flyer_upload', 'poster_upload', 'partner_submission'] as const;

export class CreateIngestionUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  citySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  regionSlug?: string;

  @IsOptional()
  @IsString()
  @IsIn(SOURCE_TYPES)
  sourceType?: (typeof SOURCE_TYPES)[number];
}
