import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { scheduleStatuses } from './update-concert-sync-schedule.dto';

export class ListConcertSyncSchedulesDto {
  @ApiPropertyOptional({
    description: 'Maximum number of sync schedules to return.',
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
    description: 'Number of sync schedules to skip before returning results.',
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
    description: 'Filter autonomous sync schedules by lifecycle status.',
    enum: scheduleStatuses,
    example: 'active',
  })
  @IsOptional()
  @IsIn(scheduleStatuses)
  status?: (typeof scheduleStatuses)[number];
}
