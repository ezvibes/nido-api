import type {
  ConcertApiItem,
  ConcertLineupEntry,
  ConcertVenue,
} from '../types/concerts';

export type GenreThemeVariant =
  | 'electronic'
  | 'rock'
  | 'jazz'
  | 'acoustic'
  | 'hiphop'
  | 'default';

export function sanitizeTicketUrl(rawUrl?: string | null): string | null {
  const raw = rawUrl?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveGenreThemeVariant(
  genre?: string | null,
): GenreThemeVariant {
  const g = (genre || '').toLowerCase().trim();
  if (
    g.includes('electronic') ||
    g.includes('edm') ||
    g.includes('dance') ||
    g.includes('dj') ||
    g.includes('house') ||
    g.includes('techno')
  ) {
    return 'electronic';
  }
  if (
    g.includes('rock') ||
    g.includes('metal') ||
    g.includes('punk') ||
    g.includes('alternative') ||
    g.includes('indie')
  ) {
    return 'rock';
  }
  if (
    g.includes('jazz') ||
    g.includes('blues') ||
    g.includes('soul') ||
    g.includes('r&b') ||
    g.includes('funk')
  ) {
    return 'jazz';
  }
  if (
    g.includes('country') ||
    g.includes('folk') ||
    g.includes('acoustic') ||
    g.includes('bluegrass')
  ) {
    return 'acoustic';
  }
  if (g.includes('hip hop') || g.includes('rap') || g.includes('urban')) {
    return 'hiphop';
  }
  return 'default';
}

export function computeArtistInitials(label?: string | null): string {
  const text = (label || 'EZ').trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'EZ';
  }
  if (parts.length === 1) {
    return (parts[0] || 'EZ').slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] || 'E';
  const second = parts[1]?.[0] || 'Z';
  return (first + second).toUpperCase();
}

export function extractOrderedArtistNames(
  lineup?: ConcertLineupEntry[] | null,
): string[] {
  if (!lineup || lineup.length === 0) return [];
  return [...lineup]
    .sort((left, right) => left.performanceOrder - right.performanceOrder)
    .map((entry) => entry.band?.name)
    .filter(
      (name, index, names): name is string =>
        Boolean(name) && names.indexOf(name) === index,
    );
}

export function normalizeDisplayText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function resolveDistinctEventTitle(
  title: string,
  artistNames: string[],
): string {
  if (!artistNames.length) return '';
  const normalizedTitle = normalizeDisplayText(title);
  const titleAddsInformation = artistNames.some(
    (name) => !normalizedTitle.includes(normalizeDisplayText(name)),
  );
  return titleAddsInformation ? title : '';
}

export function formatFullVenueAddress(venue?: ConcertVenue | null): string {
  if (!venue) return '';
  const cityRegion = [venue.city, venue.region].filter(Boolean).join(', ');
  const cityRegionPostal = [cityRegion, venue.postalCode]
    .filter(Boolean)
    .join(' ');
  return [venue.address, cityRegionPostal].filter(Boolean).join(', ');
}

export function buildGoogleMapsVenueUrl(venue?: ConcertVenue | null): string {
  if (!venue) return 'https://www.google.com/maps';
  const fullAddress = formatFullVenueAddress(venue);
  const query = [venue.name, fullAddress].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function formatIcsUtcDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function getCalendarStartEnd(
  item: Pick<ConcertApiItem, 'startsAt' | 'endsAt'>,
): { start: Date; end: Date } {
  const start = new Date(item.startsAt);
  const end = item.endsAt
    ? new Date(item.endsAt)
    : new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return { start, end };
}

export function buildGoogleCalendarTemplateUrl(item: ConcertApiItem): string {
  const { start, end } = getCalendarStartEnd(item);
  const dates = `${formatIcsUtcDate(start)}/${formatIcsUtcDate(end)}`;
  const fullAddress = formatFullVenueAddress(item.venue);
  const location = [item.venue?.name, fullAddress].filter(Boolean).join(', ');
  const safeTicket = sanitizeTicketUrl(item.ticketUrl);
  const detailsParts = [
    item.description,
    safeTicket ? `Tickets: ${safeTicket}` : '',
  ].filter(Boolean);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates,
    details: detailsParts.join('\n\n'),
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildConcertIcsContent(
  item: ConcertApiItem,
  dtStamp = new Date(),
): string {
  const { start, end } = getCalendarStartEnd(item);
  const fullAddress = formatFullVenueAddress(item.venue);
  const location = [item.venue?.name, fullAddress].filter(Boolean).join(', ');
  const safeTicket = sanitizeTicketUrl(item.ticketUrl);
  const descriptionParts = [
    item.description,
    safeTicket ? `Tickets: ${safeTicket}` : '',
  ].filter(Boolean);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nido//Concert Calendar//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:concert-${item.id}@nido`,
    `DTSTAMP:${formatIcsUtcDate(dtStamp)}`,
    `DTSTART:${formatIcsUtcDate(start)}`,
    `DTEND:${formatIcsUtcDate(end)}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
  ];

  if (descriptionParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n\n'))}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }
  if (safeTicket) {
    lines.push(`URL:${safeTicket}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildConcertMetaSummary(concert: ConcertApiItem): {
  title: string;
  description: string;
} {
  const artistNames = extractOrderedArtistNames(concert.lineup);
  const artistHeadline =
    artistNames.length > 0 ? artistNames.join(' · ') : concert.title;
  const venueName = concert.venue?.name?.trim();
  const cityState = [concert.venue?.city, concert.venue?.region]
    .filter(Boolean)
    .join(', ');

  const titleCore = venueName
    ? `${artistHeadline} at ${venueName}`
    : artistHeadline;
  const title = `${titleCore} | EZ Vibes Concerts`;

  const startDate = new Date(concert.startsAt);
  const dateLabel = Number.isNaN(startDate.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(startDate);

  const locationSummary = [venueName, cityState].filter(Boolean).join(' in ');
  const summaryParts = [
    `${artistHeadline} live${locationSummary ? ` at ${locationSummary}` : ''}${dateLabel ? ` on ${dateLabel}` : ''}.`,
    concert.description?.trim() ||
      'View set times, venue directions, calendar export, and ticket links on EZ Vibes.',
  ];

  return {
    title,
    description: summaryParts.join(' ').slice(0, 300),
  };
}

export function buildConcertStructuredData(
  concert: ConcertApiItem,
  canonicalUrl: string,
  resolvedPosterUrl?: string | null,
): Record<string, unknown> | null {
  if (
    concert.isAdminApproved === false ||
    concert.catalogStatus === 'hidden' ||
    concert.catalogStatus === 'archived'
  ) {
    return null;
  }

  const startDate = new Date(concert.startsAt);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const endDate = concert.endsAt ? new Date(concert.endsAt) : null;
  const artistNames = extractOrderedArtistNames(concert.lineup);
  const safeTicket = sanitizeTicketUrl(concert.ticketUrl);

  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MusicEvent',
    name: concert.title,
    startDate: startDate.toISOString(),
    ...(endDate && !Number.isNaN(endDate.getTime())
      ? { endDate: endDate.toISOString() }
      : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonicalUrl,
  };

  if (concert.description?.trim()) {
    payload.description = concert.description.trim();
  }

  if (resolvedPosterUrl) {
    payload.image = [resolvedPosterUrl];
  }

  if (concert.venue?.name) {
    payload.location = {
      '@type': 'Place',
      name: concert.venue.name,
      address: {
        '@type': 'PostalAddress',
        ...(concert.venue.address
          ? { streetAddress: concert.venue.address }
          : {}),
        ...(concert.venue.city ? { addressLocality: concert.venue.city } : {}),
        ...(concert.venue.region
          ? { addressRegion: concert.venue.region }
          : {}),
        ...(concert.venue.postalCode
          ? { postalCode: concert.venue.postalCode }
          : {}),
        addressCountry: 'US',
      },
    };
  }

  if (artistNames.length > 0) {
    payload.performer = artistNames.map((name) => ({
      '@type': 'MusicGroup',
      name,
    }));
  }

  if (safeTicket) {
    payload.offers = {
      '@type': 'Offer',
      url: safeTicket,
      availability: 'https://schema.org/InStock',
    };
  }

  return payload;
}
