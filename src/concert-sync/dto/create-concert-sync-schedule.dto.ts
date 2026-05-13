import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateConcertSyncScheduleDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  calendarId?: string;

  @IsString()
  @MaxLength(4000)
  googleRefreshToken: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(7 * 24 * 60)
  @IsOptional()
  cadenceMinutes?: number = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  @IsOptional()
  lookaheadDays?: number = 30;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean = true;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  runImmediately?: boolean = true;
}
