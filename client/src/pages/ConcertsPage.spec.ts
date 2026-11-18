import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConcertApiItem, ConcertApiResponse } from '../types/concerts';
import ConcertsPage from './ConcertsPage.vue';

const api = vi.hoisted(() => ({
  fetchConcerts: vi.fn(),
  fetchUserConcerts: vi.fn(),
  removeConcertUpvote: vi.fn(),
  syncUserToBackend: vi.fn(),
  upvoteConcert: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: undefined as
    | {
        value: null | { getIdToken: () => Promise<string> };
      }
    | undefined,
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

const defaultStubs = {
  IngestionUploadPanel: true,
  'router-link': {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
};

describe('ConcertsPage', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/concerts');
    auth.user!.value = null;
    api.fetchConcerts.mockReset();
    api.fetchUserConcerts.mockReset();
    api.removeConcertUpvote.mockReset();
    api.syncUserToBackend.mockReset();
    api.upvoteConcert.mockReset();
  });

  it('loads the public concerts feed without an authentication token', async () => {
    api.fetchConcerts.mockResolvedValue({
      data: [buildConcert()],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    const wrapper = mount(ConcertsPage, {
      global: {
        stubs: defaultStubs,
      },
    });
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenCalledTimes(1);
    expect(api.fetchConcerts).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        sort: 'soonest',
        pageSize: 100,
      }),
    );
    expect(api.fetchUserConcerts).not.toHaveBeenCalled();
    expect(api.syncUserToBackend).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Concerts');
    expect(wrapper.text()).toContain('The Floozies');
    expect(wrapper.text()).not.toContain('Unable to load concerts');
  });

  it('keeps authenticated engagement when an older anonymous request finishes last', async () => {
    const anonymousResponse = deferred<ConcertApiResponse>();
    const authenticatedResponse = deferred<ConcertApiResponse>();
    const getIdToken = vi.fn().mockResolvedValue('firebase-token');

    api.fetchConcerts
      .mockReturnValueOnce(anonymousResponse.promise)
      .mockReturnValueOnce(authenticatedResponse.promise);

    const wrapper = mount(ConcertsPage, {
      global: {
        stubs: defaultStubs,
      },
    });
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenNthCalledWith(
      1,
      undefined,
      expect.any(Object),
    );

    auth.user!.value = { getIdToken };
    await flushPromises();

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(api.fetchConcerts).toHaveBeenNthCalledWith(
      2,
      'firebase-token',
      expect.any(Object),
    );

    authenticatedResponse.resolve(buildConcertResponse({ upvotedByMe: true }));
    await flushPromises();
    expect(
      wrapper.get('.concert-card__upvote').attributes('aria-pressed'),
    ).toBe('true');

    anonymousResponse.resolve(buildConcertResponse({ upvotedByMe: false }));
    await flushPromises();
    expect(
      wrapper.get('.concert-card__upvote').attributes('aria-pressed'),
    ).toBe('true');
    expect(wrapper.text()).not.toContain('Unable to load concerts');
  });

  it('shows a recoverable error and retries the public feed safely', async () => {
    api.fetchConcerts
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        data: [buildConcert()],
        total: 1,
        page: 1,
        pageSize: 100,
      });

    const wrapper = mount(ConcertsPage, {
      global: {
        stubs: defaultStubs,
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Unable to load concerts');
    const retryButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Try again'));
    expect(retryButton).toBeDefined();

    await retryButton!.trigger('click');
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('The Floozies');
    expect(wrapper.text()).not.toContain('Unable to load concerts');
  });

  it('requests and renders the manual Featured ordering', async () => {
    api.fetchConcerts.mockResolvedValue({
      data: [buildConcert({ isFeatured: true })],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    const wrapper = mount(ConcertsPage, {
      global: { stubs: defaultStubs },
    });
    await flushPromises();

    const sortField = wrapper
      .findAll('.filters-bar__field')
      .find((field) => field.text().includes('Sort'));
    await sortField!.get('select').setValue('featured');
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ sort: 'featured' }),
    );
    expect(wrapper.text()).toContain('Sorted by featured priority.');
  });

  it('reads initial ?city= filter from URL query and passes it to fetchConcerts', async () => {
    window.history.replaceState({}, '', '/concerts?city=raleigh&sort=featured');
    api.fetchConcerts.mockResolvedValue({
      data: [buildConcert({ isFeatured: true })],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    mount(ConcertsPage, {
      global: { stubs: { IngestionUploadPanel: true } },
    });
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        city: 'raleigh',
        sort: 'featured',
        pageSize: 100,
      }),
    );
  });

  it('fetches city-filtered concerts and updates the URL when selecting a city in ConcertFiltersBar', async () => {
    api.fetchConcerts.mockResolvedValue({
      data: [buildConcert()],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    const wrapper = mount(ConcertsPage, {
      global: { stubs: { IngestionUploadPanel: true } },
    });
    await flushPromises();

    const citySelect = wrapper.get('[data-testid="city-filter-select"]');
    await citySelect.setValue('Durham');
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({
        city: 'Durham',
        pageSize: 100,
      }),
    );
    expect(window.location.search).toContain('city=Durham');
  });

  it('initializes dateRange from URL query (?dateRange=7) and clears URL query on Reset filters', async () => {
    window.history.replaceState({}, '', '/concerts?city=Durham&dateRange=7');
    api.fetchConcerts.mockResolvedValue({
      data: [buildConcert()],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    const wrapper = mount(ConcertsPage, {
      global: { stubs: { IngestionUploadPanel: true } },
    });
    await flushPromises();

    expect(window.location.search).toContain('city=Durham');
    expect(window.location.search).toContain('dateRange=7');

    const resetBtn = wrapper
      .findAll('button')
      .find((btn) => btn.text().includes('Reset filters'));
    await resetBtn!.trigger('click');
    await flushPromises();

    expect(window.location.search).toBe('');
  });

  it('initializes ?region=nc, passes region to fetchConcerts, and renders full-name North Carolina venues', async () => {
    window.history.replaceState({}, '', '/concerts?region=nc');
    api.fetchConcerts.mockResolvedValue({
      data: [
        buildConcert({
          venue: {
            id: 'venue-1',
            name: 'Lincoln Theatre',
            city: 'Raleigh',
            region: 'North Carolina',
            regionSlug: 'nc',
          },
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    const wrapper = mount(ConcertsPage, {
      global: { stubs: defaultStubs },
    });
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        region: 'nc',
        pageSize: 100,
      }),
    );
    expect(wrapper.text()).toContain('The Floozies');
    expect(wrapper.text()).toContain('Lincoln Theatre');
  });

  it('passes q and startsBefore from URL filters and refetches without startsBefore when switching dateRange to all', async () => {
    window.history.replaceState({}, '', '/concerts?q=Flume&dateRange=7');
    api.fetchConcerts.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 100,
    });

    const wrapper = mount(ConcertsPage, {
      global: { stubs: defaultStubs },
    });
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenCalledTimes(1);
    expect(api.fetchConcerts).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        q: 'Flume',
        startsBefore: expect.any(String),
        pageSize: 100,
      }),
    );

    const dateRangeField = wrapper
      .findAll('.filters-bar__field')
      .find((field) => field.text().includes('Date Range'));
    await dateRangeField!.get('select').setValue('all');
    await flushPromises();

    expect(api.fetchConcerts).toHaveBeenCalledTimes(2);
    const secondCallParams = api.fetchConcerts.mock.calls[1]?.[1];
    expect(secondCallParams).toEqual(
      expect.objectContaining({
        q: 'Flume',
        pageSize: 100,
      }),
    );
    expect(secondCallParams).not.toHaveProperty('startsBefore');
  });

  it('shows a truncated-results note when server total exceeds loaded concerts and resets multiple filters in one fetch', async () => {
    vi.useFakeTimers();
    try {
      window.history.replaceState(
        {},
        '',
        '/concerts?city=Durham&region=nc&q=Flume&dateRange=7&sort=featured',
      );
      api.fetchConcerts.mockResolvedValue({
        data: [buildConcert()],
        total: 150,
        page: 1,
        pageSize: 100,
      });

      const wrapper = mount(ConcertsPage, {
        global: { stubs: defaultStubs },
      });
      await flushPromises();

      expect(wrapper.text()).toContain(
        'Showing first 1 of 150 matching concerts — refine filters to narrow results',
      );
      expect(api.fetchConcerts).toHaveBeenCalledTimes(1);

      const resetBtn = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Reset filters'));
      await resetBtn!.trigger('click');
      await flushPromises();
      vi.advanceTimersByTime(300);
      await flushPromises();

      expect(api.fetchConcerts).toHaveBeenCalledTimes(2);
      expect(window.location.search).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});

function buildConcert(overrides: Partial<ConcertApiItem> = {}): ConcertApiItem {
  return {
    id: 'concert-1',
    title: 'The Floozies at Lincoln Theatre',
    genre: 'Electronic',
    startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
    upvoteCount: 4,
    upvotedByMe: false,
    trendingWeekUpvotes: 2,
    ...overrides,
  };
}

function buildConcertResponse(
  overrides: Partial<ConcertApiItem> = {},
): ConcertApiResponse {
  return {
    data: [buildConcert(overrides)],
    total: 1,
    page: 1,
    pageSize: 100,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
