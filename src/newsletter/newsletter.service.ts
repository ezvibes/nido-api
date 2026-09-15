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
      throw new InternalServerErrorException('GEMINI_API_KEY is not configured in the application environment.');
    }

    const modelName = this.configService.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;

    const preview = await this.previewNewsletterSources(params);
    const combinedConcerts = [...preview.concerts, ...preview.calendarEvents];

    if (combinedConcerts.length === 0) {
      this.logger.warn(`No verified concerts or calendar events found for range ${preview.dateRangeLabel}`);
    }

    // 4. Serialize raw calendar dump for prompt context
    const rawCalendarDump = JSON.stringify(combinedConcerts, null, 2);

    // 5. Build full prompt
    const prompt = await this.buildPrompt({
      dateRange: preview.dateRangeLabel,
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

    this.logger.log(
      `Fetching active concerts between ${start.toISOString()} and ${end.toISOString()} for newsletter preview (${params.editionType || 'weekly'})...`,
    );

    const activeConcerts = await this.concertRepository.find({
      where: {
        startsAt: Between(start, end),
        catalogStatus: ConcertCatalogStatus.ACTIVE,
      },
      relations: ['venue', 'lineup', 'lineup.band'],
      order: {
        startsAt: 'ASC',
      },
    });

    this.logger.log(`Found ${activeConcerts.length} active concerts for ${label}.`);

    const formattedConcerts: NewsletterSourceConcert[] = activeConcerts.map(
      (c) => {
        const venueName = c.venue
          ? `${c.venue.name}${c.venue.city ? ' - ' + c.venue.city : ''}${c.venue.region ? ', ' + c.venue.region : ''}`
          : 'Unknown Venue';

        const artistNames = c.lineup
          ?.map((l) => l.band?.name)
          .filter(Boolean)
          .join(', ');

        return {
          id: c.id,
          title: c.title,
          date: c.startsAt ? new Date(c.startsAt).toISOString() : '',
          venue: venueName,
          artists: artistNames || undefined,
          genre: c.genre || undefined,
          description: c.description || undefined,
          isTopPick: c.isTopPick ?? false,
          topPickScore: c.topPickScore ?? 0.5,
          isHighlightArtist: (c as any).isHighlightArtist ?? false,
          isPartnerArtist: (c as any).isPartnerArtist ?? false,
          source: 'database',
        };
      },
    );

    return {
      dateRangeLabel: label,
      concerts: formattedConcerts,
      calendarEvents: [],
      concertsCount: formattedConcerts.length,
      calendarEventsCount: 0,
      totalCount: formattedConcerts.length,
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
    const templatePath = path.join(
      process.cwd(),
      'prompts',
      'weekly_picks_system_prompt.txt',
    );

    let templateContent = '';
    try {
      templateContent = await fs.readFile(templatePath, 'utf8');
    } catch {
      templateContent = this.getDefaultPromptTemplate();
    }

    return templateContent
      .replace(/{{DATE_RANGE}}/g, params.dateRange)
      .replace(/{{RECAP_NOTES}}/g, params.recapNotes || 'None provided.')
      .replace(/{{FEATURED_SHOW}}/g, params.featuredShow || 'None specified.')
      .replace(/{{FEATURED_FESTIVAL}}/g, params.featuredFestival || 'None specified.')
      .replace(/{{RAW_CALENDAR_DATA}}/g, params.rawCalendarData);
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
