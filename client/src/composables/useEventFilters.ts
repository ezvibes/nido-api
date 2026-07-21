import { computed, ref, unref, type Ref } from 'vue';
import type { EventListItem } from '../types/events';

export type DateRangeOption = '7' | '30' | 'all';
export type SortOption = 'soonest' | 'featured' | 'trending_week';
export type SourceOption = 'all' | 'synced';

export function useEventFilters(
  events: EventListItem[] | Ref<EventListItem[]>,
) {
  const searchText = ref('');
  const dateRange = ref<DateRangeOption>('30');
  const sort = ref<SortOption>('soonest');
  const source = ref<SourceOption>('all');

  const filteredEvents = computed(() => {
    const sourceEvents = unref(events);
    const now = Date.now();
    let result = sourceEvents.filter(
      (event) => new Date(event.startsAt).getTime() >= now,
    );

    if (dateRange.value !== 'all') {
      const days = Number.parseInt(dateRange.value, 10);
      const maxTime = now + days * 24 * 60 * 60 * 1000;
      result = result.filter(
        (event) => new Date(event.startsAt).getTime() <= maxTime,
      );
    }

    if (source.value === 'synced') {
      result = result.filter(
        (event) => event.syncSource?.source === 'google_calendar',
      );
    }

    const search = searchText.value.trim().toLowerCase();
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);

      result = result.filter((event) => {
        const haystack = [
          event.title,
          event.genre,
          event.description ?? '',
          event.sourceLabel,
          ...event.displayTags,
          ...event.lineup.map((entry) => entry.band.name),
          event.venue?.name ?? '',
          event.venue?.city ?? '',
          event.venue?.region ?? '',
        ]
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => haystack.includes(token));
      });
    }

    if (sort.value === 'featured') {
      return [...result].sort((a, b) => {
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
    filteredEvents,
    clearFilters,
  };
}
