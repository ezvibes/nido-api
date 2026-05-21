import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ minimum: 15, maximum: 10080 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(7 * 24 * 60)
  @IsOptional()
  cadenceMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 180 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  @IsOptional()
  lookaheadDays?: number;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @ApiPropertyOptional({ description: 'Replaces stored encrypted refresh token.' })
  @IsString()
  @IsOptional()
  @MaxLength(4000)
  googleRefreshToken?: string;

  @ApiPropertyOptional({ enum: scheduleStatuses })
  @IsOptional()
  @IsIn(scheduleStatuses)
  status?: ScheduleStatus;
}
