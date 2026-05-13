import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const scheduleStatuses = ['active', 'paused'] as const;
export type ScheduleStatus = (typeof scheduleStatuses)[number];

export class UpdateConcertSyncScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(7 * 24 * 60)
  @IsOptional()
  cadenceMinutes?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  @IsOptional()
  lookaheadDays?: number;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @IsString()
  @IsOptional()
  @MaxLength(4000)
  googleRefreshToken?: string;

  @IsOptional()
  @IsIn(scheduleStatuses)
  status?: ScheduleStatus;
}
