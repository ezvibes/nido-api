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
  fetchConcertGenres: vi.fn(),
  fetchIngestionJob: vi.fn(),
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

describe('IngestionUploadPanel', () => {
  beforeEach(() => {
    api.createIngestionJob.mockReset();
    api.fetchConcertGenres.mockReset();
    api.fetchIngestionJob.mockReset();
    api.uploadIngestionImage.mockReset();

    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchConcertGenres.mockResolvedValue({ genres: ['Electronic'] });
    api.uploadIngestionImage.mockResolvedValue(buildUploadResult());
    api.createIngestionJob.mockResolvedValue(buildJobResponse());
    api.fetchIngestionJob.mockResolvedValue(buildJobResponse());
  });

  it('loads API genres, de-duplicates Other, and includes a canonical selection', async () => {
    api.fetchConcertGenres.mockResolvedValue({
      genres: ['Jazz', 'other', 'Other', 'Funk'],
    });

    const wrapper = mount(IngestionUploadPanel);
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

    const wrapper = mount(IngestionUploadPanel);
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
    const wrapper = mount(IngestionUploadPanel);
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

  it('keeps upload available while genres are loading', async () => {
    api.fetchConcertGenres.mockReturnValue(new Promise(() => undefined));

    const wrapper = mount(IngestionUploadPanel);
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

    const wrapper = mount(IngestionUploadPanel);
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

    const wrapper = mount(IngestionUploadPanel);
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
