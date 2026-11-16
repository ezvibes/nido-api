import { describe, expect, it } from 'vitest';
import {
  buildConcertIcsContent,
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
});
