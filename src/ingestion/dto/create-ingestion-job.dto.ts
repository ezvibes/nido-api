import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIngestionJobDto {
  @ApiPropertyOptional({
    description: 'Concert upload id produced by POST /ingestion/uploads.',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  @IsOptional()
  @IsUUID()
  concertUploadId?: string;

  @ApiPropertyOptional({
    description: 'Backward-compatible alias for concertUploadId.',
    example: '87c28620-0a38-4187-89c8-c83a0246e828',
  })
  @IsOptional()
  @IsUUID()
  sourceAssetId?: string;
}
