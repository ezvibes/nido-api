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
  fetchConcertGenres: vi.fn(),
  reviewAdminIngestionUpload: vi.fn(),
  fetchAdminIngestionCandidates: vi.fn(),
  fetchAdminIngestionCandidate: vi.fn(),
  publishAdminCandidate: vi.fn(),
  submitAdminDuplicateDecision: vi.fn(),
  rejectAdminCandidate: vi.fn(),
  fetchVenues: vi.fn(),
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
    api.fetchConcertGenres.mockReset();
    api.reviewAdminIngestionUpload.mockReset();
    api.fetchAdminIngestionCandidates.mockReset();
    api.fetchAdminIngestionCandidate.mockReset();
    api.publishAdminCandidate.mockReset();
    api.submitAdminDuplicateDecision.mockReset();
    api.rejectAdminCandidate.mockReset();
    api.fetchVenues.mockReset();

    api.fetchAdminIngestionCandidates.mockResolvedValue({ total: 0, items: [] });
    api.fetchAdminIngestionCandidate.mockResolvedValue({ candidate: {}, probableDuplicates: [] });
    api.fetchVenues.mockResolvedValue([]);

    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchAdminIngestionUploadImageBlob.mockResolvedValue(
      new Blob(['poster'], { type: 'image/jpeg' }),
    );
    api.fetchConcertGenres.mockResolvedValue({
      genres: ['Electronic', 'Jazz'],
    });

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
    const upload = buildUpload({ genre: '  Electronic  ' });
    api.reviewAdminIngestionUpload.mockResolvedValue({
      ...upload,
      reviewStatus: 'approved',
    });
    const wrapper = await mountWithUpload(upload);

    await openApprovalForm(wrapper);

    expect(getGenreInput(wrapper).element.value).toBe('Electronic');

    await selectGenre(wrapper, 'jazz', 'Jazz');
    await getPublishInput(wrapper, 'Date').setValue('2026-08-01');
    await wrapper.get('.admin-uploads__primary').trigger('click');
    await flushPromises();

    expect(api.reviewAdminIngestionUpload).toHaveBeenCalledWith(
      'firebase-token',
      'upload-1',
      expect.objectContaining({
        status: 'approved',
        concertGenre: 'Jazz',
      }),
    );
  });

  it('uses an empty draft and payload when the upload has no genre', async () => {
    const upload = buildUpload({ genre: '   ' });
    api.reviewAdminIngestionUpload.mockResolvedValue({
      ...upload,
      reviewStatus: 'approved',
    });
    const wrapper = await mountWithUpload(upload);

    await openApprovalForm(wrapper);

    expect(getGenreInput(wrapper).element.value).toBe('');

    await getPublishInput(wrapper, 'Date').setValue('2026-08-01');
    await wrapper.get('.admin-uploads__primary').trigger('click');
    await flushPromises();

    expect(api.reviewAdminIngestionUpload).toHaveBeenCalledWith(
      'firebase-token',
      'upload-1',
      expect.objectContaining({
        concertGenre: '',
      }),
    );
  });

  it('allows an admin to submit a new custom genre', async () => {
    const upload = buildUpload({ genre: 'Electronic' });
    api.reviewAdminIngestionUpload.mockResolvedValue({
      ...upload,
      reviewStatus: 'approved',
    });
    const wrapper = await mountWithUpload(upload);

    await openApprovalForm(wrapper);
    await getGenreInput(wrapper).setValue('Neo Soul');
    await getPublishInput(wrapper, 'Date').setValue('2026-08-01');
    await wrapper.get('.admin-uploads__primary').trigger('click');
    await flushPromises();

    expect(api.reviewAdminIngestionUpload).toHaveBeenCalledWith(
      'firebase-token',
      'upload-1',
      expect.objectContaining({
        concertGenre: 'Neo Soul',
      }),
    );
  });

  it('prefills date, venue, and band drafts from upload hints', async () => {
    const upload = buildUpload({
      concertDate: '2026-10-15T00:00:00.000Z',
      venueName: "The Cat's Cradle",
      bandName: 'Archers of Loaf',
      genre: 'Indie Rock',
    });
    api.reviewAdminIngestionUpload.mockResolvedValue({
      ...upload,
      reviewStatus: 'approved',
    });
    const wrapper = await mountWithUpload(upload);

    await openApprovalForm(wrapper);

    expect(getPublishInput(wrapper, 'Date').element.value).toBe('2026-10-15');
    expect(getPublishInput(wrapper, 'Venue').element.value).toBe(
      "The Cat's Cradle",
    );
    expect(getPublishInput(wrapper, 'Band / lineup').element.value).toBe(
      'Archers of Loaf',
    );

    await wrapper.get('.admin-uploads__primary').trigger('click');
    await flushPromises();

    expect(api.reviewAdminIngestionUpload).toHaveBeenCalledWith(
      'firebase-token',
      'upload-1',
      expect.objectContaining({
        status: 'approved',
        concertVenueName: "The Cat's Cradle",
        concertBandName: 'Archers of Loaf',
        concertStartsAt: expect.stringContaining('2026-10-15'),
      }),
    );
  });

  it('renders candidates in Show Review Queue and pre-selects first pending show', async () => {
    const cand = buildCandidate();
    api.fetchAdminIngestionCandidates.mockResolvedValue({
      total: 1,
      items: [cand],
    });
    api.fetchAdminIngestionCandidate.mockResolvedValue({
      candidate: cand,
      probableDuplicates: [],
    });

    const wrapper = mount(AdminIngestionUploadsPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Doctor S with The Vibe Trio');
    expect(wrapper.text()).toContain('The Pour House');
    expect(wrapper.get('.btn-publish-primary').text()).toContain('Approve & Publish Show');
  });

  it('publishes show with duration tracking in <= 3 clicks', async () => {
    const cand = buildCandidate();
    api.fetchAdminIngestionCandidates.mockResolvedValue({
      total: 1,
      items: [cand],
    });
    api.fetchAdminIngestionCandidate.mockResolvedValue({
      candidate: cand,
      probableDuplicates: [],
    });
    api.publishAdminCandidate.mockResolvedValue({ publishedConcertId: 'concert-100' });

    const wrapper = mount(AdminIngestionUploadsPage);
    await flushPromises();

    await wrapper.get('.btn-publish-primary').trigger('click');
    await flushPromises();

    expect(api.publishAdminCandidate).toHaveBeenCalledWith(
      'firebase-token',
      'cand-1',
      expect.objectContaining({
        title: 'Doctor S with The Vibe Trio',
        date: '2026-11-07',
        time: '20:00',
        reviewDurationMs: expect.any(Number),
      }),
    );
  });

  it('resolves duplicate conflict via side-by-side modal', async () => {
    const cand = buildCandidate();
    const existingConcert = {
      id: 'concert-99',
      title: 'Doctor S Trio',
      startsAt: '2026-11-07T20:00:00.000Z',
      venue: { id: 'venue-1', name: 'The Pour House', city: 'Raleigh' },
      lineup: [{ band: { name: 'Doctor S' } }],
    };
    api.fetchAdminIngestionCandidates.mockResolvedValue({
      total: 1,
      items: [cand],
    });
    api.fetchAdminIngestionCandidate.mockResolvedValue({
      candidate: cand,
      probableDuplicates: [existingConcert],
    });
    api.submitAdminDuplicateDecision.mockResolvedValue({ status: 'published' });

    const wrapper = mount(AdminIngestionUploadsPage);
    await flushPromises();

    const dupBtn = wrapper.get('.btn-duplicate-resolve');
    expect(dupBtn.text()).toContain('Resolve Duplicate');
    await dupBtn.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Possible Duplicate Conflict');
    expect(wrapper.text()).toContain('Doctor S Trio');

    await wrapper.get('.duplicate-action-card--link').trigger('click');
    await flushPromises();

    expect(api.submitAdminDuplicateDecision).toHaveBeenCalledWith(
      'firebase-token',
      'cand-1',
      expect.objectContaining({
        decision: 'link',
        targetConcertId: 'concert-99',
        reviewDurationMs: expect.any(Number),
      }),
    );
  });

  it('rejects a candidate with reason', async () => {
    const cand = buildCandidate();
    api.fetchAdminIngestionCandidates.mockResolvedValue({
      total: 1,
      items: [cand],
    });
    api.fetchAdminIngestionCandidate.mockResolvedValue({
      candidate: cand,
      probableDuplicates: [],
    });
    api.rejectAdminCandidate.mockResolvedValue({ status: 'rejected' });

    const wrapper = mount(AdminIngestionUploadsPage);
    await flushPromises();

    await wrapper.get('.btn-reject-show').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Reject Poster / Show Listing');
    await wrapper.get('.btn-confirm-reject').trigger('click');
    await flushPromises();

    expect(api.rejectAdminCandidate).toHaveBeenCalledWith(
      'firebase-token',
      'cand-1',
      expect.stringContaining('Not a live music concert event'),
    );
  });
});

function buildCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cand-1',
    status: 'pending' as const,
    candidateIndex: 0,
    ingestionJobId: 'job-1',
    publishedConcertId: null,
    provenance: {
      title: { rawValue: 'Doctor S with The Vibe Trio', confidence: 0.95 },
      date: { rawValue: '2026-11-07', confidence: 0.98 },
      time: { rawValue: '20:00', confidence: 0.9 },
      venue: { rawValue: 'The Pour House', confidence: 0.92 },
      bands: [{ rawValue: 'Doctor S' }, { rawValue: 'The Vibe Trio' }],
    },
    suggestedVenueId: 'venue-1',
    createdAt: '2026-10-25T16:00:00.000Z',
    upload: {
      id: 'upload-1',
      originalFilename: 'pour-house-nov7.jpg',
      city: 'Raleigh',
      state: 'NC',
      uploadedByUid: 'user-1',
      uploadedByUserEmail: 'camille@example.com',
      createdAt: '2026-10-25T16:00:00.000Z',
      posterUrl: '/admin/ingestion/uploads/upload-1/image',
    },
    ...overrides,
  };
}

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
    .find((candidate) => {
      const fieldLabel = candidate.find('span');
      return fieldLabel.exists() && fieldLabel.text() === label;
    });

  if (!field) {
    throw new Error(`Missing ${label} approval field`);
  }

  return field.get<HTMLInputElement>('input');
}

function getGenreInput(wrapper: VueWrapper) {
  return wrapper.get<HTMLInputElement>('[role="combobox"]');
}

async function selectGenre(
  wrapper: VueWrapper,
  query: string,
  expectedOption: string,
) {
  const input = getGenreInput(wrapper);
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

function buildUpload(overrides: Record<string, unknown> = {}) {
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
