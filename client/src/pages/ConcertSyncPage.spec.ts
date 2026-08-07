import { enableAutoUnmount, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConcertSyncPage from './ConcertSyncPage.vue';

vi.mock('../composables/useAuth', async () => {
  const { ref } = await import('vue');
  return {
    useAuth: () => ({ user: ref(null) }),
  };
});

vi.mock('../composables/useApi', () => ({
  createConcertSyncJob: vi.fn(),
  fetchConcertSyncJob: vi.fn(),
  fetchConcertSyncJobs: vi.fn(),
}));

enableAutoUnmount(afterEach);

describe('ConcertSyncPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 6, 14, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults the sync window to today through one week later', () => {
    const wrapper = mountPage();
    const dateInputs = wrapper.findAll<HTMLInputElement>(
      'input[type="datetime-local"]',
    );

    expect(dateInputs).toHaveLength(2);
    expect(dateInputs[0]?.element.value).toBe('2026-08-06T00:00');
    expect(dateInputs[1]?.element.value).toBe('2026-08-13T00:00');
  });

  it('defaults dry run to off', () => {
    const wrapper = mountPage();
    const dryRun = wrapper
      .findAll('label')
      .find((label) => label.text().includes('Dry run'));

    expect(dryRun).toBeDefined();
    expect(dryRun!.get<HTMLInputElement>('input').element.checked).toBe(false);
  });
});

function mountPage() {
  return mount(ConcertSyncPage, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
      },
    },
  });
}
