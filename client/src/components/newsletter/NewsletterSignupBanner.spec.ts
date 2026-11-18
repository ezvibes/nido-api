import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterSignupBanner from './NewsletterSignupBanner.vue';

const api = vi.hoisted(() => ({
  subscribeToNewsletter: vi.fn(),
}));

vi.mock('../../composables/useApi', () => api);

describe('NewsletterSignupBanner', () => {
  beforeEach(() => {
    api.subscribeToNewsletter.mockReset();
  });

  it('submits the subscriber email with UTM attribution and shows confirmation message', async () => {
    api.subscribeToNewsletter.mockResolvedValue({
      subscribed: true,
      status: 'active',
    });

    const wrapper = mount(NewsletterSignupBanner, {
      props: { utmSource: 'nido_concert_detail' },
    });

    await wrapper
      .get('[data-testid="newsletter-email-input"]')
      .setValue('fan@example.com');
    await wrapper.get('[data-testid="newsletter-signup-form"]').trigger('submit');
    await flushPromises();

    expect(api.subscribeToNewsletter).toHaveBeenCalledWith({
      email: 'fan@example.com',
      utmSource: 'nido_concert_detail',
      utmMedium: 'organic',
      utmCampaign: 'weekly_top_picks',
    });
    expect(
      wrapper.get('[data-testid="newsletter-signup-success"]').text(),
    ).toContain("You're on the list!");
  });

  it('shows an error alert when subscription request fails', async () => {
    api.subscribeToNewsletter.mockRejectedValue(new Error('Network error'));

    const wrapper = mount(NewsletterSignupBanner);
    await wrapper
      .get('[data-testid="newsletter-email-input"]')
      .setValue('fan@example.com');
    await wrapper.get('[data-testid="newsletter-signup-form"]').trigger('submit');
    await flushPromises();

    expect(
      wrapper.get('[data-testid="newsletter-signup-error"]').text(),
    ).toContain('Unable to subscribe right now');
  });
});
