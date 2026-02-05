import { computed, ref } from 'vue';
import type { EventItem } from '../types/events';

export type DateRangeOption = '7' | '30' | 'all';
export type SortOption = 'soonest' | 'trending';

export function useEventFilters(events: EventItem[]) {
  const searchText = ref('');
  const dateRange = ref<DateRangeOption>('30');
  const sort = ref<SortOption>('soonest');

  const filteredEvents = computed(() => {
    const now = Date.now();
    let result = events.filter(event => new Date(event.startsAt).getTime() >= now);

    if (dateRange.value !== 'all') {
      const days = Number.parseInt(dateRange.value, 10);
      const maxTime = now + days * 24 * 60 * 60 * 1000;
      result = result.filter(event => new Date(event.startsAt).getTime() <= maxTime);
    }

    const search = searchText.value.trim().toLowerCase();
    if (search) {
      const stopwords = new Set(['in', 'at', 'the', 'and', 'of', 'for']);
      const tokens = search
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token && !stopwords.has(token));

      result = result.filter(event => {
        const haystack = [
          event.title,
          event.venue.name,
          event.venue.city,
          ...event.genres,
        ]
          .join(' ')
          .toLowerCase();

        return tokens.every(token => haystack.includes(token));
      });
    }

    if (sort.value === 'soonest') {
      result = [...result].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      );
    } else {
      // TODO: add real trending signal once API is wired.
      result = [...result];
    }

    return result;
  });

  const clearFilters = () => {
    searchText.value = '';
    dateRange.value = 'all';
    sort.value = 'soonest';
  };

  return {
    searchText,
    dateRange,
    sort,
    filteredEvents,
    clearFilters,
  };
}
