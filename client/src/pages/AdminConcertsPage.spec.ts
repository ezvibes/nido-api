import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminConcertsPage from './AdminConcertsPage.vue';

const api = vi.hoisted(() => ({
  fetchAdminConcerts: vi.fn(),
  fetchConcertGenres: vi.fn(),
  fetchVenues: vi.fn(),
  updateAdminConcert: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: undefined as
    | { value: null | { getIdToken: () => Promise<string> } }
    | undefined,
}));

vi.mock('../composables/useAuth', async () => {
  const { ref } = await import('vue');
  auth.user = ref(null);
  return { useAuth: () => ({ user: auth.user }) };
});

vi.mock('../composables/useApi', () => api);

enableAutoUnmount(afterEach);

describe('AdminConcertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchConcertGenres.mockResolvedValue({ genres: ['Jazz', 'Rock'] });
    api.fetchVenues.mockResolvedValue([
      { id: 'venue-1', name: 'The Pour House', city: 'Raleigh' },
    ]);
    api.fetchAdminConcerts.mockResolvedValue({
      data: [buildConcert()],
      total: 1,
      page: 1,
      pageSize: 100,
    });
  });

  it('loads the active catalog with authenticated admin filters', async () => {
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    expect(api.fetchAdminConcerts).toHaveBeenCalledWith('firebase-token', {
      q: undefined,
      catalogStatus: 'active',
      isFeatured: undefined,
      pageSize: 100,
    });
    expect(wrapper.text()).toContain('Summer Jam');
    expect(wrapper.text()).toContain('1 concert');
  });

  it('hides a concert using the version returned by the API', async () => {
    api.updateAdminConcert.mockResolvedValue(
      buildConcert({ catalogStatus: 'hidden', isFeatured: false, version: 8 }),
    );
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    await wrapper
      .get('.concert-row__actions button:nth-child(2)')
      .trigger('click');
    await flushPromises();

    expect(api.updateAdminConcert).toHaveBeenCalledWith(
      'firebase-token',
      'concert-1',
      { expectedVersion: 7, catalogStatus: 'hidden' },
    );
    expect(wrapper.find('.concert-row').exists()).toBe(false);
    expect(wrapper.text()).toContain('Summer Jam is now hidden.');
  });

  it('edits content and shows the calendar overwrite warning', async () => {
    api.updateAdminConcert.mockResolvedValue(
      buildConcert({ title: 'Summer Jam Updated', version: 8 }),
    );
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    await wrapper.get('.concert-row__actions button').trigger('click');
    expect(wrapper.text()).toContain(
      'Saving content pauses calendar overwrites for this concert',
    );

    await wrapper
      .get<HTMLInputElement>('.field--wide input')
      .setValue('Summer Jam Updated');
    await wrapper.get('.editor').trigger('submit');
    await flushPromises();

    expect(api.updateAdminConcert).toHaveBeenCalledWith(
      'firebase-token',
      'concert-1',
      expect.objectContaining({
        expectedVersion: 7,
        title: 'Summer Jam Updated',
        genre: 'Rock',
        venueId: 'venue-1',
      }),
    );
    expect(wrapper.find('.editor').exists()).toBe(false);
  });

  it('requires confirmation before archiving', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const archive = wrapper
      .findAll('.concert-row__actions button')
      .find((button) => button.text() === 'Archive');
    await archive!.trigger('click');

    expect(confirm).toHaveBeenCalled();
    expect(api.updateAdminConcert).not.toHaveBeenCalled();
  });

  it('closes a stale editor and keeps the conflict guidance visible', async () => {
    api.updateAdminConcert.mockRejectedValue({ response: { status: 409 } });
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    await wrapper.get('.concert-row__actions button').trigger('click');
    await wrapper.get('.editor').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.editor').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'editor was closed and the latest version was loaded',
    );
    expect(api.fetchAdminConcerts).toHaveBeenCalledTimes(2);
  });

  it('moves focus into the editor, closes with Escape, and restores focus', async () => {
    const wrapper = mount(AdminConcertsPage, { attachTo: document.body });
    await flushPromises();

    const editButton = wrapper.get<HTMLButtonElement>(
      '.concert-row__actions button',
    );
    editButton.element.focus();
    await editButton.trigger('click');
    await flushPromises();

    expect(document.activeElement).toBe(
      wrapper.get<HTMLButtonElement>('.close-button').element,
    );
    await wrapper.get('.editor').trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('.editor').exists()).toBe(false);
    expect(document.activeElement).toBe(editButton.element);
  });
});

function buildConcert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'concert-1',
    title: 'Summer Jam',
    genre: 'Rock',
    startsAt: '2026-08-15T23:00:00.000Z',
    endsAt: '2026-08-16T02:00:00.000Z',
    venue: { id: 'venue-1', name: 'The Pour House', city: 'Raleigh' },
    lineup: [],
    sets: [],
    description: 'Live downtown.',
    catalogStatus: 'active',
    isFeatured: true,
    editorialLockedAt: null,
    version: 7,
    syncSource: {
      source: 'google_calendar',
      calendarId: 'primary',
      calendarEventId: 'event-1',
    },
    ...overrides,
  };
}
