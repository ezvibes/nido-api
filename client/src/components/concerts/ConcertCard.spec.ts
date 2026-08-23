import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { ConcertListItem } from '../../types/concerts';
import ConcertCard from './ConcertCard.vue';

describe('ConcertCard', () => {
  it('leads with the date and artist without repeating a redundant event title', () => {
    const wrapper = mount(ConcertCard, {
      props: {
        concert: buildConcert(),
      },
    });

    const bodyText = wrapper.get('.concert-card__body').text();
    expect(wrapper.get('.concert-card__body').element.firstElementChild).toBe(
      wrapper.get('.concert-card__time').element,
    );
    expect(wrapper.get('.concert-card__artist').text()).toBe('The Floozies');
    expect(wrapper.find('.concert-card__event').exists()).toBe(false);
    expect(bodyText.indexOf('Raleigh, NC')).toBeLessThan(
      bodyText.indexOf('Electronic'),
    );
    expect(bodyText.indexOf('Electronic')).toBeLessThan(
      bodyText.indexOf('Google Calendar Sync'),
    );
  });

  it('keeps a distinct event title beneath the prominent artist lineup', () => {
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

    expect(wrapper.get('.concert-card__artist').text()).toBe(
      'The Floozies · Night Drive',
    );
    expect(wrapper.get('.concert-card__event').text()).toBe(
      'Downtown Summer Jam',
    );
  });

  it('omits description from the concert card view', () => {
    const wrapper = mount(ConcertCard, {
      props: {
        concert: buildConcert({
          description: 'Special outdoor headline performance with full laser production.',
        }),
      },
    });

    expect(wrapper.find('.concert-card__description').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Special outdoor headline performance');
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
