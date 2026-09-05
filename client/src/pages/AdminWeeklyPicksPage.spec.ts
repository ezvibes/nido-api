import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminWeeklyPicksPage from './AdminWeeklyPicksPage.vue';

const api = vi.hoisted(() => ({
  generateNewsletter: vi.fn(),
  previewNewsletterSources: vi.fn(),
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

describe('AdminWeeklyPicksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.previewNewsletterSources.mockResolvedValue({
      dateRangeLabel: 'September 2026',
      concerts: [
        {
          id: 'concert-1',
          title: 'Dr. Bacon Live',
          date: 'Friday, Sep 4, 2026',
          venue: 'The Pour House (Raleigh, NC)',
          artists: 'Dr. Bacon',
          genre: 'Funk',
          isTopPick: true,
          topPickScore: 0.9,
          isHighlightArtist: true,
          isPartnerArtist: true,
          source: 'Nido Concert Database',
        },
      ],
      calendarEvents: [],
      concertsCount: 1,
      calendarEventsCount: 0,
      totalCount: 1,
    });
    api.generateNewsletter.mockResolvedValue({
      newsletterDraft: '# Weekly Picks',
      concertsCount: 1,
    });
  });

  it('previews source concerts without generating a newsletter draft', async () => {
    const wrapper = mount(AdminWeeklyPicksPage);
    await flushPromises();

    await wrapper.get('#startDate').setValue('2026-09-01');
    await wrapper.get('#endDate').setValue('2026-09-07');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Preview Source Concerts'))!
      .trigger('click');
    await flushPromises();

    expect(api.previewNewsletterSources).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-07T23:59:59.999Z',
        useDatabase: true,
      }),
    );
    expect(api.generateNewsletter).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('1');
    expect(wrapper.text()).toContain('source item ready for generation');
    expect(wrapper.text()).toContain('Dr. Bacon Live');
    expect(wrapper.text()).toContain('Approved Nido Concerts (1)');
  });

  it('generates from the same payload shape after previewing sources', async () => {
    const wrapper = mount(AdminWeeklyPicksPage);
    await flushPromises();

    await wrapper.get('#startDate').setValue('2026-09-01');
    await wrapper.get('#endDate').setValue('2026-09-07');
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Preview Source Concerts'))!
      .trigger('click');
    await flushPromises();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.generateNewsletter).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-07T23:59:59.999Z',
        useDatabase: true,
      }),
    );
    expect(wrapper.text()).toContain('Matches the latest source preview');
    expect(wrapper.find('textarea.newsletter-output-editor').exists()).toBe(true);
  });

  it('shows a clear empty preview state without calling Gemini', async () => {
    api.previewNewsletterSources.mockResolvedValue({
      dateRangeLabel: 'September 2026',
      concerts: [],
      calendarEvents: [],
      concertsCount: 0,
      calendarEventsCount: 0,
      totalCount: 0,
    });

    const wrapper = mount(AdminWeeklyPicksPage);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Preview Source Concerts'))!
      .trigger('click');
    await flushPromises();

    expect(api.generateNewsletter).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No source concerts match these parameters');
    expect(wrapper.text()).toContain('No approved Nido concerts match this range.');
  });
});
