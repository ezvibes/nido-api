import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Concert, ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BeehiivService, BeehiivDraftResponse } from './beehiiv.service';
import * as fs from 'fs/promises';
import * as path from 'path';

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

type NewsletterEditionType = 'weekly' | 'monthly' | 'custom';

export interface NewsletterSourceConcert {
  id?: string;
  title: string;
  date: string;
  venue: string;
  artists?: string;
  genre?: string;
  description?: string;
  rawText?: string;
  isTopPick: boolean;
  topPickScore: number;
  isHighlightArtist: boolean;
  isPartnerArtist: boolean;
  source: string;
}

export interface NewsletterSourcePreview {
  dateRangeLabel: string;
  concerts: NewsletterSourceConcert[];
  calendarEvents: NewsletterSourceConcert[];
  concertsCount: number;
  calendarEventsCount: number;
  totalCount: number;
}

export interface NewsletterRequestParams {
  startDate?: string;
  endDate?: string;
  editionType?: NewsletterEditionType;
  dateRangeLabel?: string;
  weekendRecap?: string;
  featuredShow?: string;
  featuredFestival?: string;
  rawCalendarData?: string;
  useDatabase?: boolean;
  featuredOnly?: boolean;
  topPicksOnly?: boolean;
  excludeConcertIds?: string[];
  cities?: string[];
  genres?: string[];
  venues?: string[];
  region?: string;
  strictFiltering?: boolean;
  autoPushToBeehiiv?: boolean;
  postTemplateId?: string;
}

interface GoogleCalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    private readonly configService: ConfigService,
    private readonly beehiivService: BeehiivService,
  ) {}

  /**
   * Main entry point to generate the weekly, monthly, or custom top picks newsletter.
   */
  async generateNewsletter(params: NewsletterRequestParams): Promise<{
    newsletterDraft: string;
    concertsCount: number;
    beehiivDraft?: BeehiivDraftResponse;
  }> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY is not configured in the application environment.',
      );
    }

    const modelName =
      this.configService.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;

    const preview = await this.previewNewsletterSources(params);
    const combinedConcerts = [...preview.concerts, ...preview.calendarEvents];

    if (combinedConcerts.length === 0) {
      this.logger.warn(
        `No verified concerts or calendar events found for range ${preview.dateRangeLabel}`,
      );
    }

    const rawCalendarDump = JSON.stringify(combinedConcerts, null, 2);

    const prompt = await this.buildPrompt({
      dateRange: preview.dateRangeLabel,
      editionType: params.editionType || 'weekly',
      recapNotes: params.weekendRecap,
      featuredShow: params.featuredShow,
      featuredFestival: params.featuredFestival,
      rawCalendarData: rawCalendarDump,
    });

    this.logger.log(`Invoking Gemini API (${modelName}) to generate newsletter draft...`);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new InternalServerErrorException(
          'Gemini API returned an empty newsletter draft.',
        );
      }

      let beehiivDraft: BeehiivDraftResponse | undefined;

      if (params.autoPushToBeehiiv) {
        const postTitle = `EZ Vibes Top Picks: ${preview.dateRangeLabel}`;
        const htmlContent = this.convertMarkdownToHtml(text);

        this.logger.log(`Auto-pushing generated newsletter to Beehiiv: "${postTitle}"`);
        beehiivDraft = await this.beehiivService.createDraftFromHtml({
          title: postTitle,
          htmlContent: htmlContent,
          postTemplateId: params.postTemplateId,
        });
      }

      return {
        newsletterDraft: text,
        concertsCount: preview.totalCount,
        beehiivDraft,
      };
    } catch (err) {
      this.logger.error(`Gemini API generation failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Gemini generation failed: ${err.message}`);
    }
  }

  async previewNewsletterSources(
    params: NewsletterRequestParams,
  ): Promise<NewsletterSourcePreview> {
    const { start, end, label } = this.resolveDates(
      params.startDate,
      params.endDate,
      params.editionType || 'weekly',
      params.dateRangeLabel,
    );

    let concerts: NewsletterSourceConcert[] = [];
    if (params.useDatabase !== false) {
      concerts = await this.fetchNCConcerts(
        start.toISOString(),
        end.toISOString(),
        {
          cities: params.cities,
          genres: params.genres,
          venues: params.venues,
          region: params.region,
          strictFiltering: params.strictFiltering,
          featuredOnly: params.featuredOnly,
          topPicksOnly: params.topPicksOnly,
          excludeConcertIds: params.excludeConcertIds,
        },
      );
    }

    const calendarEvents = params.rawCalendarData
      ? await this.parseCalendarData(
          params.rawCalendarData,
          start.toISOString(),
          end.toISOString(),
        )
      : [];

    return {
      dateRangeLabel: label,
      concerts,
      calendarEvents,
      concertsCount: concerts.length,
      calendarEventsCount: calendarEvents.length,
      totalCount: concerts.length + calendarEvents.length,
    };
  }

  async buildPrompt(params: {
    dateRange: string;
    editionType: string;
    recapNotes?: string;
    featuredShow?: string;
    featuredFestival?: string;
    rawCalendarData: string;
  }): Promise<string> {
    const promptPath = path.join(
      process.cwd(),
      '.gemini/prompts/weekly_top_picks.md',
    );
    let template = '';
    try {
      template = await fs.readFile(promptPath, 'utf-8');
    } catch (err) {
      template = this.getDefaultPromptTemplate();
    }

    const editionType = params.editionType || 'weekly';
    if (editionType === 'monthly') {
      template = template.replace(
        'draft the weekly "Top Picks" newsletter',
        'draft the monthly "Top Picks" newsletter',
      );
      template = template.replace(
        '# EZ Vibes Weekly Top Picks:',
        '# EZ Vibes Monthly Top Picks:',
      );
    } else if (editionType === 'custom') {
      template = template.replace(
        '# EZ Vibes Weekly Top Picks:',
        '# EZ Vibes Top Picks:',
      );
    }

    return template
      .replace(/{{DATE_RANGE}}/g, params.dateRange)
      .replace(/\[Date Range\]/g, params.dateRange)
      .replace(
        /\[e\.g\., Tuesday, Aug 11 - Sunday, Aug 16, 2026\]/g,
        params.dateRange,
      )
      .replace(/{{RECAP_NOTES}}/g, params.recapNotes || 'None provided.')
      .replace(
        /- \*\*Weekend Recap Notes:\*\* \[Provided by Evan\]/g,
        `- **Weekend Recap Notes:** ${params.recapNotes || 'None'}`,
      )
      .replace(/{{FEATURED_SHOW}}/g, params.featuredShow || 'None specified.')
      .replace(
        /- \*\*Featured Show Notes:\*\* \[Provided by Evan\]/g,
        `- **Featured Show Notes:** ${params.featuredShow || 'None'}`,
      )
      .replace(/{{FEATURED_FESTIVAL}}/g, params.featuredFestival || 'None specified.')
      .replace(
        /- \*\*Featured Festival Notes:\*\* \[Provided by Evan\]/g,
        `- **Featured Festival Notes:** ${params.featuredFestival || 'None'}`,
      )
      .replace(/{{RAW_CALENDAR_DATA}}/g, params.rawCalendarData)
      .replace(
        /\[Injected programmatically or pasted here\]/g,
        params.rawCalendarData,
      );
  }

  public convertMarkdownToHtml(markdown: string): string {
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n\n/g, '<br/><br/>');

    if (html.includes('<li>')) {
      html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }

    return html;
  }

  private resolveDates(
    startDateStr?: string,
    endDateStr?: string,
    editionType: NewsletterEditionType = 'weekly',
    customLabel?: string,
  ): { start: Date; end: Date; label: string } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
    } else {
      const dayOfWeek = now.getDay();
      const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
      start = new Date(now);
      start.setDate(now.getDate() + daysUntilTuesday);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 5);
      end.setHours(23, 59, 59, 999);
    }

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    const startFmt = start.toLocaleDateString('en-US', options);
    const endFmt = end.toLocaleDateString('en-US', options);
    const label = customLabel || `${startFmt} - ${endFmt}`;

    return { start, end, label };
  }

  private async fetchNCConcerts(
    startDateStr: string,
    endDateStr: string,
    options?: {
      cities?: string[];
      genres?: string[];
      venues?: string[];
      region?: string;
      strictFiltering?: boolean;
      featuredOnly?: boolean;
      topPicksOnly?: boolean;
      excludeConcertIds?: string[];
    },
  ): Promise<NewsletterSourceConcert[]> {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    this.logger.log(
      `Fetching active approved concerts from DB between ${start.toISOString()} and ${end.toISOString()}...`,
    );

    const dbConcerts = await this.concertRepository.find({
      where: {
        startsAt: Between(start, end),
        catalogStatus: ConcertCatalogStatus.ACTIVE,
      },
      relations: ['venue', 'lineup', 'lineup.band'],
      order: {
        startsAt: 'ASC',
      },
    });

    const highlightArtists = [
      'dr bacon', 'dr. bacon', 'big fur', 'larry keel', 'sam fribush', 'treehouse', 'treehouse!',
      'julia', 'africa unplugged', 'nth power', 'the nth power', 'chill paxton', 'toubab krewe',
      'tand', 'badfish', 'sons of paradise', 'eggy', 'daniel donato', 'dogs in a pile', 'billy strings',
    ];

    const targetCities = ['raleigh', 'durham', 'chapel hill', 'carrboro', 'greensboro', 'winston-salem', 'charlotte', 'asheville', 'wilmington'];
    const targetGenres = ['funk', 'bluegrass', 'jam', 'reggae', 'hip-hop', 'hip hop', 'salsa', 'rock', 'electronic', 'folk', 'latin'];

    const filtered = dbConcerts.filter((concert) => {
      if (options?.excludeConcertIds?.includes(concert.id)) return false;
      if (options?.featuredOnly && !concert.isFeatured) return false;
      if (options?.topPicksOnly && !concert.isTopPick) return false;

      if (options?.strictFiltering) {
        const region = (concert.venue?.region || '').toLowerCase().trim();
        const isNC = region === 'nc' || region === 'north carolina';
        if (!isNC) return false;

        const city = (concert.venue?.city || '').toLowerCase().trim();
        const matchesCity = targetCities.some((c) => city.includes(c));
        if (!matchesCity) return false;

        const genre = (concert.genre || '').toLowerCase().trim();
        return targetGenres.some((g) => genre.includes(g));
      }

      if (options?.region) {
        const concertRegion = (concert.venue?.region || '').toLowerCase().trim();
        const targetRegion = options.region.toLowerCase().trim();
        if (
          concertRegion !== targetRegion &&
          !(targetRegion === 'nc' && concertRegion === 'north carolina')
        ) {
          return false;
        }
      }

      if (options?.cities && options.cities.length > 0) {
        const concertCity = (concert.venue?.city || '').toLowerCase().trim();
        if (!options.cities.some((c) => concertCity.includes(c.toLowerCase().trim()))) {
          return false;
        }
      }

      if (options?.genres && options.genres.length > 0) {
        const concertGenre = (concert.genre || '').toLowerCase().trim();
        if (!options.genres.some((g) => concertGenre.includes(g.toLowerCase().trim()))) {
          return false;
        }
      }

      if (options?.venues && options.venues.length > 0) {
        const concertVenue = (concert.venue?.name || '').toLowerCase().trim();
        if (!options.venues.some((v) => concertVenue.includes(v.toLowerCase().trim()))) {
          return false;
        }
      }

      return true;
    });

    return filtered.map((concert) => {
      const dateStr = concert.startsAt
        ? concert.startsAt.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'America/New_York',
          })
        : 'Unknown Date';

      const lineupBands =
        concert.lineup?.map((l) => l.band?.name).filter((b): b is string => Boolean(b)) || [];

      const hasHighlightArtist =
        lineupBands.some((bName) =>
          highlightArtists.some((pa) => bName.toLowerCase().includes(pa)),
        ) || highlightArtists.some((pa) => concert.title.toLowerCase().includes(pa));

      return {
        id: concert.id,
        title: concert.title,
        date: dateStr,
        venue: concert.venue
          ? `${concert.venue.name} (${concert.venue.city}, ${concert.venue.region})`
          : 'Unknown Venue',
        artists: lineupBands.join(', '),
        genre: concert.genre,
        description: concert.description || '',
        isTopPick: Boolean(concert.isTopPick),
        topPickScore: concert.topPickScore || 0,
        isHighlightArtist: hasHighlightArtist,
        isPartnerArtist: hasHighlightArtist,
        source: 'Nido Concert Database',
      };
    });
  }

  private async parseCalendarData(
    rawInput: string,
    timeMin?: string,
    timeMax?: string,
  ): Promise<NewsletterSourceConcert[]> {
    let content = rawInput.trim();

    if (content.startsWith('http://') || content.startsWith('https://')) {
      try {
        const response = await fetch(content, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'text/calendar,text/plain,application/ics,*/*',
          },
        });
        if (!response.ok) return [];
        content = (await response.text()).trim();
      } catch {
        return [];
      }
    }

    if (content.includes('BEGIN:VCALENDAR')) {
      try {
        const events = this.parseIcalEvents(content).filter((event) =>
          this.isWithinRange(event, timeMin, timeMax),
        );

        return events.map((event) => ({
          title: event.summary || 'Untitled show',
          date: event.start?.dateTime || event.start?.date || 'Unknown Date',
          venue: event.location || 'Unknown Venue',
          description: event.description || '',
          isTopPick: false,
          topPickScore: 0,
          isHighlightArtist: false,
          isPartnerArtist: false,
          source: 'Calendar Feed (ICS)',
        }));
      } catch {
        // Fall back
      }
    }

    if (content.startsWith('[') || content.startsWith('{')) {
      try {
        const parsed = JSON.parse(content);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        return array.map((item) => ({
          title: item.title || item.summary || item.name || 'Untitled show',
          date: item.date || item.start || item.dateTime || 'Unknown Date',
          venue: item.venue || item.location || 'Unknown Venue',
          description: item.description || item.desc || '',
          isTopPick: false,
          topPickScore: 0,
          isHighlightArtist: false,
          isPartnerArtist: false,
          source: 'Calendar Feed (JSON)',
        }));
      } catch {
        // Fall back
      }
    }

    return [
      {
        rawText: content,
        title: 'Raw calendar text',
        date: 'Unknown Date',
        venue: 'Unknown Venue',
        isTopPick: false,
        topPickScore: 0,
        isHighlightArtist: false,
        isPartnerArtist: false,
        source: 'Calendar Text Dump',
      },
    ];
  }

  private parseIcalEvents(text: string): GoogleCalendarEvent[] {
    const lines = text.split(/\r?\n/);
    const events: GoogleCalendarEvent[] = [];
    let current: GoogleCalendarEvent | null = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        current = {};
      } else if (line === 'END:VEVENT') {
        if (current) events.push(current);
        current = null;
      } else if (current) {
        if (line.startsWith('SUMMARY:')) current.summary = line.replace('SUMMARY:', '');
        if (line.startsWith('LOCATION:')) current.location = line.replace('LOCATION:', '');
        if (line.startsWith('DESCRIPTION:')) current.description = line.replace('DESCRIPTION:', '');
        if (line.startsWith('DTSTART:')) current.start = { dateTime: line.replace('DTSTART:', '') };
      }
    }

    return events;
  }

  private isWithinRange(event: GoogleCalendarEvent, min?: string, max?: string): boolean {
    if (!min || !max) return true;
    const startStr = event.start?.dateTime || event.start?.date;
    if (!startStr) return true;
    const date = new Date(startStr);
    return date >= new Date(min) && date <= new Date(max);
  }

  private getDefaultPromptTemplate(): string {
    return `You are the lead editor for EZ Vibes, an open live music discovery catalog.
Create a high-energy, engaging weekly live music newsletter for the date range: {{DATE_RANGE}}.

### Context & Highlights:
- Recap Notes: {{RECAP_NOTES}}
- Featured Show: {{FEATURED_SHOW}}
- Featured Festival: {{FEATURED_FESTIVAL}}

### Approved Source Concerts Data:
{{RAW_CALENDAR_DATA}}

### Formatting Instructions:
1. Quick Hits section with weekend highlights and top picks.
2. Featured Show breakdown with artist, venue, and vibe.
3. Chronological listing of top picks grouped by genre or venue.
4. Keep the tone enthusiastic, accurate, and concise.`;
  }
}
