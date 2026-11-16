import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PartnerOnboardingModal from './PartnerOnboardingModal.vue';

const completeOnboarding = vi.fn();
const getIdToken = vi.fn();
const fetchVenues = vi.fn();

vi.mock('../../composables/useAuth', () => ({
  useAuth: () => ({
    completeOnboarding,
    getIdToken,
  }),
}));

vi.mock('../../composables/useApi', async () => {
  const actual = await vi.importActual<typeof import('../../composables/useApi')>(
    '../../composables/useApi',
  );
  return {
    ...actual,
    fetchVenues: (...args: unknown[]) => fetchVenues(...args),
  };
});

describe('PartnerOnboardingModal', () => {
  beforeEach(() => {
    completeOnboarding.mockReset();
    getIdToken.mockReset().mockResolvedValue('mock-token');
    fetchVenues.mockReset().mockResolvedValue([
      {
        id: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
        name: 'Bowstring Brewyard',
        city: 'Raleigh',
        citySlug: 'raleigh',
        region: 'North Carolina',
        regionSlug: 'nc',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '19e888c5-a777-4174-a506-94c34f38480b',
        name: 'The Pour House Music Hall',
        city: 'Raleigh',
        citySlug: 'raleigh',
        region: 'North Carolina',
        regionSlug: 'nc',
        createdAt: '',
        updatedAt: '',
      },
    ]);
  });

  it('filters venues and claims the selected venue', async () => {
    const wrapper = mount(PartnerOnboardingModal);
    await flushPromises();

    await wrapper.find('#venue-claim-search').setValue('Bowstring');
    const options = wrapper.findAll('.onboarding-modal__venue-option');
    expect(options).toHaveLength(1);
    const firstOption = options[0];
    if (!firstOption) {
      throw new Error('Expected one matching venue option');
    }
    expect(firstOption.text()).toContain('Bowstring Brewyard');

    await firstOption.trigger('click');
    await wrapper.find('.btn-claim').trigger('click');
    await flushPromises();

    expect(completeOnboarding).toHaveBeenCalledWith({
      claimedVenueId: 'e6efac75-ab36-46fb-a79d-4c3807a083f0',
    });
  });

  it('allows skipping onboarding as a fan', async () => {
    const wrapper = mount(PartnerOnboardingModal);
    await flushPromises();

    await wrapper.find('.btn-skip').trigger('click');
    await flushPromises();

    expect(completeOnboarding).toHaveBeenCalledWith({ skipAsFan: true });
  });
});
