import { computed, ref, unref, type Ref } from 'vue';
import type { EventListItem } from '../types/events';

export type DateRangeOption = '7' | '30' | 'all';
export type SortOption = 'soonest' | 'featured';

export function useEventFilters(events: EventListItem[] | Ref<EventListItem[]>) {
  const searchText = ref('');
  const dateRange = ref<DateRangeOption>('30');
  const sort = ref<SortOption>('soonest');

  const filteredEvents = computed(() => {
    const sourceEvents = unref(events);
    const now = Date.now();
    let result = sourceEvents.filter((event) => new Date(event.startsAt).getTime() >= now);

    if (dateRange.value !== 'all') {
      const days = Number.parseInt(dateRange.value, 10);
      const maxTime = now + days * 24 * 60 * 60 * 1000;
      result = result.filter((event) => new Date(event.startsAt).getTime() <= maxTime);
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
          ...event.artists.map((artist) => artist.name),
          ...event.venues.flatMap((venue) => [
            venue.name,
            venue.city ?? '',
            venue.state ?? '',
          ]),
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

    return [...result].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  });

  const clearFilters = () => {
    searchText.value = '';
    dateRange.value = '30';
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
