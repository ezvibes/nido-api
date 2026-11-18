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

  it('ranks manually featured concerts ahead of algorithmic Top Picks', async () => {
    const concerts = ref([
      { ...buildConcert('top-pick', 'Top Pick Band'), demoRank: 10 },
      {
        ...buildConcert('featured', 'Featured Band'),
        isFeatured: true,
        demoRank: 2,
      },
    ]);
    const { sort, filteredConcerts } = useConcertFilters(concerts);

    sort.value = 'featured';
    await nextTick();

    expect(filteredConcerts.value.map((concert) => concert.id)).toEqual([
      'featured',
      'top-pick',
    ]);
  });

  it('filters concerts by normalized city and region and resets them on clearFilters', async () => {
    const concerts = ref([
      {
        ...buildConcert('raleigh-show', 'Sylvan Esso'),
        venue: {
          id: 'v-1',
          name: 'Lincoln Theatre',
          city: 'Raleigh',
          region: 'NC',
        },
      },
      {
        ...buildConcert('durham-show', 'Mountain Goats'),
        venue: {
          id: 'v-2',
          name: 'Motorco Music Hall',
          city: 'Durham',
          region: 'NC',
        },
      },
    ]);

    const { city, region, filteredConcerts, clearFilters } =
      useConcertFilters(concerts);

    city.value = 'durham';
    region.value = 'nc';
    await nextTick();

    expect(filteredConcerts.value.map((c) => c.id)).toEqual(['durham-show']);

    clearFilters();
    await nextTick();

    expect(city.value).toBe('');
    expect(region.value).toBe('');
    expect(filteredConcerts.value).toHaveLength(2);
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
