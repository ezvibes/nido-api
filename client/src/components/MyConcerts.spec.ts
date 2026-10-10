import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyConcerts from './MyConcerts.vue';

const auth = vi.hoisted(() => ({
  user: undefined as
    | { value: null | { getIdToken: () => Promise<string> } }
    | undefined,
}));
const api = vi.hoisted(() => ({ fetchUserConcerts: vi.fn() }));

vi.mock('../composables/useAuth', async () => {
  const { ref } = await import('vue');
  auth.user = ref(null);
  return { useAuth: () => ({ user: auth.user }) };
});
vi.mock('../composables/useApi', () => api);

enableAutoUnmount(afterEach);

describe('MyConcerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
  });

  it('shows newest submissions first and loads the remaining pages', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      id: `concert-${index}`,
      title: `Show ${index}`,
      genre: 'Rock',
      startsAt: '2026-10-24T20:00:00.000Z',
      venue: null,
      lineup: [],
      isAdminApproved: false,
    }));
    api.fetchUserConcerts
      .mockResolvedValueOnce({
        data: firstPage,
        total: 21,
        page: 1,
        pageSize: 20,
      })
      .mockResolvedValueOnce({
        data: [{ ...firstPage[0], id: 'concert-20', title: 'Older show' }],
        total: 21,
        page: 2,
        pageSize: 20,
      });

    const wrapper = mount(MyConcerts);
    await flushPromises();

    expect(api.fetchUserConcerts).toHaveBeenCalledWith('firebase-token', {
      sort: 'recently_added',
      page: 1,
      pageSize: 20,
    });
    expect(wrapper.findAll('.concert-card')).toHaveLength(20);
    expect(wrapper.text()).toContain('Pending approval');

    await wrapper.get('.load-more').trigger('click');
    await flushPromises();

    expect(api.fetchUserConcerts).toHaveBeenLastCalledWith('firebase-token', {
      sort: 'recently_added',
      page: 2,
      pageSize: 20,
    });
    expect(wrapper.findAll('.concert-card')).toHaveLength(21);
    expect(wrapper.text()).toContain('Older show');
    expect(wrapper.find('.load-more').exists()).toBe(false);
  });

  it('discards a previous account response after the signed-in user changes', async () => {
    let resolveFirst = (_value: unknown) => {};
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    api.fetchUserConcerts
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce({
        data: [concert('user-b-show', 'User B show')],
        total: 1,
        page: 1,
        pageSize: 20,
      });

    const wrapper = mount(MyConcerts);
    await flushPromises();
    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('user-b-token'),
    };
    await flushPromises();

    resolveFirst({
      data: [concert('user-a-show', 'User A private show')],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    await flushPromises();

    expect(api.fetchUserConcerts).toHaveBeenCalledWith(
      'user-b-token',
      expect.objectContaining({ page: 1 }),
    );
    expect(wrapper.text()).toContain('User B show');
    expect(wrapper.text()).not.toContain('User A private show');
  });
});

function concert(id: string, title: string) {
  return {
    id,
    title,
    genre: 'Rock',
    startsAt: '2026-10-24T20:00:00.000Z',
    venue: null,
    lineup: [],
    isAdminApproved: false,
  };
}
