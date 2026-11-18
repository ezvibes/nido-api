import { logEvent } from 'firebase/analytics';
import { getAnalyticsClient } from '../firebase';

export type TrafficChannel =
  | 'ai_referral'
  | 'organic_search'
  | 'social'
  | 'email'
  | 'referral'
  | 'direct';

export interface TrafficAttribution {
  channel: TrafficChannel;
  source: string;
  medium: string;
  campaign?: string;
  referrerHost?: string;
  landingPath: string;
  capturedAt: string;
}

const SESSION_ATTRIBUTION_KEY = 'nido_session_attribution';

const AI_HOST_LABELS: ReadonlyArray<{ host: string; source: string }> = [
  { host: 'chatgpt.com', source: 'chatgpt' },
  { host: 'chat.openai.com', source: 'chatgpt' },
  { host: 'perplexity.ai', source: 'perplexity' },
  { host: 'claude.ai', source: 'claude' },
  { host: 'gemini.google.com', source: 'gemini' },
  { host: 'bard.google.com', source: 'gemini' },
  { host: 'copilot.microsoft.com', source: 'copilot' },
  { host: 'you.com', source: 'you' },
  { host: 'phind.com', source: 'phind' },
  { host: 'kagi.com', source: 'kagi' },
  { host: 'poe.com', source: 'poe' },
];

const AI_UTM_SOURCES = new Set([
  'chatgpt',
  'chatgpt.com',
  'openai',
  'perplexity',
  'perplexity.ai',
  'claude',
  'claude.ai',
  'gemini',
  'copilot',
]);

const SEARCH_HOST_LABELS: ReadonlyArray<{ host: string; source: string }> = [
  { host: 'bing.com', source: 'bing' },
  { host: 'duckduckgo.com', source: 'duckduckgo' },
  { host: 'search.yahoo.com', source: 'yahoo' },
  { host: 'search.brave.com', source: 'brave' },
  { host: 'ecosia.org', source: 'ecosia' },
];

const SOCIAL_HOST_LABELS: ReadonlyArray<{ host: string; source: string }> = [
  { host: 'instagram.com', source: 'instagram' },
  { host: 'facebook.com', source: 'facebook' },
  { host: 'fb.com', source: 'facebook' },
  { host: 't.co', source: 'x' },
  { host: 'x.com', source: 'x' },
  { host: 'twitter.com', source: 'x' },
  { host: 'reddit.com', source: 'reddit' },
  { host: 'threads.net', source: 'threads' },
  { host: 'bsky.app', source: 'bluesky' },
  { host: 'tiktok.com', source: 'tiktok' },
  { host: 'linkedin.com', source: 'linkedin' },
  { host: 'lnkd.in', source: 'linkedin' },
];

const EMAIL_HOST_LABELS: ReadonlyArray<{ host: string; source: string }> = [
  { host: 'beehiiv.com', source: 'beehiiv' },
  { host: 'substack.com', source: 'substack' },
];

const INTERNAL_HOSTS = new Set([
  'nido-api-9ed65.web.app',
  'nido-api-9ed65.firebaseapp.com',
  'localhost',
  '127.0.0.1',
]);

function matchesHost(hostname: string, target: string): boolean {
  return hostname === target || hostname.endsWith(`.${target}`);
}

function normalizeReferrerHost(
  rawReferrer?: string,
  currentHostname?: string,
): string | undefined {
  const trimmed = rawReferrer?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) return undefined;
    if (
      (currentHostname && hostname === currentHostname.toLowerCase()) ||
      INTERNAL_HOSTS.has(hostname)
    ) {
      return undefined;
    }
    return hostname;
  } catch {
    return undefined;
  }
}

function findMatchingLabel(
  hostname: string,
  candidates: ReadonlyArray<{ host: string; source: string }>,
): string | undefined {
  return candidates.find((candidate) => matchesHost(hostname, candidate.host))
    ?.source;
}

function isGoogleSearchHost(hostname: string): boolean {
  return (
    hostname === 'google.com' ||
    hostname.startsWith('www.google.') ||
    /^google\.[a-z.]{2,}$/.test(hostname)
  );
}

/**
 * Classifies incoming browser traffic into AI referral, organic search, social, email, referral, or direct channels without storing PII.
 */
export function classifyTrafficSource(input?: {
  referrer?: string;
  search?: string;
  currentHostname?: string;
  pathname?: string;
}): TrafficAttribution {
  const landingPath = input?.pathname?.trim() || '/';
  const capturedAt = new Date().toISOString();
  const params = new URLSearchParams(input?.search || '');
  const utmSource = params.get('utm_source')?.trim().toLowerCase() || '';
  const utmMedium = params.get('utm_medium')?.trim().toLowerCase() || '';
  const utmCampaign = params.get('utm_campaign')?.trim() || undefined;
  const referrerHost = normalizeReferrerHost(
    input?.referrer,
    input?.currentHostname,
  );

  const aiHostLabel = referrerHost
    ? findMatchingLabel(referrerHost, AI_HOST_LABELS)
    : undefined;
  if (
    aiHostLabel ||
    AI_UTM_SOURCES.has(utmSource) ||
    utmMedium === 'ai' ||
    utmMedium === 'ai_referral'
  ) {
    return {
      channel: 'ai_referral',
      source: aiHostLabel || utmSource || referrerHost || 'ai_assistant',
      medium: utmMedium || 'ai',
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      ...(referrerHost ? { referrerHost } : {}),
      landingPath,
      capturedAt,
    };
  }

  const emailHostLabel = referrerHost
    ? findMatchingLabel(referrerHost, EMAIL_HOST_LABELS)
    : undefined;
  if (emailHostLabel || utmMedium === 'email' || utmMedium === 'newsletter') {
    return {
      channel: 'email',
      source: utmSource || emailHostLabel || 'newsletter',
      medium: utmMedium || 'email',
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      ...(referrerHost ? { referrerHost } : {}),
      landingPath,
      capturedAt,
    };
  }

  const searchHostLabel = referrerHost
    ? findMatchingLabel(referrerHost, SEARCH_HOST_LABELS) ??
      (isGoogleSearchHost(referrerHost) ? 'google' : undefined)
    : undefined;
  if (searchHostLabel || utmMedium === 'organic') {
    return {
      channel: 'organic_search',
      source: searchHostLabel || utmSource || 'organic',
      medium: utmMedium || 'organic',
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      ...(referrerHost ? { referrerHost } : {}),
      landingPath,
      capturedAt,
    };
  }

  const socialHostLabel = referrerHost
    ? findMatchingLabel(referrerHost, SOCIAL_HOST_LABELS)
    : undefined;
  if (socialHostLabel || utmMedium === 'social') {
    return {
      channel: 'social',
      source: socialHostLabel || utmSource || 'social',
      medium: utmMedium || 'social',
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      ...(referrerHost ? { referrerHost } : {}),
      landingPath,
      capturedAt,
    };
  }

  if (utmSource || referrerHost) {
    return {
      channel: 'referral',
      source: utmSource || referrerHost || 'referral',
      medium: utmMedium || 'referral',
      ...(utmCampaign ? { campaign: utmCampaign } : {}),
      ...(referrerHost ? { referrerHost } : {}),
      landingPath,
      capturedAt,
    };
  }

  return {
    channel: 'direct',
    source: 'direct',
    medium: 'none',
    ...(utmCampaign ? { campaign: utmCampaign } : {}),
    landingPath,
    capturedAt,
  };
}

function readStoredAttribution(): TrafficAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage?.getItem(SESSION_ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TrafficAttribution>;
    if (!parsed.channel || !parsed.source) return null;
    return parsed as TrafficAttribution;
  } catch {
    return null;
  }
}

function writeStoredAttribution(attribution: TrafficAttribution): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.setItem(
      SESSION_ATTRIBUTION_KEY,
      JSON.stringify(attribution),
    );
  } catch {
    // Ignore storage quota or restricted context errors
  }
}

/**
 * Captures and preserves first-touch traffic attribution in sessionStorage for conversion events across multi-page navigation.
 */
export function captureSessionAttribution(): TrafficAttribution {
  const incoming =
    typeof window !== 'undefined'
      ? classifyTrafficSource({
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          search: window.location?.search || '',
          currentHostname: window.location?.hostname || '',
          pathname: `${window.location?.pathname || '/'}${window.location?.search || ''}`,
        })
      : classifyTrafficSource();

  const existing = readStoredAttribution();
  if (!existing) {
    writeStoredAttribution(incoming);
    return incoming;
  }

  if (existing.channel === 'direct' && incoming.channel !== 'direct') {
    writeStoredAttribution(incoming);
    return incoming;
  }

  return existing;
}

export function getSessionAttribution(): TrafficAttribution {
  return readStoredAttribution() ?? captureSessionAttribution();
}

export function clearSessionAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(SESSION_ATTRIBUTION_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Maps session traffic channel to Beehiiv newsletter utmMedium while preserving component-level utmSource defaults.
 */
export function resolveNewsletterAttribution(
  options: { utmSource?: string; utmCampaign?: string },
  attribution: TrafficAttribution = getSessionAttribution(),
): {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
} {
  const utmSource = options.utmSource?.trim() || 'nido_web';
  const utmCampaign = options.utmCampaign?.trim() || 'weekly_top_picks';
  let utmMedium = 'organic';
  if (attribution.channel === 'ai_referral') {
    utmMedium = 'ai_referral';
  } else if (attribution.channel === 'social') {
    utmMedium = 'social';
  } else if (attribution.channel === 'email') {
    utmMedium = 'email';
  } else if (attribution.channel === 'referral') {
    utmMedium = 'referral';
  }

  return { utmSource, utmMedium, utmCampaign };
}

const DISALLOWED_PARAM_KEYS = new Set(['email', 'token', 'idtoken', 'password']);

function sanitizeEventParams(
  params?: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  if (!params) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (DISALLOWED_PARAM_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      result[key] = trimmed.slice(0, 100);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Sends a discovery or conversion event to Firebase Analytics enriched with privacy-safe session attribution.
 */
export async function trackDiscoveryEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  try {
    const attribution = getSessionAttribution();
    const analytics = await getAnalyticsClient();
    if (!analytics) return;

    const payload = sanitizeEventParams({
      traffic_channel: attribution.channel,
      traffic_source: attribution.source,
      traffic_medium: attribution.medium,
      landing_path: attribution.landingPath,
      ...params,
    });

    logEvent(analytics, eventName, payload);
  } catch {
    // Analytics must never interrupt UX or break client tests
  }
}

let lastTrackedPagePath = '';

export function resetTrackedPagePathForTest(): void {
  lastTrackedPagePath = '';
}

/**
 * Records a public route page_view while skipping private admin workflows and duplicate route triggers.
 */
export async function trackPageView(
  fullPath: string,
  routeName?: string,
): Promise<void> {
  const normalizedPath = fullPath.trim() || '/';
  if (
    normalizedPath.startsWith('/admin') ||
    normalizedPath === '/concert-sync' ||
    normalizedPath === lastTrackedPagePath
  ) {
    return;
  }

  lastTrackedPagePath = normalizedPath;
  await trackDiscoveryEvent('page_view', {
    page_path: normalizedPath,
    route_name: routeName,
  });
}
