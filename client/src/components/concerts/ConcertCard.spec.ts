import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { ConcertListItem } from '../../types/concerts';
import ConcertCard from './ConcertCard.vue';

const routerStubs = {
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
};

function mountCard(concert: ConcertListItem) {
  return mount(ConcertCard, {
    props: { concert },
    global: { stubs: routerStubs },
  });
}

describe('ConcertCard', () => {
  it('leads with the date and artist without repeating a redundant event title', () => {
    const wrapper = mountCard(buildConcert());

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
    const wrapper = mountCard(
      buildConcert({
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
    );

    expect(wrapper.get('.concert-card__artist').text()).toBe(
      'The Floozies · Night Drive',
    );
    expect(wrapper.get('.concert-card__event').text()).toBe(
      'Downtown Summer Jam',
    );
  });

  it('omits description from the concert card view', () => {
    const wrapper = mountCard(
      buildConcert({
        description:
          'Special outdoor headline performance with full laser production.',
      }),
    );

    expect(wrapper.find('.concert-card__description').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Special outdoor headline performance');
  });

  it('renders a genre-aware fallback visual when posterUrl is null', () => {
    const wrapper = mountCard(
      buildConcert({
        posterUrl: null,
        genre: 'Electronic',
      }),
    );

    expect(wrapper.find('.concert-card__poster img').exists()).toBe(false);
    const fallback = wrapper.get('.concert-card__fallback');
    expect(fallback.classes()).toContain('concert-card__fallback--electronic');
    expect(fallback.get('.concert-card__fallback-badge').text()).toBe('Electronic');
    expect(fallback.get('.concert-card__fallback-initials').text()).toBe('TF');
  });

  it('switches to fallback visual if poster image fails to load', async () => {
    const wrapper = mountCard(
      buildConcert({
        posterUrl: 'https://example.com/broken-poster.jpg',
      }),
    );

    expect(wrapper.find('.concert-card__poster img').exists()).toBe(true);

    await wrapper.get('.concert-card__poster img').trigger('error');

    expect(wrapper.find('.concert-card__poster img').exists()).toBe(false);
    expect(wrapper.find('.concert-card__fallback').exists()).toBe(true);
  });

  it('renders an external Get Tickets link when ticketUrl is a valid http(s) URL', () => {
    const wrapper = mountCard(
      buildConcert({
        ticketUrl: 'https://etix.com/ticket/p/12345',
      }),
    );

    const link = wrapper.get('a.concert-card__tickets');
    expect(link.text()).toBe('Get Tickets');
    expect(link.attributes('href')).toBe(
      'https://etix.com/ticket/p/12345?utm_source=nido&utm_medium=referral&utm_campaign=concert_discovery',
    );
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
  });

  it('keeps Tickets disabled for unsafe or missing ticketUrl', () => {
    const wrapper = mountCard(
      buildConcert({
        ticketUrl: 'javascript:alert(1)',
      }),
    );

    expect(wrapper.find('a.concert-card__tickets').exists()).toBe(false);
    expect(wrapper.get('button.concert-card__tickets').attributes('disabled')).toBeDefined();
  });

  it('links the artist heading and View Details button to the concert detail page', () => {
    const wrapper = mountCard(buildConcert({ id: 'concert-42' }));

    const artistLink = wrapper.get('.concert-card__artist-link');
    expect(artistLink.attributes('href')).toBe('/concerts/concert-42');

    const detailsLink = wrapper.get('.concert-card__details-link');
    expect(detailsLink.text()).toBe('View Details');
    expect(detailsLink.attributes('href')).toBe('/concerts/concert-42');
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
