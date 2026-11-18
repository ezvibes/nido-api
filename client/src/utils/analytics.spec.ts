import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  captureSessionAttribution,
  classifyTrafficSource,
  clearSessionAttribution,
  getSessionAttribution,
  resetTrackedPagePathForTest,
  resolveNewsletterAttribution,
  trackDiscoveryEvent,
  trackPageView,
} from './analytics';

const analyticsMocks = vi.hoisted(() => ({
  getAnalyticsClient: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock('../firebase', () => ({
  getAnalyticsClient: analyticsMocks.getAnalyticsClient,
}));

vi.mock('firebase/analytics', () => ({
  logEvent: analyticsMocks.logEvent,
}));

describe('analytics attribution and tracking', () => {
  beforeEach(() => {
    clearSessionAttribution();
    resetTrackedPagePathForTest();
    analyticsMocks.getAnalyticsClient.mockReset();
    analyticsMocks.logEvent.mockReset();
  });

  it('classifies AI assistant referrers accurately and does not confuse Gemini with Google Search', () => {
    expect(
      classifyTrafficSource({
        referrer: 'https://chatgpt.com/c/1234',
        pathname: '/concerts',
      }),
    ).toMatchObject({
      channel: 'ai_referral',
      source: 'chatgpt',
      medium: 'ai',
      referrerHost: 'chatgpt.com',
      landingPath: '/concerts',
    });

    expect(
      classifyTrafficSource({
        referrer: 'https://www.perplexity.ai/search/raleigh-shows',
        pathname: '/concerts/c1',
      }),
    ).toMatchObject({
      channel: 'ai_referral',
      source: 'perplexity',
      medium: 'ai',
    });

    expect(
      classifyTrafficSource({
        referrer: 'https://gemini.google.com/app',
        pathname: '/concerts',
      }),
    ).toMatchObject({
      channel: 'ai_referral',
      source: 'gemini',
      medium: 'ai',
    });

    expect(
      classifyTrafficSource({
        referrer: 'https://claude.ai/chat/xyz',
        pathname: '/',
      }),
    ).toMatchObject({
      channel: 'ai_referral',
      source: 'claude',
      medium: 'ai',
    });
  });

  it('classifies organic search, social, email, UTM referrals, and internal direct traffic', () => {
    expect(
      classifyTrafficSource({
        referrer: 'https://www.google.com/search?q=raleigh+concerts',
        pathname: '/concerts?city=raleigh',
      }),
    ).toMatchObject({
      channel: 'organic_search',
      source: 'google',
      medium: 'organic',
    });

    expect(
      classifyTrafficSource({
        referrer: 'https://l.instagram.com/',
        pathname: '/concerts',
      }),
    ).toMatchObject({
      channel: 'social',
      source: 'instagram',
      medium: 'social',
    });

    expect(
      classifyTrafficSource({
        search: '?utm_source=beehiiv&utm_medium=email&utm_campaign=tps2',
        pathname: '/concerts/123',
      }),
    ).toMatchObject({
      channel: 'email',
      source: 'beehiiv',
      medium: 'email',
      campaign: 'tps2',
    });

    expect(
      classifyTrafficSource({
        referrer: 'https://nido-api-9ed65.web.app/concerts',
        pathname: '/concerts/123',
      }),
    ).toMatchObject({
      channel: 'direct',
      source: 'direct',
      medium: 'none',
    });
  });

  it('preserves first-touch session attribution and upgrades direct sessions when referral parameters arrive', () => {
    const first = captureSessionAttribution();
    expect(first.channel).toBe('direct');

    const storedAfterDirect = getSessionAttribution();
    expect(storedAfterDirect.channel).toBe('direct');

    clearSessionAttribution();
    window.history.replaceState({}, '', '/concerts?utm_source=chatgpt.com');
    const aiTouch = captureSessionAttribution();
    expect(aiTouch.channel).toBe('ai_referral');
    expect(aiTouch.source).toBe('chatgpt.com');

    window.history.replaceState({}, '', '/concerts/123');
    expect(getSessionAttribution()).toMatchObject({
      channel: 'ai_referral',
      source: 'chatgpt.com',
      landingPath: '/concerts?utm_source=chatgpt.com',
    });
    window.history.replaceState({}, '', '/');
  });

  it('maps session channel into Beehiiv newsletter attribution cleanly', () => {
    expect(
      resolveNewsletterAttribution(
        { utmSource: 'nido_concert_detail' },
        {
          channel: 'ai_referral',
          source: 'perplexity',
          medium: 'ai',
          landingPath: '/concerts/1',
          capturedAt: '2026-11-18T00:00:00.000Z',
        },
      ),
    ).toEqual({
      utmSource: 'nido_concert_detail',
      utmMedium: 'ai_referral',
      utmCampaign: 'weekly_top_picks',
    });

    expect(
      resolveNewsletterAttribution(
        { utmSource: 'nido_concerts_feed' },
        {
          channel: 'direct',
          source: 'direct',
          medium: 'none',
          landingPath: '/concerts',
          capturedAt: '2026-11-18T00:00:00.000Z',
        },
      ),
    ).toEqual({
      utmSource: 'nido_concerts_feed',
      utmMedium: 'organic',
      utmCampaign: 'weekly_top_picks',
    });
  });

  it('logs sanitized events with session attribution when Firebase Analytics is active and skips disallowed PII fields', async () => {
    const fakeAnalytics = { app: {} };
    analyticsMocks.getAnalyticsClient.mockResolvedValue(fakeAnalytics);

    window.history.replaceState({}, '', '/concerts?utm_source=perplexity');
    captureSessionAttribution();

    await trackDiscoveryEvent('newsletter_subscribe_success', {
      source_surface: 'nido_concerts_feed',
      email: 'should-be-stripped@example.com',
    });

    expect(analyticsMocks.logEvent).toHaveBeenCalledWith(
      fakeAnalytics,
      'newsletter_subscribe_success',
      {
        traffic_channel: 'ai_referral',
        traffic_source: 'perplexity',
        traffic_medium: 'ai',
        landing_path: '/concerts?utm_source=perplexity',
        source_surface: 'nido_concerts_feed',
      },
    );

    window.history.replaceState({}, '', '/');
  });

  it('tracks public page views once per unique path and skips admin routes', async () => {
    const fakeAnalytics = { app: {} };
    analyticsMocks.getAnalyticsClient.mockResolvedValue(fakeAnalytics);

    await trackPageView('/admin/concerts', 'AdminConcerts');
    await trackPageView('/concert-sync', 'ConcertSync');
    expect(analyticsMocks.logEvent).not.toHaveBeenCalled();

    await trackPageView('/concerts?city=raleigh', 'Concerts');
    await trackPageView('/concerts?city=raleigh', 'Concerts');
    expect(analyticsMocks.logEvent).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.logEvent).toHaveBeenCalledWith(
      fakeAnalytics,
      'page_view',
      expect.objectContaining({
        page_path: '/concerts?city=raleigh',
        route_name: 'Concerts',
      }),
    );
  });
});
