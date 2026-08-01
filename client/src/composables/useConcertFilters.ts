import { computed, ref, unref, type Ref } from 'vue';
import type { ConcertListItem } from '../types/concerts';

export type DateRangeOption = '7' | '30' | 'all';
export type SortOption = 'soonest' | 'featured' | 'trending_week';
export type SourceOption = 'all' | 'synced';

export function useConcertFilters(
  concerts: ConcertListItem[] | Ref<ConcertListItem[]>,
) {
  const searchText = ref('');
  const dateRange = ref<DateRangeOption>('30');
  const sort = ref<SortOption>('soonest');
  const source = ref<SourceOption>('all');

  const filteredConcerts = computed(() => {
    const sourceConcerts = unref(concerts);
    const now = Date.now();
    let result = sourceConcerts.filter(
      (concert) => new Date(concert.startsAt).getTime() >= now,
    );

    if (dateRange.value !== 'all') {
      const days = Number.parseInt(dateRange.value, 10);
      const maxTime = now + days * 24 * 60 * 60 * 1000;
      result = result.filter(
        (concert) => new Date(concert.startsAt).getTime() <= maxTime,
      );
    }

    if (source.value === 'synced') {
      result = result.filter(
        (concert) => concert.syncSource?.source === 'google_calendar',
      );
    }

    const search = searchText.value.trim().toLowerCase();
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);

      result = result.filter((concert) => {
        const haystack = [
          concert.title,
          concert.genre,
          concert.description ?? '',
          concert.sourceLabel,
          ...concert.displayTags,
          ...concert.lineup.map((entry) => entry.band.name),
          concert.venue?.name ?? '',
          concert.venue?.city ?? '',
          concert.venue?.region ?? '',
        ]
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => haystack.includes(token));
      });
    }

    if (sort.value === 'featured') {
      return [...result].sort((a, b) => {
        const featuredDelta =
          Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
        if (featuredDelta !== 0) {
          return featuredDelta;
        }

        if (b.demoRank !== a.demoRank) {
          return b.demoRank - a.demoRank;
        }

        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    }

    if (sort.value === 'trending_week') {
      return [...result].sort((a, b) => {
        const trendingDelta =
          (b.trendingWeekUpvotes ?? 0) - (a.trendingWeekUpvotes ?? 0);
        if (trendingDelta !== 0) {
          return trendingDelta;
        }

        const totalDelta = (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0);
        if (totalDelta !== 0) {
          return totalDelta;
        }

        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    }

    return [...result].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  });

  const clearFilters = () => {
    searchText.value = '';
    dateRange.value = '30';
    sort.value = 'soonest';
    source.value = 'all';
  };

  return {
    searchText,
    dateRange,
    sort,
    source,
    filteredConcerts,
    clearFilters,
  };
}
