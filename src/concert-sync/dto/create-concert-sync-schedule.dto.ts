import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ default: 'primary' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  calendarId?: string;

  @ApiProperty({
    description: 'Google OAuth refresh token. Stored encrypted at rest.',
  })
  @IsString()
  @MaxLength(4000)
  googleRefreshToken: string;

  @ApiPropertyOptional({ default: 60, minimum: 15, maximum: 10080 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(7 * 24 * 60)
  @IsOptional()
  cadenceMinutes?: number = 60;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 180 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(180)
  @IsOptional()
  lookaheadDays?: number = 30;

  @ApiPropertyOptional({ default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean = true;

  @ApiPropertyOptional({ description: 'Optional Gemini prompt override.' })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @ApiPropertyOptional({ description: 'Additional product context for extraction.' })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @ApiPropertyOptional({ default: true })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  runImmediately?: boolean = true;
}
