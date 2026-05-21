import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const syncJobStatuses = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;

export type SyncJobStatus = (typeof syncJobStatuses)[number];

export class ListConcertSyncJobsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of sync jobs to return.',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Number of sync jobs to skip before returning results.',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset: number = 0;

  @ApiPropertyOptional({
    description: 'Filter jobs by lifecycle status.',
    enum: syncJobStatuses,
    example: 'completed',
  })
  @IsOptional()
  @IsIn(syncJobStatuses)
  status?: SyncJobStatus;
}
