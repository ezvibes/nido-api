import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Band } from '../apis/bands/entities/band.entity';
import { EZ_VIBES_CORE_ARTISTS } from './newsletter.constants';

export interface DiscoveredArtistCandidate {
  name: string;
  slug: string;
  sourceType: 'support_act' | 'festival_lineup';
  sourceTitle?: string;
  isKnownCoreRoster: boolean;
  isInDatabase: boolean;
  actionTaken: 'ALREADY_EXISTS' | 'PROPOSED_FOR_CRM' | 'CREATED_IN_CATALOG';
}

export interface SupportActExtractionResult {
  headliner: string;
  supportingActs: string[];
}

export interface LineupHarvestReport {
  totalExtracted: number;
  newDiscoveriesCount: number;
  candidates: DiscoveredArtistCandidate[];
  summary: string;
}

@Injectable()
export class NewsletterLineupHarvesterService {
  private readonly logger = new Logger(NewsletterLineupHarvesterService.name);

  constructor(
    @InjectRepository(Band)
    private readonly bandRepository: Repository<Band>,
  ) {}

  /**
   * Generates a clean URL-friendly slug from an artist name.
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Normalizes an artist name by stripping extraneous delimiters, parentheticals, and whitespace.
   */
  normalizeArtistName(rawName: string): string {
    return rawName
      .replace(/\s*\([^)]*\)/g, '') // remove (brackets)
      .replace(/\s*\[[^\]]*\]/g, '') // remove [brackets]
      .replace(/^the\s+/i, 'The ') // normalize The
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Parses headliner and supporting acts from concert titles or co-bill descriptions.
   */
  extractSupportActs(title: string): SupportActExtractionResult {
    const trimmed = title.trim();

    // Matching patterns: " w/ ", " with ", " + ", " feat. ", " featuring "
    const splitRegex = /\s+(?:w\/|with|\+|feat\.|featuring)\s+/i;
    const parts = trimmed.split(splitRegex);

    if (parts.length <= 1) {
      return {
        headliner: this.normalizeArtistName(trimmed),
        supportingActs: [],
      };
    }

    const headliner = this.normalizeArtistName(parts[0]);
    const supportPart = parts.slice(1).join(' ');

    // Support part may contain commas, "and", or "&"
    const rawSupportNames = supportPart
      .split(/,\s*|\s+(?:and|&)\s+/i)
      .map((n) => this.normalizeArtistName(n))
      .filter((n) => n.length > 1 && !/^(doors|show|tba|special guests?)$/i.test(n));

    return {
      headliner,
      supportingActs: Array.from(new Set(rawSupportNames)),
    };
  }

  /**
   * Ingests a raw festival lineup string (comma, newline, or bullet-separated) into discrete artist names.
   */
  parseFestivalLineup(lineupText: string): string[] {
    const linesOrTokens = lineupText
      .split(/\r?\n|,|•|\|/)
      .map((item) => this.normalizeArtistName(item))
      .filter((item) => {
        if (!item || item.length < 2) return false;
        // Ignore date/time or stage indicators
        if (
          /^(?:stage|doors|show|pm|am|day\s+\d|night\s+\d|late night|vip)(?:\s+.*)?$/i.test(
            item,
          )
        )
          return false;
        if (/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(item)) return false;
        return true;
      });

    return Array.from(new Set(linesOrTokens));
  }

  /**
   * Evaluates extracted artists against the known catalog and CRM roster, optionally auto-registering new bands.
   */
  async processDiscoveredArtists(
    artistNames: string[],
    sourceType: 'support_act' | 'festival_lineup',
    sourceTitle?: string,
    autoCreateInDb = false,
  ): Promise<LineupHarvestReport> {
    const coreRosterSet = new Set(
      EZ_VIBES_CORE_ARTISTS.map((a) => a.toLowerCase().trim()),
    );

    const candidates: DiscoveredArtistCandidate[] = [];
    let newDiscoveriesCount = 0;

    for (const rawName of artistNames) {
      const name = this.normalizeArtistName(rawName);
      if (!name || name.length < 2) continue;

      const slug = this.generateSlug(name);
      const isKnownCoreRoster = coreRosterSet.has(name.toLowerCase());

      // Check DB existence
      let existingBand: Band | null = null;
      try {
        existingBand = await this.bandRepository.findOne({
          where: [{ slug }, { name }],
        });
      } catch (err: any) {
        this.logger.warn(`Could not query band existence for "${name}": ${err.message}`);
      }

      const isInDatabase = !!existingBand;

      let actionTaken: DiscoveredArtistCandidate['actionTaken'] = 'ALREADY_EXISTS';

      if (!isInDatabase && !isKnownCoreRoster) {
        newDiscoveriesCount++;
        if (autoCreateInDb) {
          try {
            const newBand = this.bandRepository.create({
              name,
              slug,
              isFeatured: false,
              genres: [],
              socials: { discoveredFrom: sourceTitle || sourceType },
            });
            await this.bandRepository.save(newBand);
            actionTaken = 'CREATED_IN_CATALOG';
            this.logger.log(`Created new discovered band in catalog: "${name}" (${slug})`);
          } catch (err: any) {
            this.logger.warn(`Failed to auto-create band "${name}": ${err.message}`);
            actionTaken = 'PROPOSED_FOR_CRM';
          }
        } else {
          actionTaken = 'PROPOSED_FOR_CRM';
        }
      }

      candidates.push({
        name,
        slug,
        sourceType,
        sourceTitle,
        isKnownCoreRoster,
        isInDatabase,
        actionTaken,
      });
    }

    return {
      totalExtracted: artistNames.length,
      newDiscoveriesCount,
      candidates,
      summary: `Extracted ${artistNames.length} artists from ${sourceType}. Found ${newDiscoveriesCount} new candidate discoveries for CRM expansion.`,
    };
  }
}
