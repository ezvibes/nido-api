import {
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MySubmissionsPage from './MySubmissionsPage.vue';

const api = vi.hoisted(() => ({
  createIngestionJob: vi.fn(),
  fetchIngestionJob: vi.fn(),
  fetchMyIngestionSubmissions: vi.fn(),
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

const routerStubs = {
  RouterLink: {
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
};

describe('MySubmissionsPage', () => {
  beforeEach(() => {
    api.createIngestionJob.mockReset();
    api.fetchIngestionJob.mockReset();
    api.fetchMyIngestionSubmissions.mockReset();

    auth.user!.value = {
      getIdToken: vi.fn().mockResolvedValue('firebase-token'),
    };
    api.fetchMyIngestionSubmissions.mockResolvedValue([]);
  });

  it('renders submission items with status pills and live show link', async () => {
    api.fetchMyIngestionSubmissions.mockResolvedValue([
      {
        id: 'job-pub-1',
        status: 'completed',
        stage: 'completed',
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
        candidates: [
          {
            id: 'cand-1',
            candidateIndex: 0,
            status: 'published',
            publishedConcertId: 'concert-42',
            title: 'Sylvan Esso at The Pour House',
            venueName: 'The Pour House',
            date: '2026-11-07',
          },
        ],
      },
    ]);

    const wrapper = mount(MySubmissionsPage, { global: { stubs: routerStubs } });
    await flushPromises();

    expect(wrapper.text()).toContain('My Poster Submissions');
    expect(wrapper.text()).toContain('Sylvan Esso at The Pour House');
    expect(wrapper.text()).toContain('Published');
    expect(wrapper.text()).toContain('View Live Show →');
  });

  it('shows Needs retry and allows retrying when job failed', async () => {
    api.fetchMyIngestionSubmissions.mockResolvedValue([
      {
        id: 'job-fail-1',
        status: 'retryable_failure',
        stage: 'extraction_failed',
        errorMessage: 'Temporary extraction timeout',
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
      },
    ]);
    api.createIngestionJob.mockResolvedValue({
      id: 'job-fail-1',
      status: 'needs_review',
      stage: 'candidate_pending',
      createdAt: '2026-07-26T16:00:00.000Z',
      updatedAt: '2026-07-26T16:00:00.000Z',
    });

    const wrapper = mount(MySubmissionsPage, { global: { stubs: routerStubs } });
    await flushPromises();

    expect(wrapper.text()).toContain('Needs retry');
    const retryBtn = wrapper.get('.submission-card__retry-btn');
    expect(retryBtn.text()).toBe('Retry');

    await retryBtn.trigger('click');
    await flushPromises();

    expect(api.createIngestionJob).toHaveBeenCalledWith('firebase-token', 'upload-1');
  });
});
