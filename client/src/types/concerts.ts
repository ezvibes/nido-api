export interface ConcertVenue {
  id: string;
  name: string;
  address?: string | null;
  city?: string;
  region?: string;
}

export interface ConcertBand {
  id: string;
  name: string;
  slug: string;
  genres?: string[] | null;
  promoImageUrl?: string | null;
}

export interface ConcertLineupEntry {
  performanceRole: string;
  performanceOrder: number;
  band: ConcertBand;
}

export interface ConcertSet {
  id: string;
  stageName: string;
  startsAt: string;
  endsAt: string;
  band: ConcertBand;
}

export interface ConcertApiItem {
  id: string;
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string | null;
  venue?: ConcertVenue | null;
  lineup: ConcertLineupEntry[];
  sets: ConcertSet[];
  description?: string | null;
  catalogStatus?: 'active' | 'hidden' | 'archived';
  isFeatured?: boolean;
  editorialLockedAt?: string | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  isTopPick?: boolean;
  topPickScore?: number | null;
  isAdminApproved?: boolean;
  adminApprovedAt?: string | null;
  adminApprovedByUserId?: number | null;
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

export interface ConcertListItem extends ConcertApiItem {
  posterUrl: string;
  sourceLabel: string;
  displayTags: string[];
  demoRank: number;
}

export function resolvePosterUrl(posterUrl?: string | null): string {
  if (!posterUrl) return '';
  if (
    posterUrl.startsWith('http://') ||
    posterUrl.startsWith('https://') ||
    posterUrl.startsWith('data:') ||
    posterUrl.startsWith('blob:')
  ) {
    return posterUrl;
  }
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const path = posterUrl.startsWith('/') ? posterUrl : `/${posterUrl}`;
  return `${apiBase}${path}`;
}

export function mapConcertToListItem(
  concert: ConcertApiItem,
  overrides?: Partial<
    Pick<
      ConcertListItem,
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
): ConcertListItem {
  const rawPosterUrl = overrides?.posterUrl ?? concert.posterUrl;
  const resolvedPosterUrl = rawPosterUrl
    ? resolvePosterUrl(rawPosterUrl)
    : 'https://placehold.co/720x900?text=Live+Music';

  return {
    ...concert,
    posterUrl: resolvedPosterUrl,
    sourceLabel: overrides?.sourceLabel ?? 'EZ Vibes',
    displayTags: overrides?.displayTags ?? [concert.genre],
    demoRank:
      overrides?.demoRank ??
      (concert.isFeatured
        ? 2
        : concert.isTopPick
          ? (concert.topPickScore ?? 1)
          : 0),
    upvoteCount: overrides?.upvoteCount ?? concert.upvoteCount ?? 0,
    upvotedByMe: overrides?.upvotedByMe ?? concert.upvotedByMe ?? false,
    trendingWeekUpvotes:
      overrides?.trendingWeekUpvotes ?? concert.trendingWeekUpvotes ?? 0,
    syncSource: overrides?.syncSource ?? concert.syncSource ?? null,
  };
}
