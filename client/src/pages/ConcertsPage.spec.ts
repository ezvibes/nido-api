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

describe('ConcertsPage', () => {
  beforeEach(() => {
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
        stubs: {
          IngestionUploadPanel: true,
        },
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
        stubs: {
          IngestionUploadPanel: true,
        },
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

    authenticatedResponse.resolve(
      buildConcertResponse({ upvotedByMe: true }),
    );
    await flushPromises();
    expect(
      wrapper.get('.concert-card__upvote').attributes('aria-pressed'),
    ).toBe('true');

    anonymousResponse.resolve(
      buildConcertResponse({ upvotedByMe: false }),
    );
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
        stubs: {
          IngestionUploadPanel: true,
        },
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
