import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConcertsPage from './ConcertsPage.vue';

const api = vi.hoisted(() => ({
  fetchConcerts: vi.fn(),
  fetchUserConcerts: vi.fn(),
  removeConcertUpvote: vi.fn(),
  syncUserToBackend: vi.fn(),
  upvoteConcert: vi.fn(),
}));

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: {
      __v_isRef: true,
      value: null,
    },
  }),
}));

vi.mock('../composables/useApi', () => api);

describe('ConcertsPage', () => {
  beforeEach(() => {
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

function buildConcert() {
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
  };
}
