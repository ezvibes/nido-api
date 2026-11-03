import { Injectable, Logger } from '@nestjs/common';
import { BeehiivService, BeehiivPostStats } from './beehiiv.service';
import { EZ_VIBES_CORE_ARTISTS, EZ_VIBES_CORE_VENUES } from './newsletter.constants';

export interface EditorialDiffReport {
  postId: string;
  draftWordCount: number;
  publishedWordCount: number;
  retainedShows: string[];
  addedShows: string[];
  removedShows: string[];
  voiceCalibrations: string[];
  summary: string;
}

export interface EntityClickAffinity {
  entityName: string;
  type: 'artist' | 'venue' | 'general';
  clicks: number;
  uniqueClicks: number;
  affinityWeight: number; // 1.0 (baseline) to 2.5 (hot favorite)
}

export interface EngagementAffinityReport {
  postId: string;
  openRate: number;
  clickRate: number;
  totalClicks: number;
  ticketLinkClicks: number;
  spotifyClicks: number;
  entityAffinities: EntityClickAffinity[];
  topPerformers: string[];
  curationAdvice: string[];
}

@Injectable()
export class NewsletterFeedbackLoopService {
  private readonly logger = new Logger(NewsletterFeedbackLoopService.name);

  constructor(private readonly beehiivService: BeehiivService) {}

  /**
   * Normalizes text for comparison by stripping HTML tags and excess whitespace.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Identifies scene artists mentioned in plain text based on EZ Vibes core roster.
   */
  private findMentionedArtists(text: string): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];

    for (const artist of EZ_VIBES_CORE_ARTISTS) {
      if (lower.includes(artist.toLowerCase())) {
        found.push(artist);
      }
    }
    return found;
  }

  /**
   * Identifies scene venues mentioned in plain text based on EZ Vibes core venues.
   */
  private findMentionedVenues(text: string): string[] {
    const lower = text.toLowerCase();
    const found: string[] = [];

    for (const venue of EZ_VIBES_CORE_VENUES) {
      const pureVenue = venue.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (lower.includes(pureVenue)) {
        found.push(venue);
      }
    }
    return found;
  }

  /**
   * Compares the original staged draft with the final published Beehiiv post.
   */
  diffDraftVsPublished(
    postId: string,
    draftContent: string,
    publishedHtml: string,
  ): EditorialDiffReport {
    this.logger.log(`Executing ground-truth editorial diff for post ${postId}...`);

    const cleanDraft = this.stripHtml(draftContent);
    const cleanPublished = this.stripHtml(publishedHtml);

    const draftWordCount = cleanDraft.split(/\s+/).filter(Boolean).length;
    const publishedWordCount = cleanPublished.split(/\s+/).filter(Boolean).length;

    const draftArtists = new Set(this.findMentionedArtists(cleanDraft));
    const publishedArtists = new Set(this.findMentionedArtists(cleanPublished));

    const retainedShows: string[] = [];
    const addedShows: string[] = [];
    const removedShows: string[] = [];

    for (const artist of publishedArtists) {
      if (draftArtists.has(artist)) {
        retainedShows.push(artist);
      } else {
        addedShows.push(artist);
      }
    }

    for (const artist of draftArtists) {
      if (!publishedArtists.has(artist)) {
        removedShows.push(artist);
      }
    }

    const voiceCalibrations: string[] = [];

    if (publishedWordCount < draftWordCount * 0.8) {
      voiceCalibrations.push(
        `Editor trimmed copy length by ${Math.round((1 - publishedWordCount / draftWordCount) * 100)}%. Keep intros punchier and more concise.`,
      );
    } else if (publishedWordCount > draftWordCount * 1.2) {
      voiceCalibrations.push(
        `Editor expanded copy length by ${Math.round((publishedWordCount / draftWordCount - 1) * 100)}%. Add richer scene context and performer backstories.`,
      );
    }

    if (addedShows.length > 0) {
      voiceCalibrations.push(
        `Editor manually added ${addedShows.length} show(s): ${addedShows.join(', ')}. Elevate these artists in curation scoring.`,
      );
    }

    if (removedShows.length > 0) {
      voiceCalibrations.push(
        `Editor removed ${removedShows.length} show(s) from draft: ${removedShows.join(', ')}. Scrutinize similar candidates for vibe fit.`,
      );
    }

    const summary = `Diff evaluated: ${retainedShows.length} retained, ${addedShows.length} added by editor, ${removedShows.length} cut.`;

    return {
      postId,
      draftWordCount,
      publishedWordCount,
      retainedShows,
      addedShows,
      removedShows,
      voiceCalibrations,
      summary,
    };
  }

  /**
   * Evaluates post engagement statistics and calculates affinity weights for mentioned entities.
   */
  calculateEngagementAffinities(
    stats: BeehiivPostStats,
    postTextOrHtml = '',
  ): EngagementAffinityReport {
    const totalClicks = stats.total_clicks || 0;
    const links = stats.links || [];

    let ticketLinkClicks = 0;
    let spotifyClicks = 0;

    const affinitiesMap = new Map<string, { clicks: number; uniqueClicks: number; type: 'artist' | 'venue' | 'general' }>();

    for (const link of links) {
      const url = link.url.toLowerCase();
      const clicks = link.clicks || 0;
      const uniqueClicks = link.unique_clicks || clicks;

      if (/etix|ticketmaster|dice\.fm|axs|eventbrite|seetickets|prekindle/i.test(url)) {
        ticketLinkClicks += clicks;
      }
      if (/spotify\.com/i.test(url)) {
        spotifyClicks += clicks;
      }

      // Check artist names in URL or text
      const cleanUrl = url.replace(/[^a-z0-9]/g, '');
      for (const artist of EZ_VIBES_CORE_ARTISTS) {
        const slug = artist.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const hyphenSlug = artist.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (cleanUrl.includes(slug) || url.includes(hyphenSlug)) {
          const curr = affinitiesMap.get(artist) || { clicks: 0, uniqueClicks: 0, type: 'artist' };
          affinitiesMap.set(artist, {
            clicks: curr.clicks + clicks,
            uniqueClicks: curr.uniqueClicks + uniqueClicks,
            type: 'artist',
          });
        }
      }

      // Check venue names in URL or text
      for (const venue of EZ_VIBES_CORE_VENUES) {
        const pureVenue = venue.replace(/\s*\([^)]*\)/g, '').toLowerCase();
        const venueSlug = pureVenue.replace(/[^a-z0-9]+/g, '');
        const venueHyphenSlug = pureVenue.replace(/[^a-z0-9]+/g, '-');
        if (cleanUrl.includes(venueSlug) || url.includes(venueHyphenSlug)) {
          const curr = affinitiesMap.get(venue) || { clicks: 0, uniqueClicks: 0, type: 'venue' };
          affinitiesMap.set(venue, {
            clicks: curr.clicks + clicks,
            uniqueClicks: curr.uniqueClicks + uniqueClicks,
            type: 'venue',
          });
        }
      }
    }

    const entityAffinities: EntityClickAffinity[] = [];
    const avgClicks = totalClicks > 0 && links.length > 0 ? totalClicks / links.length : 1;

    for (const [entityName, data] of affinitiesMap.entries()) {
      // Affinity weight scales from 1.0 (baseline) to 2.5 (hot engagement)
      const ratio = avgClicks > 0 ? data.clicks / avgClicks : 1;
      const affinityWeight = Math.min(2.5, Math.max(1.0, Math.round((1.0 + (ratio - 1) * 0.3) * 100) / 100));

      entityAffinities.push({
        entityName,
        type: data.type,
        clicks: data.clicks,
        uniqueClicks: data.uniqueClicks,
        affinityWeight,
      });
    }

    entityAffinities.sort((a, b) => b.clicks - a.clicks);

    const topPerformers = entityAffinities
      .slice(0, 5)
      .map((e) => `${e.entityName} (${e.clicks} clicks, weight: ${e.affinityWeight})`);

    const curationAdvice: string[] = [];
    if (ticketLinkClicks > 0) {
      curationAdvice.push(
        `High ticket intent detected: ${ticketLinkClicks} ticket link click(s). Prioritize shows with direct ticketing partners.`,
      );
    }
    if (spotifyClicks > 0) {
      curationAdvice.push(
        `Discovery intent detected: ${spotifyClicks} Spotify link click(s). Continue embedding artist tracks in Quick Hits.`,
      );
    }
    for (const performer of entityAffinities.slice(0, 3)) {
      if (performer.affinityWeight > 1.2) {
        curationAdvice.push(
          `Community appetite for ${performer.entityName} is strong (affinity ${performer.affinityWeight}). Feature upcoming appearances.`,
        );
      }
    }

    return {
      postId: stats.id,
      openRate: stats.open_rate || 0,
      clickRate: stats.click_rate || 0,
      totalClicks,
      ticketLinkClicks,
      spotifyClicks,
      entityAffinities,
      topPerformers,
      curationAdvice,
    };
  }
}
