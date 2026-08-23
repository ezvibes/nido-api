import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminConcertsPage from './AdminConcertsPage.vue';

const api = vi.hoisted(() => ({
  fetchAdminConcerts: vi.fn(),
  fetchConcertGenres: vi.fn(),
  fetchVenues: vi.fn(),
  updateAdminConcert: vi.fn(),
  setConcertApproval: vi.fn(),
  createConcert: vi.fn(),
  uploadConcertPoster: vi.fn(),
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
      pageSize: 25,
    });
  });

  it('loads the active catalog with authenticated admin filters', async () => {
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    expect(api.fetchAdminConcerts).toHaveBeenCalledWith('firebase-token', {
      q: undefined,
      catalogStatus: 'active',
      isFeatured: undefined,
      startsAfter: undefined,
      startsBefore: undefined,
      sort: 'soonest',
      page: 1,
      pageSize: 25,
    });
    expect(wrapper.text()).toContain('Summer Jam');
    expect(wrapper.text()).toContain('1 concert');
  });

  it('filters by date window and sort order', async () => {
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const selects = wrapper.findAll('.select-filter select');
    const dateSelect = selects[0]!;
    const sortSelect = selects[1]!;

    await dateSelect.setValue('week');
    await sortSelect.setValue('latest');
    await flushPromises();

    expect(api.fetchAdminConcerts).toHaveBeenLastCalledWith(
      'firebase-token',
      expect.objectContaining({
        catalogStatus: 'active',
        sort: 'latest',
        startsAfter: expect.any(String),
        startsBefore: expect.any(String),
        page: 1,
        pageSize: 25,
      }),
    );
  });

  it('paginates through the complete admin catalog', async () => {
    api.fetchAdminConcerts
      .mockResolvedValueOnce({
        data: [buildConcert()],
        total: 30,
        page: 1,
        pageSize: 25,
      })
      .mockResolvedValueOnce({
        data: [buildConcert({ id: 'concert-26', title: 'Late Page Show' })],
        total: 30,
        page: 2,
        pageSize: 25,
      });

    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    expect(wrapper.text()).toContain('1-1 of 30 concerts');
    await wrapper.get('.catalog-pagination button:last-child').trigger('click');
    await flushPromises();

    expect(api.fetchAdminConcerts).toHaveBeenLastCalledWith('firebase-token', {
      q: undefined,
      catalogStatus: 'active',
      isFeatured: undefined,
      startsAfter: undefined,
      startsBefore: undefined,
      sort: 'soonest',
      page: 2,
      pageSize: 25,
    });
    expect(wrapper.text()).toContain('Late Page Show');
    expect(wrapper.text()).toContain('Page 2 of 2');
  });

  it('toggles Top Picks approval state for a concert', async () => {
    api.setConcertApproval.mockResolvedValue({
      id: 'concert-1',
      isAdminApproved: true,
    });

    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const approveButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text().includes('Approve Top Pick'));
    expect(approveButton).toBeDefined();

    await approveButton!.trigger('click');
    await flushPromises();

    expect(api.setConcertApproval).toHaveBeenCalledWith(
      'firebase-token',
      'concert-1',
      true,
    );
    expect(wrapper.text()).toContain('approved for Top Picks');
  });

  it('hides a concert using the version returned by the API', async () => {
    api.updateAdminConcert.mockResolvedValue(
      buildConcert({ catalogStatus: 'hidden', isFeatured: false, version: 8 }),
    );
    api.fetchAdminConcerts
      .mockResolvedValueOnce({
        data: [buildConcert()],
        total: 1,
        page: 1,
        pageSize: 25,
      })
      .mockResolvedValueOnce({ data: [], total: 0, page: 1, pageSize: 25 });
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const hideButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text() === 'Hide');
    await hideButton!.trigger('click');
    await flushPromises();

    expect(api.updateAdminConcert).toHaveBeenCalledWith(
      'firebase-token',
      'concert-1',
      { expectedVersion: 7, catalogStatus: 'hidden' },
    );
    expect(wrapper.find('.concert-row').exists()).toBe(false);
    expect(wrapper.text()).toContain('Summer Jam is now hidden.');
  });

  it('edits content without exposing synchronization controls', async () => {
    api.updateAdminConcert.mockResolvedValue(
      buildConcert({ title: 'Summer Jam Updated', version: 8 }),
    );
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const editButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text() === 'Edit');
    await editButton!.trigger('click');

    expect(wrapper.text()).not.toContain('Calendar updates');
    expect(wrapper.text()).not.toContain('Resume updates');

    await wrapper
      .get<HTMLInputElement>('.editor .field--wide input')
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
    expect(api.fetchAdminConcerts).toHaveBeenCalledTimes(2);
  });

  it('creates a new concert via the Add Concert modal', async () => {
    api.createConcert.mockResolvedValue(
      buildConcert({ id: 'concert-new', title: 'New Funk Show' }),
    );

    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const addButton = wrapper
      .findAll('.catalog-admin__header button')
      .find((b) => b.text().includes('Add Concert'));
    await addButton!.trigger('click');

    expect(wrapper.text()).toContain('Add new concert');

    await wrapper
      .get<HTMLInputElement>('.editor input[placeholder="e.g. Dr. Bacon & Friends"]')
      .setValue('New Funk Show');
    await wrapper
      .get<HTMLSelectElement>('.editor select')
      .setValue('venue-1');

    await wrapper.get('.editor').trigger('submit');
    await flushPromises();

    expect(api.createConcert).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({
        title: 'New Funk Show',
        venueId: 'venue-1',
      }),
    );
    expect(wrapper.text()).toContain('Successfully created New Funk Show!');
  });

  it('reloads totals after a successful mutation changes the filtered result set', async () => {
    api.fetchAdminConcerts
      .mockResolvedValueOnce({
        data: [buildConcert()],
        total: 26,
        page: 1,
        pageSize: 25,
      })
      .mockResolvedValueOnce({
        data: [],
        total: 0,
        page: 1,
        pageSize: 25,
      });
    api.updateAdminConcert.mockResolvedValue(
      buildConcert({ catalogStatus: 'hidden', isFeatured: false, version: 8 }),
    );
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const hideButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text() === 'Hide');
    await hideButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('0 concerts');
    expect(wrapper.find('.catalog-pagination').exists()).toBe(false);
  });

  it('requires in-app confirmation before archiving', async () => {
    api.updateAdminConcert.mockResolvedValue(
      buildConcert({ catalogStatus: 'archived', version: 8 }),
    );
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const archive = wrapper
      .findAll('.concert-row__actions button')
      .find((button) => button.text() === 'Archive');
    await archive!.trigger('click');

    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Summer Jam');
    expect(api.updateAdminConcert).not.toHaveBeenCalled();

    await wrapper.get('[role="alertdialog"] .button--secondary').trigger('click');
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    expect(api.updateAdminConcert).not.toHaveBeenCalled();

    await archive!.trigger('click');
    await wrapper.get('[role="alertdialog"]').trigger('keydown', {
      key: 'Escape',
    });
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    expect(api.updateAdminConcert).not.toHaveBeenCalled();

    await archive!.trigger('click');
    await wrapper.get('[role="alertdialog"] .button--danger').trigger('click');
    await flushPromises();

    expect(api.updateAdminConcert).toHaveBeenCalledWith(
      'firebase-token',
      'concert-1',
      { expectedVersion: 7, catalogStatus: 'archived' },
    );
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
  });

  it('closes a stale editor and keeps the conflict guidance visible', async () => {
    api.updateAdminConcert.mockRejectedValue({ response: { status: 409 } });
    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    const editButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text() === 'Edit');
    await editButton!.trigger('click');
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

    const editButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text() === 'Edit');
    (editButton!.element as HTMLElement).focus();
    await editButton!.trigger('click');
    await flushPromises();

    expect(document.activeElement).toBe(
      wrapper.get<HTMLButtonElement>('.close-button').element,
    );
    await wrapper.get('.editor').trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.find('.editor').exists()).toBe(false);
    expect(document.activeElement).toBe(editButton!.element);
  });

  it('displays the resolved poster preview in the edit modal', async () => {
    api.fetchAdminConcerts.mockResolvedValueOnce({
      data: [
        buildConcert({
          posterUrl: '/ingestion/uploads/sample-123/image',
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });

    const wrapper = mount(AdminConcertsPage);
    await flushPromises();

    // Table row should not have broken thumbnail
    expect(wrapper.find('.concert-row__thumbnail').exists()).toBe(false);

    const editButton = wrapper
      .findAll('.concert-row__actions button')
      .find((b) => b.text() === 'Edit');
    await editButton!.trigger('click');
    await flushPromises();

    expect(wrapper.find('.poster-preview').exists()).toBe(true);
    const img = wrapper.get('.poster-thumbnail');
    expect(img.attributes('src')).toContain('/ingestion/uploads/sample-123/image');
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
