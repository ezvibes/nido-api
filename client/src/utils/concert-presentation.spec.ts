import { describe, expect, it } from 'vitest';
import {
  buildConcertIcsContent,
  buildConcertMetaSummary,
  buildConcertStructuredData,
  buildGoogleCalendarTemplateUrl,
  buildGoogleMapsVenueUrl,
  computeArtistInitials,
  extractOrderedArtistNames,
  formatFullVenueAddress,
  resolveDistinctEventTitle,
  resolveGenreThemeVariant,
  sanitizeTicketUrl,
} from './concert-presentation';
import type { ConcertApiItem } from '../types/concerts';

describe('concert-presentation utilities', () => {
  it('sanitizes ticket URLs to http/https only', () => {
    expect(sanitizeTicketUrl('https://etix.com/ticket/p/123')).toBe(
      'https://etix.com/ticket/p/123',
    );
    expect(sanitizeTicketUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeTicketUrl('not-a-url')).toBeNull();
    expect(sanitizeTicketUrl(null)).toBeNull();
  });

  it('resolves genre theme variants deterministically', () => {
    expect(resolveGenreThemeVariant('Electronic / House')).toBe('electronic');
    expect(resolveGenreThemeVariant('Indie Rock')).toBe('rock');
    expect(resolveGenreThemeVariant('Funk & Soul')).toBe('jazz');
    expect(resolveGenreThemeVariant('Bluegrass')).toBe('acoustic');
    expect(resolveGenreThemeVariant('Hip Hop')).toBe('hiphop');
    expect(resolveGenreThemeVariant('Experimental')).toBe('default');
  });

  it('computes artist initials cleanly', () => {
    expect(computeArtistInitials('Shadowgrass')).toBe('SH');
    expect(computeArtistInitials('The Floozies')).toBe('TF');
    expect(computeArtistInitials('')).toBe('EZ');
  });

  it('orders unique lineup artist names and resolves distinct event titles', () => {
    const names = extractOrderedArtistNames([
      {
        performanceRole: 'support',
        performanceOrder: 1,
        band: { id: 'b2', name: 'Magoo', slug: 'magoo' },
      },
      {
        performanceRole: 'headliner',
        performanceOrder: 0,
        band: { id: 'b1', name: 'Shadowgrass', slug: 'shadowgrass' },
      },
    ]);
    expect(names).toEqual(['Shadowgrass', 'Magoo']);
    expect(resolveDistinctEventTitle('Shadowgrass & Magoo', names)).toBe('');
    expect(resolveDistinctEventTitle('Halloween Bluegrass Bash', names)).toBe(
      'Halloween Bluegrass Bash',
    );
  });

  it('formats venue addresses and builds Google Maps & Calendar exports', () => {
    const concert: ConcertApiItem = {
      id: 'c-1',
      title: 'Bowstring Fall Jam',
      genre: 'Bluegrass',
      startsAt: '2026-11-20T23:00:00.000Z',
      endsAt: null,
      description: 'Doors at 6pm',
      ticketUrl: 'https://dice.fm/event/bowstring-jam',
      venue: {
        id: 'v-1',
        name: 'Bowstring Pizza and Brewyard',
        address: '1930 Wake Forest Rd',
        city: 'Raleigh',
        region: 'NC',
        postalCode: '27608',
      },
      lineup: [],
      sets: [],
    };

    expect(formatFullVenueAddress(concert.venue)).toBe(
      '1930 Wake Forest Rd, Raleigh, NC 27608',
    );
    expect(buildGoogleMapsVenueUrl(concert.venue)).toContain(
      encodeURIComponent(
        'Bowstring Pizza and Brewyard, 1930 Wake Forest Rd, Raleigh, NC 27608',
      ),
    );

    const gcalUrl = buildGoogleCalendarTemplateUrl(concert);
    expect(gcalUrl).toContain('calendar.google.com/calendar/render');
    expect(gcalUrl).toContain('Bowstring+Fall+Jam');

    const ics = buildConcertIcsContent(
      concert,
      new Date('2026-11-15T00:00:00.000Z'),
    );
    expect(ics).toContain('SUMMARY:Bowstring Fall Jam');
    expect(ics).toContain('URL:https://dice.fm/event/bowstring-jam');
    expect(ics).toContain(
      'LOCATION:Bowstring Pizza and Brewyard\\, 1930 Wake Forest Rd\\, Raleigh\\, NC 27608',
    );
  });

  it('builds concert meta summary and schema.org/MusicEvent structured data for approved concerts', () => {
    const concert: ConcertApiItem = {
      id: 'c-101',
      title: 'Raleigh Electronic Night',
      genre: 'Electronic',
      startsAt: '2026-09-18T23:30:00.000Z',
      endsAt: '2026-09-19T03:00:00.000Z',
      description: 'Doors at 7pm. Full modular synth and laser production.',
      ticketUrl: 'https://etix.com/ticket/p/99999',
      isAdminApproved: true,
      catalogStatus: 'active',
      venue: {
        id: 'v-1',
        name: 'Lincoln Theatre',
        address: '126 E Cabarrus St',
        city: 'Raleigh',
        region: 'NC',
        postalCode: '27601',
      },
      lineup: [
        {
          performanceRole: 'headliner',
          performanceOrder: 0,
          band: { id: 'b-1', name: 'Sylvan Esso', slug: 'sylvan-esso' },
        },
        {
          performanceRole: 'support',
          performanceOrder: 1,
          band: { id: 'b-2', name: 'Night Drive', slug: 'night-drive' },
        },
      ],
      sets: [],
    };

    const meta = buildConcertMetaSummary(concert);
    expect(meta.title).toBe(
      'Sylvan Esso · Night Drive at Lincoln Theatre | EZ Vibes Concerts',
    );
    expect(meta.description).toContain('Sylvan Esso · Night Drive live');
    expect(meta.description).toContain('Lincoln Theatre in Raleigh, NC');

    const jsonLd = buildConcertStructuredData(
      concert,
      'https://nido-api-9ed65.web.app/concerts/c-101',
      'https://nido-api-9ed65.web.app/ingestion/uploads/u-1/image',
    );

    expect(jsonLd).toEqual({
      '@context': 'https://schema.org',
      '@type': 'MusicEvent',
      name: 'Raleigh Electronic Night',
      startDate: '2026-09-18T23:30:00.000Z',
      endDate: '2026-09-19T03:00:00.000Z',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      url: 'https://nido-api-9ed65.web.app/concerts/c-101',
      description: 'Doors at 7pm. Full modular synth and laser production.',
      image: ['https://nido-api-9ed65.web.app/ingestion/uploads/u-1/image'],
      location: {
        '@type': 'Place',
        name: 'Lincoln Theatre',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '126 E Cabarrus St',
          addressLocality: 'Raleigh',
          addressRegion: 'NC',
          postalCode: '27601',
          addressCountry: 'US',
        },
      },
      performer: [
        { '@type': 'MusicGroup', name: 'Sylvan Esso' },
        { '@type': 'MusicGroup', name: 'Night Drive' },
      ],
      offers: {
        '@type': 'Offer',
        url: 'https://etix.com/ticket/p/99999',
        availability: 'https://schema.org/InStock',
      },
    });
  });

  it('withholds schema.org structured data for unapproved, hidden, or archived concerts', () => {
    const baseConcert: ConcertApiItem = {
      id: 'c-draft',
      title: 'Private Draft Show',
      genre: 'Rock',
      startsAt: '2026-10-01T20:00:00.000Z',
      lineup: [],
      sets: [],
    };

    expect(
      buildConcertStructuredData(
        { ...baseConcert, isAdminApproved: false },
        'https://example.com/concerts/c-draft',
      ),
    ).toBeNull();
    expect(
      buildConcertStructuredData(
        { ...baseConcert, catalogStatus: 'hidden' },
        'https://example.com/concerts/c-draft',
      ),
    ).toBeNull();
    expect(
      buildConcertStructuredData(
        { ...baseConcert, catalogStatus: 'archived' },
        'https://example.com/concerts/c-draft',
      ),
    ).toBeNull();
  });
});
