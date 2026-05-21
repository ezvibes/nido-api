import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateConcertSyncJobDto {
  @ApiPropertyOptional({
    default: 'primary',
    description: 'Google Calendar id. Use primary unless syncing a specific calendar.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  calendarId?: string;

  @ApiPropertyOptional({
    description:
      'Short-lived Google Calendar access token. Required unless sampleEvents are supplied.',
  })
  @ValidateIf((dto) => !Array.isArray(dto.sampleEvents) || !dto.sampleEvents.length)
  @IsString()
  googleAccessToken?: string;

  @ApiPropertyOptional({
    description: 'Inclusive sync window start in ISO-8601 format.',
    example: '2026-06-01T00:00:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Inclusive sync window end in ISO-8601 format.',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsISO8601()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Refresh Top Picks after this job completes.',
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean = true;

  @ApiPropertyOptional({
    description: 'Optional prompt override. Prefer prompt-template review first.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @ApiPropertyOptional({
    description: 'Additional product context appended to the extraction prompt.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @ApiPropertyOptional({
    description: 'Inline test events for local QA without Google Calendar calls.',
    example: [
      {
        id: 'qa-evt-1',
        status: 'confirmed',
        summary: 'Rooftop Set with Neon Tide',
        location: 'Skyline Loft, Brooklyn, NY',
        start: { dateTime: '2026-06-15T20:00:00.000Z' },
      },
    ],
  })
  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  sampleEvents?: Array<Record<string, unknown>>;
}
