export interface EventVenue {
  name: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface EventArtist {
  name: string;
  role?: string;
  genre?: string;
}

export interface ConcertApiItem {
  id: string;
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string | null;
  venues: EventVenue[];
  artists: EventArtist[];
  description?: string | null;
  isTopPick?: boolean;
  topPickScore?: number | null;
  upvoteCount?: number;
  upvotedByMe?: boolean;
  trendingWeekUpvotes?: number;
  syncSource?: {
    source: 'google_calendar';
    calendarId: string;
    calendarEventId: string;
    lastSyncedAt?: string | null;
    needsGuidance?: boolean;
  } | null;
  posterUrl?: string | null;
}

export interface ConcertApiResponse {
  data: ConcertApiItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventListItem extends ConcertApiItem {
  posterUrl: string;
  sourceLabel: string;
  displayTags: string[];
  demoRank: number;
}

export function mapConcertToEventListItem(
  concert: ConcertApiItem,
  overrides?: Partial<
    Pick<
      EventListItem,
      | 'posterUrl'
      | 'sourceLabel'
      | 'displayTags'
      | 'demoRank'
      | 'upvoteCount'
      | 'upvotedByMe'
      | 'trendingWeekUpvotes'
      | 'syncSource'
    >
  >,
): EventListItem {
  let resolvedPosterUrl =
    overrides?.posterUrl ??
    concert.posterUrl ??
    'https://placehold.co/720x900?text=Live+Music';

  if (resolvedPosterUrl && resolvedPosterUrl.startsWith('/')) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || '';
    // Strip trailing slash from apiBase and leading slash from resolvedPosterUrl if needed,
    // but simply combining them is standard if apiBase has no trailing slash.
    resolvedPosterUrl = `${apiBase}${resolvedPosterUrl}`;
  }

  return {
    ...concert,
    posterUrl: resolvedPosterUrl,
    sourceLabel: overrides?.sourceLabel ?? 'EZ Vibes Demo',
    displayTags: overrides?.displayTags ?? [concert.genre],
    demoRank:
      overrides?.demoRank ??
      (concert.isTopPick ? (concert.topPickScore ?? 1) : 0),
    upvoteCount: overrides?.upvoteCount ?? concert.upvoteCount ?? 0,
    upvotedByMe: overrides?.upvotedByMe ?? concert.upvotedByMe ?? false,
    trendingWeekUpvotes:
      overrides?.trendingWeekUpvotes ?? concert.trendingWeekUpvotes ?? 0,
    syncSource: overrides?.syncSource ?? concert.syncSource ?? null,
  };
}
