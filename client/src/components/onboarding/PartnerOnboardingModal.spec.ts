import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import PartnerOnboardingModal from './PartnerOnboardingModal.vue';

const completeOnboarding = vi.fn();

vi.mock('../../composables/useAuth', () => ({
  PARTNER_INVITE_STORAGE_KEY: 'nido_partner_invite_code',
  useAuth: () => ({
    completeOnboarding,
  }),
}));

describe('PartnerOnboardingModal', () => {
  beforeEach(() => {
    completeOnboarding.mockReset();
    window.sessionStorage.clear();
  });

  it('redeems a partner invite code and clears sessionStorage', async () => {
    completeOnboarding.mockResolvedValue({
      id: 4,
      venueClaimStatus: 'verified',
    });

    const wrapper = mount(PartnerOnboardingModal);
    await wrapper.get('[data-testid="partner-invite-input"]').setValue('nido-8f3k9a2b');
    await wrapper.get('[data-testid="redeem-invite-btn"]').trigger('click');
    await flushPromises();

    expect(completeOnboarding).toHaveBeenCalledWith({
      inviteCode: 'NIDO-8F3K9A2B',
    });
  });

  it('pre-fills invite code from sessionStorage when opened from an invite link', async () => {
    window.sessionStorage.setItem('nido_partner_invite_code', 'NIDO-BOWSTRNG');
    completeOnboarding.mockResolvedValue({
      id: 4,
      venueClaimStatus: 'verified',
    });

    const wrapper = mount(PartnerOnboardingModal);
    await flushPromises();

    const input = wrapper.get('[data-testid="partner-invite-input"]');
    expect((input.element as HTMLInputElement).value).toBe('NIDO-BOWSTRNG');

    await wrapper.get('[data-testid="redeem-invite-btn"]').trigger('click');
    await flushPromises();

    expect(completeOnboarding).toHaveBeenCalledWith({
      inviteCode: 'NIDO-BOWSTRNG',
    });
    expect(window.sessionStorage.getItem('nido_partner_invite_code')).toBeNull();
  });

  it('displays backend error message when invite code is invalid or restricted', async () => {
    completeOnboarding.mockRejectedValue({
      response: {
        data: {
          message: 'This invite code is restricted to a different email address.',
        },
      },
    });

    const wrapper = mount(PartnerOnboardingModal);
    await wrapper.get('[data-testid="partner-invite-input"]').setValue('NIDO-RESTRICT');
    await wrapper.get('[data-testid="redeem-invite-btn"]').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="onboarding-error"]').text()).toContain(
      'This invite code is restricted to a different email address.',
    );
  });

  it('allows skipping onboarding as a fan', async () => {
    window.sessionStorage.setItem('nido_partner_invite_code', 'NIDO-UNUSED');
    const wrapper = mount(PartnerOnboardingModal);
    await flushPromises();

    await wrapper.get('[data-testid="skip-fan-btn"]').trigger('click');
    await flushPromises();

    expect(completeOnboarding).toHaveBeenCalledWith({ skipAsFan: true });
    expect(window.sessionStorage.getItem('nido_partner_invite_code')).toBeNull();
  });
});
