import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  syncJobStatuses,
  type SyncJobStatus,
} from './list-concert-sync-jobs.dto';

export class ConcertSyncRecentEventDto {
  @ApiProperty({ example: 'qa-evt-1' })
  calendarEventId: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  concertId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 0.63 })
  extractionConfidence?: number | null;

  @ApiProperty({ example: false })
  needsGuidance: boolean;

  @ApiProperty({ type: [String], example: [] })
  extractionWarnings: string[];

  @ApiProperty({ example: '2026-05-28T23:40:28.825Z' })
  updatedAt: string;
}

export class ConcertSyncJobResponseDto {
  @ApiProperty({ example: '0f0aaf91-1f31-4f0f-91f9-006a10b2ee81' })
  id: string;

  @ApiProperty({ enum: syncJobStatuses, example: 'completed' })
  status: SyncJobStatus;

  @ApiProperty({ example: 'primary' })
  calendarId: string;

  @ApiPropertyOptional({ nullable: true, example: 'UTC' })
  calendarTimezone?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-06-01T00:00:00.000Z',
  })
  requestedRangeStart?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-01T00:00:00.000Z',
  })
  requestedRangeEnd?: string | null;

  @ApiProperty({ example: true })
  refreshTopPicks: boolean;

  @ApiProperty({ example: 1 })
  totalEventsFetched: number;

  @ApiProperty({ example: 1 })
  eventsProcessed: number;

  @ApiProperty({ example: 1 })
  eventsCreated: number;

  @ApiProperty({ example: 0 })
  eventsUpdated: number;

  @ApiProperty({ example: 0 })
  eventsSkipped: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  errorMessage?: string | null;

  @ApiProperty({
    description:
      'Operational metadata such as sampleMode, dryRun, fallbackReasons, extractionWarnings, and dryRunEvents.',
    example: {
      dryRun: false,
      maxEvents: 1,
      sampleMode: true,
      syncSource: 'sample_events',
      geminiEnabled: false,
      heuristicExtractions: 1,
      fallbackReasons: {
        gemini_billing_or_quota_exhausted: 1,
      },
    },
  })
  metadata: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-05-28T23:40:28.482Z',
  })
  startedAt?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-05-28T23:40:28.839Z',
  })
  completedAt?: string | null;

  @ApiProperty({ example: '2026-05-28T23:40:28.460Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-28T23:40:28.841Z' })
  updatedAt: string;
}

export class ConcertSyncJobDetailResponseDto extends ConcertSyncJobResponseDto {
  @ApiProperty({ type: [ConcertSyncRecentEventDto] })
  recentEvents: ConcertSyncRecentEventDto[];
}

export class ConcertSyncJobListResponseDto {
  @ApiProperty({ example: 2 })
  total: number;

  @ApiProperty({ type: [ConcertSyncJobResponseDto] })
  items: ConcertSyncJobResponseDto[];
}
