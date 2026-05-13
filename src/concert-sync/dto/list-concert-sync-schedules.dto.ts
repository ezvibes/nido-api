import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { scheduleStatuses } from './update-concert-sync-schedule.dto';

export class ListConcertSyncSchedulesDto {
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
  @IsIn(scheduleStatuses)
  status?: (typeof scheduleStatuses)[number];
}
