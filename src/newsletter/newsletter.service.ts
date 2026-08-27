import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Concert, ConcertCatalogStatus } from '../apis/concerts/entities/concert.entity';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { GoogleCalendarEvent } from '../concert-sync/interfaces/google-calendar-event.interface';

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Main entry point to generate the weekly, monthly, or custom top picks newsletter.
   */
  async generateNewsletter(params: {
    startDate: string;
    endDate: string;
    editionType?: 'weekly' | 'monthly' | 'custom';
    dateRangeLabel?: string;
    weekendRecap?: string;
    featuredShow?: string;
    featuredFestival?: string;
    rawCalendarData?: string;
    useDatabase?: boolean;
    cities?: string[];
    genres?: string[];
    venues?: string[];
    region?: string;
    strictFiltering?: boolean;
  }): Promise<{ newsletterDraft: string; concertsCount: number }> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured in the application environment.');
    }

    const modelName = this.configService.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;

    // 1. Resolve date range label
    const dateRangeLabel = params.dateRangeLabel || this.formatDateRange(params.startDate, params.endDate);

    // 2. Fetch and filter database concerts
    let concerts: any[] = [];
    if (params.useDatabase !== false) {
      concerts = await this.fetchNCConcerts(params.startDate, params.endDate, {
        cities: params.cities,
        genres: params.genres,
        venues: params.venues,
        region: params.region,
        strictFiltering: params.strictFiltering,
      });
    }

    // 3. Fetch and parse raw calendar data (feed or text)
    let parsedFeedEvents: any[] = [];
    if (params.rawCalendarData) {
      parsedFeedEvents = await this.parseCalendarData(params.rawCalendarData, params.startDate, params.endDate);
    }

    // Combine both database concerts and parsed feed events
    const combinedConcerts = [...concerts, ...parsedFeedEvents];

    if (combinedConcerts.length === 0) {
      this.logger.warn(`No verified concerts or calendar events found for range ${params.startDate} - ${params.endDate}`);
    }

    // 4. Serialize raw calendar dump for prompt context
    const rawCalendarDump = JSON.stringify(combinedConcerts, null, 2);

    // 5. Build full prompt
    const prompt = await this.buildPrompt({
      dateRange: dateRangeLabel,
      editionType: params.editionType || 'weekly',
      recapNotes: params.weekendRecap,
      featuredShow: params.featuredShow,
      featuredFestival: params.featuredFestival,
      rawCalendarData: rawCalendarDump,
    });

    // 6. Call Gemini API using @google/generative-ai SDK
    this.logger.log(`Invoking Gemini API (${modelName}) to generate newsletter draft...`);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new InternalServerErrorException('Gemini API returned an empty newsletter draft.');
      }

      return {
        newsletterDraft: text,
        concertsCount: combinedConcerts.length,
      };
    } catch (err) {
      this.logger.error(`Gemini API generation failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Gemini generation failed: ${err.message}`);
    }
  }

  /**
   * Loads the prompt template and performs replacements.
   */
  async buildPrompt(params: {
    dateRange: string;
    editionType?: 'weekly' | 'monthly' | 'custom';
    recapNotes?: string;
    featuredShow?: string;
    featuredFestival?: string;
    rawCalendarData?: string;
  }): Promise<string> {
    const promptPath = path.join(process.cwd(), '.gemini/prompts/weekly_top_picks.md');
    let template = '';
    try {
      template = await fs.readFile(promptPath, 'utf-8');
    } catch (err) {
      this.logger.warn(`Failed to read prompt template at ${promptPath}, using fallback template. Error: ${err.message}`);
      template = this.getFallbackTemplate();
    }

    let prompt = template;

    // Handle edition type title adjustment
    const editionType = params.editionType || 'weekly';
    if (editionType === 'monthly') {
      prompt = prompt.replace('draft the weekly "Top Picks" newsletter', 'draft the monthly "Top Picks" newsletter');
      prompt = prompt.replace('# EZ Vibes Weekly Top Picks:', '# EZ Vibes Monthly Top Picks:');
    } else if (editionType === 'custom') {
      prompt = prompt.replace('# EZ Vibes Weekly Top Picks:', '# EZ Vibes Top Picks:');
    }

    prompt = prompt.replaceAll('[Date Range]', params.dateRange);
    prompt = prompt.replace('[e.g., Tuesday, Aug 11 - Sunday, Aug 16, 2026]', params.dateRange);

    // Replace the specific [Provided by Evan] instances
    prompt = prompt.replace('- **Weekend Recap Notes:** [Provided by Evan]', `- **Weekend Recap Notes:** ${params.recapNotes || 'None'}`);
    prompt = prompt.replace('- **Featured Show Notes:** [Provided by Evan]', `- **Featured Show Notes:** ${params.featuredShow || 'None'}`);
    prompt = prompt.replace('- **Featured Festival Notes:** [Provided by Evan]', `- **Featured Festival Notes:** ${params.featuredFestival || 'None'}`);

    prompt = prompt.replace('[Injected programmatically or pasted here]', params.rawCalendarData || '[]');

    return prompt;
  }

  /**
   * Fetches active, approved concerts from the database.
   * By default (strictFiltering: false), fetches all active approved concerts within the date range.
   * Optional filters (cities, genres, venues, region) can be passed to narrow the scope.
   */
  private async fetchNCConcerts(
    startDateStr: string,
    endDateStr: string,
    options?: {
      cities?: string[];
      genres?: string[];
      venues?: string[];
      region?: string;
      strictFiltering?: boolean;
    },
  ): Promise<any[]> {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    this.logger.log(`Fetching active approved concerts from DB between ${start.toISOString()} and ${end.toISOString()}...`);

    const dbConcerts = await this.concertRepository.find({
      where: {
        startsAt: Between(start, end),
        catalogStatus: ConcertCatalogStatus.ACTIVE,
        isAdminApproved: true,
      },
      relations: ['venue', 'lineup', 'lineup.band'],
      order: {
        startsAt: 'ASC',
      },
    });

    const targetGenres = ['bluegrass', 'funk', 'rock', 'jam', 'alt-country', 'roots', 'soul', 'regae', 'reggae'];
    const targetCities = ['raleigh', 'durham', 'chapel hill', 'wilmington', 'asheville', 'charlotte', 'boone'];
    const highlightArtists = [
      'dr bacon', 'dr. bacon', 'big fur', 'larry keel', 'sam fribush', 'treehouse', 'treehouse!',
      'julia', 'africa unplugged', 'nth power', 'the nth power', 'chill paxton', 'toubab krewe',
      'tand', 'badfish', 'sons of paradise', 'eggy', 'daniel donato', 'dogs in a pile', 'billy strings'
    ];

    const filtered = dbConcerts.filter(concert => {
      // 0. Exclude placeholder/dev-seed dummy titles
      const titleLower = concert.title.toLowerCase().trim();
      if (titleLower === 'unknown concert' || titleLower === 'untitled event' || titleLower === 'untitled concert') {
        return false;
      }

      // 1. Strict filtering mode (legacy behavior)
      if (options?.strictFiltering) {
        const region = (concert.venue?.region || '').toLowerCase().trim();
        const isNC = region === 'nc' || region === 'north carolina';
        if (!isNC) return false;

        const city = (concert.venue?.city || '').toLowerCase().trim();
        const matchesCity = targetCities.some(c => city.includes(c));
        if (!matchesCity) return false;

        const genre = (concert.genre || '').toLowerCase().trim();
        const matchesGenre = targetGenres.some(g => genre.includes(g));

        return matchesGenre;
      }

      // 2. Custom filter criteria (when specified)
      if (options?.region) {
        const concertRegion = (concert.venue?.region || '').toLowerCase().trim();
        const targetRegion = options.region.toLowerCase().trim();
        if (concertRegion !== targetRegion && !(targetRegion === 'nc' && concertRegion === 'north carolina')) {
          return false;
        }
      }

      if (options?.cities && options.cities.length > 0) {
        const concertCity = (concert.venue?.city || '').toLowerCase().trim();
        const matchesCity = options.cities.some(c => concertCity.includes(c.toLowerCase().trim()));
        if (!matchesCity) return false;
      }

      if (options?.genres && options.genres.length > 0) {
        const concertGenre = (concert.genre || '').toLowerCase().trim();
        const matchesGenre = options.genres.some(g => concertGenre.includes(g.toLowerCase().trim()));
        if (!matchesGenre) return false;
      }

      if (options?.venues && options.venues.length > 0) {
        const concertVenue = (concert.venue?.name || '').toLowerCase().trim();
        const matchesVenue = options.venues.some(v => concertVenue.includes(v.toLowerCase().trim()));
        if (!matchesVenue) return false;
      }

      // 3. Default: include all active, admin-approved DB concerts in range
      return true;
    });

    return filtered.map(concert => {
      const dateStr = concert.startsAt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/New_York',
      });

      const lineupBands = concert.lineup?.map(l => l.band?.name).filter(Boolean) || [];
      const hasHighlightArtist = lineupBands.some(bName =>
        highlightArtists.some(pa => bName.toLowerCase().includes(pa))
      ) || highlightArtists.some(pa => concert.title.toLowerCase().includes(pa));

      return {
        title: concert.title,
        date: dateStr,
        venue: concert.venue ? `${concert.venue.name} (${concert.venue.city}, ${concert.venue.region})` : 'Unknown Venue',
        artists: lineupBands.join(', '),
        genre: concert.genre,
        description: concert.description || '',
        isTopPick: concert.isTopPick,
        topPickScore: concert.topPickScore || 0,
        isHighlightArtist: hasHighlightArtist,
        isPartnerArtist: hasHighlightArtist,
        source: 'Nido Concert Database',
      };
    });
  }

  /**
   * Parser helper for calendar feeds (ICS urls, raw text, JSON strings).
   */
  private async parseCalendarData(rawInput: string, timeMin?: string, timeMax?: string): Promise<any[]> {
    let content = rawInput.trim();

    // 1. URL fetch
    if (content.startsWith('http://') || content.startsWith('https://')) {
      this.logger.log(`Fetching calendar URL feed: ${content}`);
      try {
        const response = await fetch(content, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/calendar,text/plain,application/ics,*/*',
          },
        });
        if (!response.ok) {
          this.logger.warn(`Failed to fetch URL feed (${response.status}): ${content}`);
          return [];
        }
        content = (await response.text()).trim();

        if (content.toLowerCase().includes('safeguarding your website') || content.toLowerCase().startsWith('<!doctype html')) {
          this.logger.warn(`URL feed ${content} returned an HTML bot challenge instead of raw iCal content. Paste the raw ICS content into rawCalendarData or run sync.`);
          return [];
        }
      } catch (err) {
        this.logger.warn(`Error fetching URL feed ${content}: ${err.message}`);
        return [];
      }
    }

    // 2. Parse ICS
    if (content.includes('BEGIN:VCALENDAR')) {
      this.logger.log('Parsing raw iCal/ICS input...');
      try {
        const events = this.parseIcalEvents(content).filter(event =>
          this.isWithinRange(event, timeMin, timeMax)
        );

        const highlightArtists = [
          'dr bacon', 'dr. bacon', 'big fur', 'larry keel', 'sam fribush', 'treehouse', 'treehouse!',
          'julia', 'africa unplugged', 'nth power', 'the nth power', 'chill paxton', 'toubab krewe',
          'tand', 'badfish', 'sons of paradise', 'eggy', 'daniel donato', 'dogs in a pile', 'billy strings'
        ];

        return events.map(event => {
          const startVal = event.start?.dateTime || event.start?.date || '';
          const dateStr = startVal
            ? new Date(startVal).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'America/New_York',
              })
            : 'Unknown Date';

          const summary = event.summary || 'Untitled show';
          const isHighlight = highlightArtists.some(pa => summary.toLowerCase().includes(pa));

          return {
            title: summary,
            date: dateStr,
            venue: event.location || 'Unknown Venue',
            description: event.description || '',
            isHighlightArtist: isHighlight,
            isPartnerArtist: isHighlight,
            source: 'Calendar Feed (ICS)',
          };
        });
      } catch (err) {
        this.logger.warn(`Failed to parse iCal contents: ${err.message}`);
      }
    }

    // 3. Parse JSON
    if (content.startsWith('[') || content.startsWith('{')) {
      this.logger.log('Parsing raw JSON input...');
      try {
        const parsed = JSON.parse(content);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        return array.map(item => ({
          title: item.title || item.summary || item.name || 'Untitled show',
          date: item.date || item.start || item.dateTime || 'Unknown Date',
          venue: item.venue || item.location || 'Unknown Venue',
          description: item.description || item.desc || '',
          source: 'Calendar Feed (JSON)',
        }));
      } catch {
        // Fall back to raw text dump if JSON parse fails
      }
    }

    // 4. Raw text dump fallback
    this.logger.log('Falling back to raw text dump processing...');
    return [{
      rawText: content,
      source: 'Calendar Text Dump',
    }];
  }

  /**
   * Formats start/end ISO strings into a human-friendly range label.
   */
  private formatDateRange(startStr: string, endStr: string): string {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    const start = new Date(startStr);
    const end = new Date(endStr);
    const fmt = new Intl.DateTimeFormat('en-US', options);
    return `${fmt.format(start)} - ${fmt.format(end)}`;
  }

  /**
   * Local simplified implementation of Ical parsing logic.
   */
  private parseIcalEvents(text: string): GoogleCalendarEvent[] {
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .reduce<string[]>((acc, line) => {
        if (/^[ \t]/.test(line) && acc.length) {
          acc[acc.length - 1] += line.slice(1);
        } else {
          acc.push(line.trimEnd());
        }
        return acc;
      }, []);

    const events: GoogleCalendarEvent[] = [];
    let current: Record<string, string[]> | null = null;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        current = {};
        continue;
      }
      if (line === 'END:VEVENT') {
        if (current) {
          events.push(this.mapIcalEvent(current));
        }
        current = null;
        continue;
      }
      if (!current) continue;

      const sepIdx = line.indexOf(':');
      if (sepIdx === -1) continue;

      const rawKey = line.slice(0, sepIdx);
      const val = line.slice(sepIdx + 1)
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
      const key = rawKey.split(';')[0].toUpperCase();
      current[key] = [...(current[key] ?? []), val];
    }

    return events;
  }

  private mapIcalEvent(record: Record<string, string[]>): GoogleCalendarEvent {
    const firstVal = (arr?: string[]) => arr?.find(v => v.trim().length > 0)?.trim();

    const uid = firstVal(record.UID);
    const start = this.parseIcalDate(firstVal(record.DTSTART));
    const end = this.parseIcalDate(firstVal(record.DTEND));

    return {
      id: uid || 'fallback-id',
      status: firstVal(record.STATUS)?.toLowerCase() || 'confirmed',
      summary: firstVal(record.SUMMARY),
      description: firstVal(record.DESCRIPTION),
      location: firstVal(record.LOCATION),
      start,
      end,
    };
  }

  private parseIcalDate(value?: string) {
    if (!value) return undefined;
    const trimmed = value.trim();

    if (/^\d{8}$/.test(trimmed)) {
      return {
        date: `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`,
      };
    }

    const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!match) return undefined;

    const [, y, m, d, hh, mm, ss, utc] = match;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}${utc ? 'Z' : ''}`;
    return {
      dateTime: utc ? new Date(iso).toISOString() : iso,
    };
  }

  private isWithinRange(event: GoogleCalendarEvent, timeMin?: string, timeMax?: string): boolean {
    const startVal = event.start?.dateTime || event.start?.date;
    if (!startVal) return false;
    const time = new Date(startVal).getTime();
    if (Number.isNaN(time)) return false;
    if (timeMin && time < new Date(timeMin).getTime()) return false;
    if (timeMax && time > new Date(timeMax).getTime()) return false;
    return true;
  }

  private getFallbackTemplate(): string {
    return `
You are the core AI Copywriter and Data Curator for Evan and Camille, founders of EZ Vibes—the community-focused live music brand in North Carolina. Your task is to draft the weekly "Top Picks" newsletter for publication on Beehiiv and export to Google Docs.

### INPUT VARIABLES
- **Date Range:** [e.g., Tuesday, Aug 11 - Sunday, Aug 16, 2026]
- **Weekend Recap Notes:** [Provided by Evan]
- **Featured Show Notes:** [Provided by Evan]
- **Featured Festival Notes:** [Provided by Evan]
- **Raw Calendar Dump / ICS Feed Data:** [Injected programmatically or pasted here]

---

### OUTPUT FORMAT (OPTIMIZED FOR GOOGLE DOCS & BEEHIIV)

# EZ Vibes Weekly Top Picks: [Date Range]

#### 1. Quick Hits
- 4-5 bullet points summarizing the edition with emojis.

#### 2. The EZ Vibes Update
2-3 personal, soulful paragraphs reflecting on recent shows/news and connecting back to community, mental health, and live music.

#### 3. The Squad Promo
> **Join the Squad:** [Link to Discord]

#### 4. Featured Show & Featured Festival
- Featured Show details.
- Featured Festival details.

#### 5. Top Picks Schedule

Format EVERY show chronologically using this EXACT layout:
**[Day of Week] - [Month Day]**
**[Band/Artist Name]**
[Venue Name] – [City, State]
*The Vibe: [One punchy, specific sentence emphasizing energy or community aspect.]*

#### 6. Sign-off
Find a show and bring a friend,
Evan and Camille from EZ Vibes
    `;
  }
}
