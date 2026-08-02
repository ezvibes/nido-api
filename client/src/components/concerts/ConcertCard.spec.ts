import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { ConcertListItem } from '../../types/concerts';
import ConcertCard from './ConcertCard.vue';

describe('ConcertCard', () => {
  it('places tags after venue details and removes a repeated lineup label', () => {
    const wrapper = mount(ConcertCard, {
      props: {
        concert: buildConcert(),
      },
    });

    const bodyText = wrapper.get('.concert-card__body').text();
    expect(bodyText.indexOf('Raleigh, NC')).toBeLessThan(
      bodyText.indexOf('Electronic'),
    );
    expect(bodyText.indexOf('Electronic')).toBeLessThan(
      bodyText.indexOf('Google Calendar Sync'),
    );
    expect(wrapper.find('.concert-card__lineup').exists()).toBe(false);
  });

  it('retains lineup information that is not already in the title', () => {
    const wrapper = mount(ConcertCard, {
      props: {
        concert: buildConcert({
          title: 'Downtown Summer Jam',
          lineup: [
            {
              performanceRole: 'headliner',
              performanceOrder: 0,
              band: {
                id: 'band-1',
                name: 'The Floozies',
                slug: 'the-floozies',
              },
            },
            {
              performanceRole: 'support',
              performanceOrder: 1,
              band: {
                id: 'band-2',
                name: 'Night Drive',
                slug: 'night-drive',
              },
            },
          ],
        }),
      },
    });

    expect(wrapper.get('.concert-card__lineup').text()).toBe(
      'The Floozies · Night Drive',
    );
  });
});

function buildConcert(
  overrides: Partial<ConcertListItem> = {},
): ConcertListItem {
  return {
    id: 'concert-1',
    title: 'The Floozies at Lincoln Theatre',
    genre: 'Electronic',
    startsAt: '2026-08-15T23:00:00.000Z',
    endsAt: null,
    venue: {
      id: 'venue-1',
      name: 'Lincoln Theatre',
      city: 'Raleigh',
      region: 'NC',
    },
    lineup: [
      {
        performanceRole: 'headliner',
        performanceOrder: 0,
        band: {
          id: 'band-1',
          name: 'The Floozies',
          slug: 'the-floozies',
        },
      },
    ],
    sets: [],
    posterUrl: 'https://placehold.co/720x900?text=Concert',
    sourceLabel: 'Concerts DB',
    displayTags: ['Electronic'],
    demoRank: 0,
    upvoteCount: 4,
    upvotedByMe: false,
    trendingWeekUpvotes: 2,
    syncSource: {
      source: 'google_calendar',
      calendarId: 'primary',
      calendarEventId: 'event-1',
    },
    ...overrides,
  };
}
