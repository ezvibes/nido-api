import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { useConcertFilters } from './useConcertFilters';
import type { ConcertListItem } from '../types/concerts';

describe('useConcertFilters', () => {
  it('searches concerts by band name using concert-domain terminology', async () => {
    const concerts = ref([
      buildConcert('concert-1', 'The Floozies'),
      buildConcert('concert-2', 'Lotus'),
    ]);
    const { searchText, filteredConcerts } = useConcertFilters(concerts);

    searchText.value = 'floozies';
    await nextTick();

    expect(filteredConcerts.value).toHaveLength(1);
    expect(filteredConcerts.value[0]?.lineup[0]?.band.name).toBe(
      'The Floozies',
    );
  });
});

function buildConcert(id: string, bandName: string): ConcertListItem {
  return {
    id,
    title: `${bandName} live`,
    genre: 'Electronic',
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    venue: null,
    lineup: [
      {
        performanceRole: 'headliner',
        performanceOrder: 0,
        band: {
          id: `${id}-band`,
          name: bandName,
          slug: bandName.toLowerCase().replace(/\s+/g, '-'),
        },
      },
    ],
    sets: [],
    posterUrl: 'https://example.com/poster.jpg',
    sourceLabel: 'EZ Vibes',
    displayTags: ['Electronic'],
    demoRank: 0,
  };
}
