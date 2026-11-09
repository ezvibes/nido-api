import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IngestionUploadPanel from './IngestionUploadPanel.vue';

const api = vi.hoisted(() => ({
  createIngestionJob: vi.fn(),
  fetchBands: vi.fn(),
  fetchConcertGenres: vi.fn(),
  fetchIngestionJob: vi.fn(),
  fetchMyIngestionSubmissions: vi.fn(),
  fetchVenues: vi.fn(),
  uploadIngestionImage: vi.fn(),
}));

const auth = vi.hoisted(() => ({
  user: undefined as
    | {
        value: null | { getIdToken: () => Promise<string> };
      }
    | undefined,
}));

vi.mock('../../composables/useAuth', async () => {
  const { ref } = await import('vue');
  auth.user = ref(null);

  return {
    useAuth: () => ({
      user: auth.user,
    }),
  };
});

vi.mock('../../composables/useApi', () => api);

enableAutoUnmount(afterEach);

const routerStubs = {
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
};

describe('IngestionUploadPanel', () => {
  beforeEach(() => {
    api.createIngestionJob.mockReset();
    api.fetchBands.mockReset();
    api.fetchConcertGenres.mockReset();
    api.fetchIngestionJob.mockReset();
    api.fetchMyIngestionSubmissions.mockReset();
    api.fetchVenues.mockReset();
    api.uploadIngestionImage.mockReset();

    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchConcertGenres.mockResolvedValue({ genres: ['Electronic'] });
    api.fetchVenues.mockResolvedValue([]);
    api.fetchBands.mockResolvedValue([]);
    api.fetchMyIngestionSubmissions.mockResolvedValue([]);
    api.uploadIngestionImage.mockResolvedValue(buildUploadResult());
    api.createIngestionJob.mockResolvedValue(buildJobResponse());
    api.fetchIngestionJob.mockResolvedValue(buildJobResponse());
  });

  it('loads API genres, de-duplicates Other, and includes a canonical selection', async () => {
    api.fetchConcertGenres.mockResolvedValue({
      genres: ['Jazz', 'other', 'Other', 'Funk'],
    });

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();

    expect(api.fetchConcertGenres).toHaveBeenCalledWith();
    const genreInput = wrapper.get<HTMLInputElement>('[role="combobox"]');
    expect(genreInput.attributes('placeholder')).toBe('Select a genre');
    expect(genreInput.element.value).toBe('');

    await genreInput.trigger('focus');
    expect(
      wrapper
        .findAll('[role="option"]')
        .map((option) => option.text())
        .filter((option) => option.toLocaleLowerCase() === 'other'),
    ).toEqual(['Other']);

    await selectGenre(wrapper, 'jazz', 'Jazz');
    await selectValidFile(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({
        genre: 'Jazz',
      }),
    );
  });

  it('submits Other only after explicit selection and resets to empty on clear', async () => {
    api.fetchConcertGenres.mockResolvedValue({ genres: [] });

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();
    const genreInput = wrapper.get<HTMLInputElement>('[role="combobox"]');

    expect(genreInput.element.value).toBe('');
    await selectGenre(wrapper, 'other', 'Other');
    await wrapper.get('button[aria-label="Clear genre"]').trigger('click');
    expect(genreInput.element.value).toBe('');

    await selectGenre(wrapper, 'other', 'Other');
    await selectValidFile(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({ genre: 'Other' }),
    );
  });

  it('does not submit arbitrary user text', async () => {
    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();

    await wrapper
      .get<HTMLInputElement>('[role="combobox"]')
      .setValue('My invented genre');
    await selectValidFile(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage.mock.calls[0]?.[1]).not.toHaveProperty(
      'genre',
    );
  });

  it('submits optional date, venue, and band hints when provided', async () => {
    api.fetchVenues.mockResolvedValue([
      {
        id: 'venue-1',
        name: "The Cat's Cradle",
        city: 'Carrboro',
        region: 'NC',
      },
    ]);
    api.fetchBands.mockResolvedValue([
      {
        id: 'band-1',
        name: 'Archers of Loaf',
        slug: 'archers-of-loaf',
        genres: ['indie rock'],
      },
    ]);

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();

    await wrapper.get('input[aria-label="Concert date"]').setValue('2026-10-15');
    await wrapper.get('select[aria-label="Venue"]').setValue('venue-1');
    await wrapper.get('select[aria-label="Band or artist"]').setValue('band-1');
    await selectValidFile(wrapper);

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({
        concertDate: new Date('2026-10-15').toISOString(),
        venueId: 'venue-1',
        bandId: 'band-1',
        state: 'NC',
      }),
    );
  });

  it('defaults state to NC and normalizes full region "North Carolina" from venue to "NC"', async () => {
    api.fetchVenues.mockResolvedValue([
      {
        id: 'venue-nc',
        name: 'The Orange Peel',
        city: 'Asheville',
        region: 'North Carolina',
        regionSlug: 'nc',
      },
    ]);

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();

    // Default state should be NC
    expect(wrapper.get<HTMLInputElement>('input[placeholder="NC"]').element.value).toBe('NC');

    // Select venue with region 'North Carolina'
    await wrapper.get('select[aria-label="Venue"]').setValue('venue-nc');
    await wrapper.get('select[aria-label="Venue"]').trigger('change');
    await flushPromises();

    // State field remains/normalizes to 'NC'
    expect(wrapper.get<HTMLInputElement>('input[placeholder="NC"]').element.value).toBe('NC');

    await selectValidFile(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage).toHaveBeenCalledWith(
      'firebase-token',
      expect.objectContaining({
        venueId: 'venue-nc',
        city: 'Asheville',
        state: 'NC',
      }),
    );
  });

  it('keeps upload available while genres are loading', async () => {
    api.fetchConcertGenres.mockReturnValue(new Promise(() => undefined));

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await selectValidFile(wrapper);

    expect(wrapper.text()).toContain('Loading current genres…');
    expect(
      wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled,
    ).toBe(false);
    expect(
      wrapper.get<HTMLInputElement>('[role="combobox"]').element.value,
    ).toBe('');
  });

  it('keeps upload available and omits genre when the API returns no genres', async () => {
    api.fetchConcertGenres.mockResolvedValue({ genres: [] });

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();
    await selectValidFile(wrapper);

    expect(wrapper.text()).toContain(
      'No genres are available yet. You can still upload without one.',
    );
    expect(
      wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled,
    ).toBe(false);

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage).toHaveBeenCalledWith(
      'firebase-token',
      expect.any(Object),
    );
    expect(api.uploadIngestionImage.mock.calls[0]?.[1]).not.toHaveProperty(
      'genre',
    );
  });

  it('keeps upload available when genre loading fails', async () => {
    api.fetchConcertGenres.mockRejectedValue(new Error('metadata unavailable'));

    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();
    await selectValidFile(wrapper);

    expect(wrapper.text()).toContain(
      'Genres are unavailable right now. You can still upload without one.',
    );
    expect(
      wrapper.get<HTMLButtonElement>('button[type="submit"]').element.disabled,
    ).toBe(false);

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(api.uploadIngestionImage).toHaveBeenCalledWith(
      'firebase-token',
      expect.any(Object),
    );
    expect(api.uploadIngestionImage.mock.calls[0]?.[1]).not.toHaveProperty(
      'genre',
    );
  });

  it('shows progress and link to dedicated poster submissions view upon upload', async () => {
    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();

    await selectValidFile(wrapper);
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Poster uploaded! Reading show details now.');
    const submissionsLink = wrapper.get('a[href="/my-submissions"]');
    expect(submissionsLink.text()).toContain('View my poster submissions');
  });

  it('supports image-first disclosure toggle for optional details', async () => {
    const wrapper = mount(IngestionUploadPanel, { global: { stubs: routerStubs } });
    await flushPromises();

    const toggle = wrapper.get<HTMLButtonElement>('.ingestion-panel__hints-toggle');
    expect(toggle.attributes('aria-expanded')).toBe('false');
    expect(toggle.text()).toContain('Add optional details');

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(toggle.text()).toContain('Event Details');
  });
});

async function selectValidFile(wrapper: VueWrapper) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  const file = new File(['poster'], 'poster.jpg', { type: 'image/jpeg' });
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  });
  await input.trigger('change');
}

async function selectGenre(
  wrapper: VueWrapper,
  query: string,
  expectedOption: string,
) {
  const input = wrapper.get<HTMLInputElement>('[role="combobox"]');
  await input.trigger('focus');
  await input.setValue(query);
  const option = wrapper
    .findAll('[role="option"]')
    .find((candidate) => candidate.text() === expectedOption);

  if (!option) {
    throw new Error(`Missing ${expectedOption} genre option`);
  }

  await option.trigger('click');
}

function buildUploadResult() {
  return {
    concertUploadId: 'upload-1',
    bucket: 'test-bucket',
    objectName: 'poster.jpg',
    storageUri: 'gs://test-bucket/poster.jpg',
    contentType: 'image/jpeg',
    size: 6,
    originalFilename: 'poster.jpg',
    source: 'flyer_upload',
    uploadedAt: '2026-07-26T16:00:00.000Z',
  };
}

function buildJobResponse() {
  return {
    id: 'job-1',
    status: 'needs_review',
    stage: 'candidate_pending',
    createdAt: '2026-07-26T16:00:00.000Z',
    updatedAt: '2026-07-26T16:00:00.000Z',
    concertUpload: {
      id: 'upload-1',
      storageUri: 'gs://test-bucket/poster.jpg',
      objectName: 'poster.jpg',
      bucket: 'test-bucket',
      mimeType: 'image/jpeg',
      originalFilename: 'poster.jpg',
      source: 'flyer_upload',
      size: 6,
      uploadedByUid: 'uid-1',
      createdAt: '2026-07-26T16:00:00.000Z',
    },
  };
}
