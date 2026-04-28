import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateIngestionUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @IsIn(['flyer_upload', 'manual_upload', 'partner_upload'])
  @MaxLength(60)
  source?: string;
}
