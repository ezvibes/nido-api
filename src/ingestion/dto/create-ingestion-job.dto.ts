import { IsUUID } from 'class-validator';

export class CreateIngestionJobDto {
  @IsUUID()
  sourceAssetId: string;
}
