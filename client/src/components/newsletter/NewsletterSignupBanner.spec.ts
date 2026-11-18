import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterSignupBanner from './NewsletterSignupBanner.vue';
import {
  captureSessionAttribution,
  clearSessionAttribution,
} from '../../utils/analytics';

const api = vi.hoisted(() => ({
  subscribeToNewsletter: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackDiscoveryEvent: vi.fn(),
}));

vi.mock('../../composables/useApi', () => api);
vi.mock('../../utils/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/analytics')>();
  return {
    ...actual,
    trackDiscoveryEvent: analyticsMocks.trackDiscoveryEvent,
  };
});

describe('NewsletterSignupBanner', () => {
  beforeEach(() => {
    api.subscribeToNewsletter.mockReset();
    analyticsMocks.trackDiscoveryEvent.mockReset();
    clearSessionAttribution();
    window.history.replaceState({}, '', '/');
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
    expect(analyticsMocks.trackDiscoveryEvent).toHaveBeenCalledWith(
      'newsletter_subscribe_error',
      {
        source_surface: 'nido_web',
        campaign: 'weekly_top_picks',
      },
    );
  });

  it('forwards ai_referral channel attribution to Beehiiv and emits conversion events without email PII', async () => {
    api.subscribeToNewsletter.mockResolvedValue({
      subscribed: true,
      status: 'active',
    });
    window.history.replaceState({}, '', '/concerts?utm_source=chatgpt.com');
    captureSessionAttribution();

    const wrapper = mount(NewsletterSignupBanner, {
      props: { utmSource: 'nido_concerts_feed' },
    });

    await wrapper
      .get('[data-testid="newsletter-email-input"]')
      .setValue('ai-fan@example.com');
    await wrapper.get('[data-testid="newsletter-signup-form"]').trigger('submit');
    await flushPromises();

    expect(api.subscribeToNewsletter).toHaveBeenCalledWith({
      email: 'ai-fan@example.com',
      utmSource: 'nido_concerts_feed',
      utmMedium: 'ai_referral',
      utmCampaign: 'weekly_top_picks',
    });
    expect(analyticsMocks.trackDiscoveryEvent).toHaveBeenCalledWith(
      'newsletter_subscribe_success',
      {
        source_surface: 'nido_concerts_feed',
        campaign: 'weekly_top_picks',
      },
    );
    for (const [, payload] of analyticsMocks.trackDiscoveryEvent.mock.calls) {
      expect(JSON.stringify(payload)).not.toContain('ai-fan@example.com');
    }
  });
});
