import { IsOptional, IsUUID } from 'class-validator';

export class CreateIngestionJobDto {
  @IsOptional()
  @IsUUID()
  concertUploadId?: string;

  @IsOptional()
  @IsUUID()
  sourceAssetId?: string;
}
