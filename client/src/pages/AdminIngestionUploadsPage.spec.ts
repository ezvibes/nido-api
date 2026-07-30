import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminIngestionUploadsPage from './AdminIngestionUploadsPage.vue';

const api = vi.hoisted(() => ({
  fetchAdminIngestionUploadImageBlob: vi.fn(),
  fetchAdminIngestionUploads: vi.fn(),
  reviewAdminIngestionUpload: vi.fn(),
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

describe('AdminIngestionUploadsPage', () => {
  beforeEach(() => {
    api.fetchAdminIngestionUploadImageBlob.mockReset();
    api.fetchAdminIngestionUploads.mockReset();
    api.reviewAdminIngestionUpload.mockReset();

    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchAdminIngestionUploadImageBlob.mockResolvedValue(
      new Blob(['poster'], { type: 'image/jpeg' }),
    );

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:poster-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('prefills the approval genre from the uploaded poster', async () => {
    const upload = buildUpload({ genre: 'Electronic' });
    api.reviewAdminIngestionUpload.mockResolvedValue({
      ...upload,
      reviewStatus: 'approved',
    });
    const wrapper = await mountWithUpload(upload);

    await openApprovalForm(wrapper);

    expect(getPublishInput(wrapper, 'Genre').element.value).toBe('Electronic');

    await getPublishInput(wrapper, 'Date').setValue('2026-08-01');
    await wrapper.get('.admin-uploads__primary').trigger('click');
    await flushPromises();

    expect(api.reviewAdminIngestionUpload).toHaveBeenCalledWith(
      'firebase-token',
      'upload-1',
      expect.objectContaining({
        status: 'approved',
        concertGenre: 'Electronic',
      }),
    );
  });

  it('falls back to Live Music when the upload has no genre', async () => {
    const wrapper = await mountWithUpload(buildUpload());

    await openApprovalForm(wrapper);

    expect(getPublishInput(wrapper, 'Genre').element.value).toBe('Live Music');
  });
});

async function mountWithUpload(upload: ReturnType<typeof buildUpload>) {
  api.fetchAdminIngestionUploads.mockResolvedValue({
    total: 1,
    items: [upload],
  });

  const wrapper = mount(AdminIngestionUploadsPage);
  await flushPromises();
  return wrapper;
}

async function openApprovalForm(wrapper: VueWrapper) {
  await wrapper.get('.admin-uploads__row').trigger('click');
  await flushPromises();
  await wrapper.get('.admin-uploads__decision--approve').trigger('click');
}

function getPublishInput(wrapper: VueWrapper, label: string) {
  const field = wrapper
    .findAll('.admin-uploads__publish-grid label')
    .find((candidate) => candidate.get('span').text() === label);

  if (!field) {
    throw new Error(`Missing ${label} approval field`);
  }

  return field.get<HTMLInputElement>('input');
}

function buildUpload(overrides: { genre?: string } = {}) {
  return {
    id: 'upload-1',
    storageUri: 'gs://test-bucket/poster.jpg',
    bucket: 'test-bucket',
    objectName: 'poster.jpg',
    mimeType: 'image/jpeg',
    originalFilename: 'electronic-night.jpg',
    size: 6,
    city: 'Raleigh',
    state: 'NC',
    source: 'flyer_upload',
    uploadedByUid: 'uid-1',
    uploadedByUserEmail: 'user@example.local',
    createdAt: '2026-07-26T16:00:00.000Z',
    reviewStatus: 'submitted' as const,
    ...overrides,
  };
}
