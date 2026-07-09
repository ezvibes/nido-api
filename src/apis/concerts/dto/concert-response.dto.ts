import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArtistDto } from './artist.dto';
import { VenueDto } from './venue.dto';

export class ConcertResponseDto {
  @ApiProperty({
    description: 'Concert id.',
    example: '74c3bcf1-f13e-40d6-bf25-3c27954f5f1e',
  })
  id: string;

  @ApiProperty({ example: 'Doctor S Presents: Neon Tide with DJ Luna' })
  title: string;

  @ApiProperty({ example: 'Electronic' })
  genre: string;

  @ApiProperty({ example: '2026-06-16T01:00:00.000Z' })
  startsAt: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-06-16T03:30:00.000Z',
  })
  endsAt?: string | null;

  @ApiProperty({ type: [VenueDto] })
  venues: VenueDto[];

  @ApiProperty({ type: [ArtistDto] })
  artists: ArtistDto[];

  @ApiPropertyOptional({
    nullable: true,
    example: 'Live electronic and indie-pop concert. Doors 8 PM. Show 9 PM.',
  })
  description?: string | null;

  @ApiProperty({ example: false })
  isTopPick: boolean;

  @ApiPropertyOptional({ nullable: true, example: 0.8123 })
  topPickScore?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-05-28T23:47:20.531Z',
  })
  topPickRefreshedAt?: string | null;

  @ApiProperty({ example: false })
  isAdminApproved: boolean;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-05-28T23:47:20.531Z',
  })
  adminApprovedAt?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 7 })
  adminApprovedByUserId?: number | null;

  @ApiProperty({ example: '2026-05-28T23:40:28.817Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-05-28T23:47:20.531Z' })
  updatedAt: string;

  @ApiProperty({ example: 0 })
  upvoteCount: number;

  @ApiProperty({ example: false })
  upvotedByMe: boolean;

  @ApiProperty({ example: 0 })
  trendingWeekUpvotes: number;

  @ApiPropertyOptional({
    nullable: true,
    example: {
      source: 'google_calendar',
      calendarId: 'ezvibesinc@gmail.com',
      calendarEventId: '1p6li36jn6s89hj8bnmeg0p04b_20260609T220000Z',
      lastSyncedAt: '2026-06-09T01:32:55.900Z',
      needsGuidance: false,
    },
  })
  syncSource?: {
    source: 'google_calendar';
    calendarId: string;
    calendarEventId: string;
    lastSyncedAt?: string | null;
    needsGuidance?: boolean;
  } | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'The GCS public URL of the uploaded show poster',
    example: 'https://storage.googleapis.com/nido-concert-image-ingestion-dev/uploads/abc.jpg',
  })
  posterUrl?: string | null;
}

export class ConcertListResponseDto {
  @ApiProperty({ type: [ConcertResponseDto] })
  data: ConcertResponseDto[];

  @ApiProperty({ example: 2 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;
}

export class ConcertEngagementResponseDto {
  @ApiProperty({ example: 1 })
  upvoteCount: number;

  @ApiProperty({ example: true })
  upvotedByMe: boolean;

  @ApiProperty({ example: 1 })
  trendingWeekUpvotes: number;
}
