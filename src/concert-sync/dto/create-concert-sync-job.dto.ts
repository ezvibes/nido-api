import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateConcertSyncJobDto {
  @ApiPropertyOptional({
    default: 'primary',
    description:
      'Google Calendar id. Use primary unless syncing a specific calendar. Ignored for sampleEvents dry runs.',
    example: 'primary',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  calendarId?: string;

  @ApiPropertyOptional({
    description:
      'Optional short-lived Google Calendar access token for Swagger/manual testing. Production live sync should use service-account env on the API server; omit when sampleEvents are supplied.',
    example: 'ya29.a0AfH6SMD_example_access_token',
  })
  @IsString()
  @IsOptional()
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
    description:
      'Refresh internal Top Picks scoring after the job completes. Top Picks only include admin-approved concerts.',
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  refreshTopPicks?: boolean = true;

  @ApiPropertyOptional({
    default: false,
    description:
      'Load and sanitize source events without calling Gemini or writing concerts. Use this before paid Gemini-backed runs.',
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  dryRun?: boolean = false;

  @ApiPropertyOptional({
    description:
      'Maximum processable events for this job. Defaults to CONCERT_SYNC_MAX_EVENTS_PER_JOB.',
    minimum: 1,
    maximum: 100,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxEvents?: number;

  @ApiPropertyOptional({
    description:
      'Optional prompt override. Prefer dryRun=true before paid runs.',
    example:
      'Extract only confirmed live music concerts. Return strict JSON and preserve uncertainty in guidanceQuestions.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiPrompt?: string;

  @ApiPropertyOptional({
    description:
      'Additional product context appended to the extraction prompt.',
    example:
      'Doctor S focuses on high-signal live music listings in Charlotte and nearby NC markets.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  geminiContext?: string;

  @ApiPropertyOptional({
    description:
      'Inline Google Calendar-style events for local QA without live Calendar calls.',
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true,
    },
    example: [
      {
        id: 'qa-evt-1',
        status: 'confirmed',
        summary: 'Doctor S Presents: Neon Tide with DJ Luna',
        description:
          'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
        location: 'The Evening Muse, Charlotte, NC',
        start: {
          dateTime: '2026-06-15T21:00:00-04:00',
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: '2026-06-15T23:30:00-04:00',
          timeZone: 'America/New_York',
        },
      },
    ],
  })
  @IsArray()
  @IsObject({ each: true })
  @IsOptional()
  sampleEvents?: Array<Record<string, unknown>>;
}
