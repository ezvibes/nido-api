import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const syncJobStatuses = [
  'queued',
  'processing',
  'completed',
  'failed',
] as const;

export type SyncJobStatus = (typeof syncJobStatuses)[number];

export class ListConcertSyncJobsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset: number = 0;

  @IsOptional()
  @IsIn(syncJobStatuses)
  status?: SyncJobStatus;
}
