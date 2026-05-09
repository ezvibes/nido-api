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
  upvoteCount?: number;
  upvotedByMe?: boolean;
  trendingWeekUpvotes?: number;
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
    >
  >
): EventListItem {
  return {
    ...concert,
    posterUrl: overrides?.posterUrl ?? 'https://placehold.co/720x900?text=Live+Music',
    sourceLabel: overrides?.sourceLabel ?? 'EZ Vibes Demo',
    displayTags: overrides?.displayTags ?? [concert.genre],
    demoRank: overrides?.demoRank ?? 0,
    upvoteCount: overrides?.upvoteCount ?? concert.upvoteCount ?? 0,
    upvotedByMe: overrides?.upvotedByMe ?? concert.upvotedByMe ?? false,
    trendingWeekUpvotes: overrides?.trendingWeekUpvotes ?? concert.trendingWeekUpvotes ?? 0,
  };
}
