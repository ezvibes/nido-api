import {
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConcertApiItem } from '../types/concerts';
import ConcertDetailPage from './ConcertDetailPage.vue';

const api = vi.hoisted(() => ({
  fetchConcertById: vi.fn(),
  upvoteConcert: vi.fn(),
  removeConcertUpvote: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: undefined as
    | {
        value: null | { getIdToken: () => Promise<string> };
      }
    | undefined,
}));

const routeState = vi.hoisted(() => ({
  params: { id: 'concert-101' },
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
}));

vi.mock('../composables/useAuth', async () => {
  const { ref } = await import('vue');
  auth.user = ref(null);
  return {
    useAuth: () => ({
      user: auth.user,
    }),
  };
});

vi.mock('../composables/useApi', () => api);

enableAutoUnmount(afterEach);

const routerStubs = {
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
};

describe('ConcertDetailPage', () => {
  beforeEach(() => {
    routeState.params = { id: 'concert-101' };
    auth.user!.value = null;
    api.fetchConcertById.mockReset();
    api.upvoteConcert.mockReset();
    api.removeConcertUpvote.mockReset();
  });

  it('loads and renders concert details, lineup, sets, venue directions, and calendar links', async () => {
    api.fetchConcertById.mockResolvedValue(buildConcert());

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    expect(api.fetchConcertById).toHaveBeenCalledWith('concert-101', undefined);
    expect(wrapper.get('.concert-detail__artist').text()).toBe(
      'Sylvan Esso · Night Drive',
    );
    expect(wrapper.get('.concert-detail__subtitle').text()).toBe(
      'Raleigh Electronic Night',
    );
    expect(wrapper.text()).toContain(
      'Doors at 7pm. Full modular synth and laser production.',
    );
    expect(wrapper.text()).toContain('Featured');
    expect(wrapper.text()).toContain('Top Pick');

    // Lineup & Set Times
    expect(wrapper.text()).toContain('Headliner');
    expect(wrapper.text()).toContain('Support');
    expect(wrapper.text()).toContain('Synthpop');
    expect(wrapper.text()).toContain('Main Stage');

    // Venue & Google Maps Directions
    const venueSection = wrapper.get('[data-testid="venue-section"]');
    expect(venueSection.text()).toContain('Lincoln Theatre');
    expect(venueSection.text()).toContain('126 E Cabarrus St, Raleigh, NC 27601');
    expect(venueSection.text()).toContain('Capacity: 750');

    const mapsLink = wrapper.get('[data-testid="google-maps-link"]');
    expect(mapsLink.attributes('href')).toContain(
      'https://www.google.com/maps/search/?api=1&query=',
    );
    expect(decodeURIComponent(mapsLink.attributes('href')!)).toContain(
      'Lincoln Theatre, 126 E Cabarrus St, Raleigh, NC 27601',
    );

    // Ticket link
    const ticketLink = wrapper.get('[data-testid="ticket-link"]');
    expect(ticketLink.attributes('href')).toBe(
      'https://etix.com/ticket/p/99999?utm_source=nido&utm_medium=referral&utm_campaign=concert_discovery',
    );

    // Google Calendar link
    const gcalLink = wrapper.get('[data-testid="google-calendar-link"]');
    expect(gcalLink.attributes('href')).toContain(
      'https://calendar.google.com/calendar/render?action=TEMPLATE',
    );
    expect(gcalLink.attributes('href')).toContain(
      'dates=20260918T233000Z%2F20260919T030000Z',
    );
  });

  it('opens the high-res poster lightbox when clicked', async () => {
    api.fetchConcertById.mockResolvedValue(buildConcert());

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="poster-lightbox"]').exists()).toBe(false);
    await wrapper.get('.concert-detail__poster').trigger('click');
    expect(wrapper.find('[data-testid="poster-lightbox"]').exists()).toBe(true);
  });

  it('generates and downloads an .ics calendar file', async () => {
    api.fetchConcertById.mockResolvedValue(buildConcert());
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-ics-url');
    const revokeObjectUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    await wrapper.get('[data-testid="download-ics-button"]').trigger('click');

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/calendar;charset=utf-8');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-ics-url');

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('copies the share link to clipboard when Web Share API is unavailable', async () => {
    api.fetchConcertById.mockResolvedValue(buildConcert());
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      share: undefined,
      clipboard: { writeText: writeTextMock },
    });

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    const shareBtn = wrapper.get('[data-testid="share-button"]');
    expect(shareBtn.text()).toBe('Share Show');

    await shareBtn.trigger('click');
    await flushPromises();

    expect(writeTextMock).toHaveBeenCalledWith(window.location.href);
    expect(shareBtn.text()).toBe('Link copied!');
  });

  it('toggles upvote when signed in', async () => {
    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchConcertById.mockResolvedValue(
      buildConcert({ upvoteCount: 5, upvotedByMe: false }),
    );
    api.upvoteConcert.mockResolvedValue({
      concertId: 'concert-101',
      upvoteCount: 6,
      upvotedByMe: true,
      trendingWeekUpvotes: 4,
    });

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    expect(api.fetchConcertById).toHaveBeenCalledWith(
      'concert-101',
      'firebase-token',
    );

    const upvoteBtn = wrapper.get('[data-testid="upvote-button"]');
    expect(upvoteBtn.text()).toContain('5');

    await upvoteBtn.trigger('click');
    await flushPromises();

    expect(api.upvoteConcert).toHaveBeenCalledWith(
      'firebase-token',
      'concert-101',
    );
    expect(upvoteBtn.text()).toContain('6');
    expect(upvoteBtn.attributes('aria-pressed')).toBe('true');
  });

  it('shows not-found error state when concert request fails', async () => {
    api.fetchConcertById.mockRejectedValue(new Error('404 Not Found'));

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="concert-detail-error"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain('Concert not found');
  });

  it('updates document title, canonical link, and injects schema.org/MusicEvent JSON-LD on mount and cleans up on unmount', async () => {
    api.fetchConcertById.mockResolvedValue(buildConcert());

    const wrapper = mount(ConcertDetailPage, {
      global: { stubs: routerStubs },
    });
    await flushPromises();

    expect(document.title).toBe(
      'Sylvan Esso · Night Drive at Lincoln Theatre | EZ Vibes Concerts',
    );

    const canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    expect(canonical?.getAttribute('href')).toContain('/concerts/concert-101');

    const jsonLdEl = document.getElementById('nido-event-jsonld');
    expect(jsonLdEl).not.toBeNull();
    expect(jsonLdEl?.getAttribute('type')).toBe('application/ld+json');
    const parsed = JSON.parse(jsonLdEl?.textContent || '{}');
    expect(parsed['@type']).toBe('MusicEvent');
    expect(parsed.name).toBe('Raleigh Electronic Night');
    expect(parsed.location?.name).toBe('Lincoln Theatre');

    wrapper.unmount();
    expect(document.getElementById('nido-event-jsonld')).toBeNull();
    expect(document.title).toBe('EZ Vibes Concerts');
  });
});

function buildConcert(
  overrides: Partial<ConcertApiItem> = {},
): ConcertApiItem {
  return {
    id: 'concert-101',
    title: 'Raleigh Electronic Night',
    genre: 'Electronic',
    startsAt: '2026-09-18T23:30:00.000Z',
    endsAt: '2026-09-19T03:00:00.000Z',
    description: 'Doors at 7pm. Full modular synth and laser production.',
    ticketUrl: 'https://etix.com/ticket/p/99999',
    posterUrl: '/ingestion/uploads/upload-101/image',
    isFeatured: true,
    isTopPick: true,
    upvoteCount: 12,
    upvotedByMe: false,
    trendingWeekUpvotes: 5,
    venue: {
      id: 'venue-1',
      name: 'Lincoln Theatre',
      address: '126 E Cabarrus St',
      city: 'Raleigh',
      region: 'NC',
      postalCode: '27601',
      capacity: 750,
    },
    lineup: [
      {
        performanceRole: 'headliner',
        performanceOrder: 0,
        band: {
          id: 'band-1',
          name: 'Sylvan Esso',
          slug: 'sylvan-esso',
          genres: ['Electronic', 'Synthpop'],
        },
      },
      {
        performanceRole: 'support',
        performanceOrder: 1,
        band: {
          id: 'band-2',
          name: 'Night Drive',
          slug: 'night-drive',
          genres: ['Darkwave'],
        },
      },
    ],
    sets: [
      {
        id: 'set-1',
        stageName: 'Main Stage',
        startsAt: '2026-09-19T00:30:00.000Z',
        endsAt: '2026-09-19T02:00:00.000Z',
        band: {
          id: 'band-1',
          name: 'Sylvan Esso',
          slug: 'sylvan-esso',
        },
      },
    ],
    ...overrides,
  };
}
