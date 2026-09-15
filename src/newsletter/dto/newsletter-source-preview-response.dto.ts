import { ApiProperty } from '@nestjs/swagger';

export class NewsletterSourceConcertDto {
  @ApiProperty({
    description: 'Stable concert id for Nido database records.',
    required: false,
  })
  id?: string;

  @ApiProperty({ description: 'Concert title or source event summary.' })
  title: string;

  @ApiProperty({ description: 'Human-readable concert date.' })
  date: string;

  @ApiProperty({ description: 'Venue and location display text.' })
  venue: string;

  @ApiProperty({ description: 'Artist lineup display text.', required: false })
  artists?: string;

  @ApiProperty({ description: 'Primary genre label.', required: false })
  genre?: string;

  @ApiProperty({ description: 'Short source description or event notes.', required: false })
  description?: string;

  @ApiProperty({ description: 'Whether the concert is marked as a Top Pick.' })
  isTopPick: boolean;

  @ApiProperty({ description: 'Current Top Pick score, when available.' })
  topPickScore: number;

  @ApiProperty({ description: 'Whether the item matches the current highlight artist watchlist.' })
  isHighlightArtist: boolean;

  @ApiProperty({ description: 'Human-readable source label.' })
  source: string;
}

export class NewsletterSourcePreviewResponseDto {
  @ApiProperty({ description: 'Human-readable date range used for the preview.' })
  dateRangeLabel: string;

  @ApiProperty({ description: 'Approved Nido database concerts selected for the prompt.' })
  concerts: NewsletterSourceConcertDto[];

  @ApiProperty({ description: 'Parsed calendar feed/text events selected for the prompt.' })
  calendarEvents: NewsletterSourceConcertDto[];

  @ApiProperty({ description: 'Number of approved Nido database concerts selected.' })
  concertsCount: number;

  @ApiProperty({ description: 'Number of parsed calendar feed/text events selected.' })
  calendarEventsCount: number;

  @ApiProperty({ description: 'Total source items that would be injected into the prompt.' })
  totalCount: number;
}
