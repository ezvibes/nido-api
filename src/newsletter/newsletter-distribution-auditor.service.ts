import { Injectable, Logger } from '@nestjs/common';

export enum NCRegion {
  TRIANGLE = 'Triangle (Raleigh / Durham / Chapel Hill)',
  WESTERN_NC_MOUNTAINS = 'Western NC / Mountains (Asheville / Boone / Brevard)',
  COASTAL_NC = 'Coastal NC (Wilmington / Outer Banks)',
  CHARLOTTE_PIEDMONT = 'Charlotte & Piedmont (Charlotte / Greensboro / Winston-Salem)',
  OTHER_REGIONAL = 'Other Regional',
}

export interface AuditableEvent {
  artistName: string;
  venueName: string;
  city?: string;
  genres?: string[];
  date?: string;
}

export interface RegionMetric {
  region: NCRegion;
  count: number;
  percentage: number;
  representedCities: string[];
}

export interface GenreMetric {
  genre: string;
  count: number;
  percentage: number;
}

export interface NewsletterDistributionReport {
  totalEvents: number;
  regionBreakdown: Record<NCRegion, RegionMetric>;
  genreBreakdown: Record<string, GenreMetric>;
  underrepresentedRegions: NCRegion[];
  underrepresentedGenres: string[];
  alerts: string[];
  scoutingRecommendations: string[];
  isBalanced: boolean;
}

const REGION_CITY_MAP: Record<NCRegion, string[]> = {
  [NCRegion.TRIANGLE]: [
    'raleigh',
    'durham',
    'chapel hill',
    'carrboro',
    'cary',
    'apex',
    'morrisville',
    'pittsboro',
    'saxapahaw',
    'wake forest',
    'garner',
    'holly springs',
  ],
  [NCRegion.WESTERN_NC_MOUNTAINS]: [
    'asheville',
    'boone',
    'brevard',
    'black mountain',
    'todd',
    'sylva',
    'waynesville',
    'banner elk',
    'hendersonville',
    'mars hill',
    'burnsville',
  ],
  [NCRegion.COASTAL_NC]: [
    'wilmington',
    'wrightsville beach',
    'carolina beach',
    'outer banks',
    'kill devil hills',
    'nags head',
    'beaufort',
    'morehead city',
    'duck',
    'kure beach',
  ],
  [NCRegion.CHARLOTTE_PIEDMONT]: [
    'charlotte',
    'winston-salem',
    'greensboro',
    'high point',
    'lexington',
    'salisbury',
    'concord',
    'gastonia',
    'harmony',
    'huntersville',
    'matthews',
  ],
  [NCRegion.OTHER_REGIONAL]: [],
};

const CORE_GENRE_CATEGORIES = [
  'Jam',
  'Bluegrass/Roots',
  'Funk/Soul',
  'Reggae',
  'Alt-Country',
];

@Injectable()
export class NewsletterDistributionAuditorService {
  private readonly logger = new Logger(
    NewsletterDistributionAuditorService.name,
  );

  /**
   * Resolves the NC Sub-Region based on city name or venue name heuristics.
   */
  resolveRegion(city?: string, venueName?: string): NCRegion {
    const rawSearch = `${city || ''} ${venueName || ''}`.toLowerCase();

    for (const [region, cities] of Object.entries(REGION_CITY_MAP)) {
      if (region === NCRegion.OTHER_REGIONAL) continue;
      for (const c of cities) {
        if (rawSearch.includes(c)) {
          return region as NCRegion;
        }
      }
    }

    // Heuristics based on famous venues
    if (/orange peel|salvage station|grey eagle|eulogy|appalachian/i.test(rawSearch)) {
      return NCRegion.WESTERN_NC_MOUNTAINS;
    }
    if (/cat's cradle|lincoln theatre|pour house|pinhook|motorco|haw river|berkeley/i.test(rawSearch)) {
      return NCRegion.TRIANGLE;
    }
    if (/greenfield lake|brooklyn arts|bourbon street|palm room/i.test(rawSearch)) {
      return NCRegion.COASTAL_NC;
    }
    if (/neighborhood theatre|visulite|snug harbor|evening muse|ramkat|flat iron/i.test(rawSearch)) {
      return NCRegion.CHARLOTTE_PIEDMONT;
    }

    return NCRegion.OTHER_REGIONAL;
  }

  /**
   * Maps individual freeform genre strings into canonical EZ Vibes core categories.
   */
  mapToCanonicalGenre(genreStr: string): string {
    const g = genreStr.toLowerCase();
    if (/reggae|dub|ska/i.test(g)) return 'Reggae';
    if (/jam|psychedelic|improvisational|dead/i.test(g)) return 'Jam';
    if (/bluegrass|americana|roots|folk|newgrass|old-time/i.test(g)) return 'Bluegrass/Roots';
    if (/funk|soul|r&b|groove|motown/i.test(g)) return 'Funk/Soul';
    if (/country|cosmic country|alt-country|outlaw/i.test(g)) return 'Alt-Country';
    return 'Other';
  }

  /**
   * Audits a set of curated or candidate concerts against geographic and genre diversity thresholds.
   */
  auditDistribution(events: AuditableEvent[]): NewsletterDistributionReport {
    const totalEvents = events.length;
    this.logger.log(`Auditing distribution across ${totalEvents} newsletter candidate events...`);

    const regionCounts: Record<NCRegion, { count: number; cities: Set<string> }> = {
      [NCRegion.TRIANGLE]: { count: 0, cities: new Set() },
      [NCRegion.WESTERN_NC_MOUNTAINS]: { count: 0, cities: new Set() },
      [NCRegion.COASTAL_NC]: { count: 0, cities: new Set() },
      [NCRegion.CHARLOTTE_PIEDMONT]: { count: 0, cities: new Set() },
      [NCRegion.OTHER_REGIONAL]: { count: 0, cities: new Set() },
    };

    const genreCounts: Record<string, number> = {
      Jam: 0,
      'Bluegrass/Roots': 0,
      'Funk/Soul': 0,
      Reggae: 0,
      'Alt-Country': 0,
      Other: 0,
    };

    for (const ev of events) {
      const region = this.resolveRegion(ev.city, ev.venueName);
      regionCounts[region].count++;
      if (ev.city) {
        regionCounts[region].cities.add(ev.city.trim());
      }

      const genres = ev.genres && ev.genres.length > 0 ? ev.genres : ['Other'];
      const seenCanonicalInEvent = new Set<string>();
      for (const g of genres) {
        const canonical = this.mapToCanonicalGenre(g);
        if (!seenCanonicalInEvent.has(canonical)) {
          seenCanonicalInEvent.add(canonical);
          genreCounts[canonical] = (genreCounts[canonical] || 0) + 1;
        }
      }
    }

    const regionBreakdown: Record<NCRegion, RegionMetric> = {} as any;
    const underrepresentedRegions: NCRegion[] = [];
    const alerts: string[] = [];
    const scoutingRecommendations: string[] = [];

    // Core regions expected to have representation
    const coreMonitoredRegions = [
      NCRegion.TRIANGLE,
      NCRegion.WESTERN_NC_MOUNTAINS,
      NCRegion.COASTAL_NC,
      NCRegion.CHARLOTTE_PIEDMONT,
    ];

    for (const reg of Object.values(NCRegion)) {
      const count = regionCounts[reg].count;
      const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
      regionBreakdown[reg] = {
        region: reg,
        count,
        percentage: pct,
        representedCities: Array.from(regionCounts[reg].cities),
      };

      if (coreMonitoredRegions.includes(reg) && count === 0) {
        underrepresentedRegions.push(reg);
        alerts.push(`Zero representation for NC hub: ${reg}`);
        if (reg === NCRegion.WESTERN_NC_MOUNTAINS) {
          scoutingRecommendations.push(
            'Scout Western NC venues: The Orange Peel, Salvage Station, The Grey Eagle (Asheville), or 185 King Street (Brevard).',
          );
        } else if (reg === NCRegion.COASTAL_NC) {
          scoutingRecommendations.push(
            'Scout Coastal NC venues: Greenfield Lake Amphitheater, Brooklyn Arts Center, or The Palm Room (Wilmington/Wrightsville).',
          );
        } else if (reg === NCRegion.CHARLOTTE_PIEDMONT) {
          scoutingRecommendations.push(
            'Scout Charlotte & Piedmont venues: Neighborhood Theatre, The Ramkat (Winston-Salem), or Flat Iron (Greensboro).',
          );
        } else if (reg === NCRegion.TRIANGLE) {
          scoutingRecommendations.push(
            "Scout Triangle venues: Cat's Cradle (Carrboro), Lincoln Theatre, or Pour House (Raleigh).",
          );
        }
      }
    }

    const genreBreakdown: Record<string, GenreMetric> = {};
    const underrepresentedGenres: string[] = [];

    for (const [canonicalGenre, count] of Object.entries(genreCounts)) {
      const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
      genreBreakdown[canonicalGenre] = {
        genre: canonicalGenre,
        count,
        percentage: pct,
      };

      if (CORE_GENRE_CATEGORIES.includes(canonicalGenre) && count === 0 && totalEvents >= 5) {
        underrepresentedGenres.push(canonicalGenre);
        alerts.push(`Core genre "${canonicalGenre}" is unrepresented in this weekly cycle.`);
        scoutingRecommendations.push(
          `Review JamBase/Nido database filters to pull at least one ${canonicalGenre} event into Top Picks or Quick Hits.`,
        );
      }
    }

    const isBalanced =
      underrepresentedRegions.length === 0 && underrepresentedGenres.length === 0;

    return {
      totalEvents,
      regionBreakdown,
      genreBreakdown,
      underrepresentedRegions,
      underrepresentedGenres,
      alerts,
      scoutingRecommendations,
      isBalanced,
    };
  }
}
