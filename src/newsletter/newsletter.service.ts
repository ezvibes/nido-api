import {
  Injectable,
  Logger,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent, Runner } from '@google/adk';
import { BeehiivService, BeehiivDraftResponse } from './beehiiv.service';
import {
  NewsletterCatalogService,
  NewsletterSourceConcert,
} from './newsletter-catalog.service';
import { NewsletterAgentToolRegistry } from './agent/newsletter-agent-tool-registry.service';
import { TypeOrmSessionService } from '../apis/agents/session/typeorm-session.service';
import { AgentSupervisorService } from '../apis/agents/agent-supervisor.service';
import { formatNewsletterMarkdownToHtml } from './newsletter-html-formatter.util';
import {
  JAMBASE_NC_ICAL_URL,
  GOOGLE_CALENDAR_EZ_VIBES_ICAL_URL,
  EZ_VIBES_CORE_ARTISTS,
  EZ_VIBES_CORE_VENUES,
  EZ_VIBES_CORE_FESTIVALS,
} from './newsletter.constants';
import * as fs from 'fs/promises';
import * as path from 'path';

const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

type NewsletterEditionType = 'weekly' | 'monthly' | 'custom';

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
  includeJambaseCalendar?: boolean;
  includeGoogleCalendar?: boolean;
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
    private readonly newsletterCatalogService: NewsletterCatalogService,
    private readonly configService: ConfigService,
    private readonly beehiivService: BeehiivService,
    private readonly toolRegistry: NewsletterAgentToolRegistry,
    private readonly sessionService: TypeOrmSessionService,
    @Optional()
    private readonly supervisorService?: AgentSupervisorService,
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
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      DEFAULT_GEMINI_MODEL;

    const preview = await this.previewNewsletterSources(params);
    const combinedConcerts = [...preview.concerts, ...preview.calendarEvents];

    if (combinedConcerts.length === 0) {
      this.logger.warn(
        `No verified concerts or calendar events found for range ${preview.dateRangeLabel}`,
      );
    }

    const systemInstruction = await this.buildPrompt({
      dateRange: preview.dateRangeLabel,
      editionType: params.editionType || 'weekly',
      recapNotes: params.weekendRecap,
      featuredShow: params.featuredShow,
      featuredFestival: params.featuredFestival,
      rawCalendarData:
        'Use the fetchApprovedConcertsTool to retrieve verified catalog events, and verify URLs as necessary.',
    });

    const agent = new Agent({
      name: 'Firenze',
      model: modelName,
      description:
        "Nido's live music curation and editorial agent. Prepares the weekly top picks newsletter.",
      instruction: systemInstruction,
      tools: this.toolRegistry.getTools(),
    });

    // Set API key for ADK models to pick up if they fallback to environment vars
    process.env.GEMINI_API_KEY = apiKey;
    process.env.GOOGLE_GENAI_API_KEY = apiKey;

    const runner = new Runner({
      agent,
      sessionService: this.sessionService,
      appName: 'nido-newsletter-agent',
    });

    this.logger.log(
      `Invoking ADK Agent "Firenze" (${modelName}) to generate newsletter draft...`,
    );
    let activeSessionId: string | undefined;
    try {
      const session = await this.sessionService.createSession({
        appName: 'nido-newsletter-agent',
        userId: 'admin',
      });
      activeSessionId = session.id;
      this.supervisorService?.recordAgentRunStart({
        runId: session.id,
        agentKey: 'firenze',
        workflow: 'Weekly Top Picks Curation (@google/adk)',
        missionSummary: `Drafting ${params.editionType || 'weekly'} newsletter (${preview.dateRangeLabel})`,
        initiator: 'admin',
        model: modelName,
      });

      let text = '';
      let stagedHtml = '';
      let stagedTitle = '';
      let beehiivDraftInfo: any = undefined;

      const userMessageText = `Please draft the ${params.editionType || 'weekly'} newsletter for ${preview.dateRangeLabel}.
Start by fetching the approved concerts and verifying ticket URLs.
${params.autoPushToBeehiiv ? `Once the draft is ready, please stage it to Beehiiv as a draft using stageBeehiivDraftTool.` : `Format and output the complete drafted newsletter text in your response. Do not call stageBeehiivDraftTool.`}`;

      for await (const event of runner.runAsync({
        userId: 'admin',
        sessionId: session.id,
        newMessage: {
          role: 'user',
          parts: [{ text: userMessageText }],
        },
      })) {
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if (part.text) {
              text += part.text;
            }

            // Extract content if the model embedded the newsletter in stageBeehiivDraft arguments
            const fc = (part as any).functionCall;
            if (fc) {
              if (fc.name === 'stageBeehiivDraft' && fc.args?.htmlContent) {
                stagedHtml = fc.args.htmlContent;
                stagedTitle = fc.args.title || '';
              } else if (fc.name === 'adk_request_confirmation') {
                const orig = fc.args?.originalFunctionCall;
                if (
                  orig?.name === 'stageBeehiivDraft' &&
                  orig.args?.htmlContent
                ) {
                  stagedHtml = orig.args.htmlContent;
                  stagedTitle = orig.args.title || '';
                }
              }
            }

            if ((part as any).functionResponse) {
              const fr = (part as any).functionResponse;
              if (fr.name === 'stageBeehiivDraft' && fr.response?.success) {
                beehiivDraftInfo = {
                  id: fr.response.id,
                  status: fr.response.status,
                  title: fr.response.title,
                };
              }
            }
          }
        }
      }

      // If text was empty but model staged the content into stageBeehiivDraft tool call, recover it
      if (!text && stagedHtml) {
        this.logger.log(
          `Recovered newsletter draft from staged tool call payload ("${stagedTitle}").`,
        );
        text = stagedHtml;
      }

      if (!text) {
        throw new InternalServerErrorException(
          'Gemini API returned an empty newsletter draft.',
        );
      }

      // Keep explicit manual push as fallback if ADK agent didn't push when autoPushToBeehiiv is true
      let beehiivDraft: BeehiivDraftResponse | undefined;

      const postTitle =
        stagedTitle || `EZ Vibes Top Picks: ${preview.dateRangeLabel}`;
      const htmlContent = this.convertMarkdownToHtml(text);

      if (params.autoPushToBeehiiv) {
        if (beehiivDraftInfo) {
          this.logger.log(
            `Agent automatically pushed generated newsletter to Beehiiv.`,
          );
          beehiivDraft = beehiivDraftInfo;
        } else {
          this.logger.log(
            `Agent did not auto-push. Falling back to auto-pushing generated newsletter to Beehiiv: "${postTitle}"`,
          );
          beehiivDraft = await this.beehiivService.createDraftFromHtml({
            title: postTitle,
            htmlContent: htmlContent,
            postTemplateId: params.postTemplateId,
          });
        }
        if (activeSessionId) {
          this.supervisorService?.recordAgentRunComplete({
            runId: activeSessionId,
            agentKey: 'firenze',
            status: 'succeeded',
            outputSummary: `Generated & staged "${postTitle}" (${preview.totalCount} concerts) to Beehiiv.`,
          });
        }
      } else if (activeSessionId) {
        this.supervisorService?.recordAgentWaitingForHuman({
          runId: activeSessionId,
          agentKey: 'firenze',
          gateTitle: `Confirm Beehiiv Draft: ${postTitle}`,
          gateSummary: `Firenze curated ${preview.totalCount} concerts for ${preview.dateRangeLabel}. Ready for operator confirmation.`,
          newsletterDraft: {
            title: postTitle,
            dateRangeLabel: preview.dateRangeLabel,
            concertsCount: preview.totalCount,
            htmlContent,
          },
        });
      }

      return {
        newsletterDraft: text,
        concertsCount: preview.totalCount,
        beehiivDraft,
      };
    } catch (err) {
      if (activeSessionId) {
        this.supervisorService?.recordAgentRunComplete({
          runId: activeSessionId,
          agentKey: 'firenze',
          status: 'failed',
          outputSummary: `Newsletter generation failed: ${err.message}`,
          errorCategory: 'GEMINI_ADK_ERROR',
        });
      }
      this.logger.error(
        `Gemini API generation failed: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        `Gemini generation failed: ${err.message}`,
      );
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
      concerts = await this.newsletterCatalogService.findApprovedConcerts({
        start,
        end,
        cities: params.cities,
        genres: params.genres,
        venues: params.venues,
        region: params.region,
        strictFiltering: params.strictFiltering,
        featuredOnly: params.featuredOnly,
        topPicksOnly: params.topPicksOnly,
        excludeConcertIds: params.excludeConcertIds,
      });
    }

    const rawCalendarEvents: NewsletterSourceConcert[] = [];

    if (params.includeJambaseCalendar) {
      try {
        const jambaseEvents = await this.parseCalendarData(
          JAMBASE_NC_ICAL_URL,
          start.toISOString(),
          end.toISOString(),
          'JamBase Calendar',
        );
        rawCalendarEvents.push(...jambaseEvents);
      } catch (err: any) {
        this.logger.warn(
          `Failed to fetch or parse JamBase iCal feed: ${err.message}`,
        );
      }
    }

    if (params.includeGoogleCalendar) {
      try {
        const gcalEvents = await this.parseCalendarData(
          GOOGLE_CALENDAR_EZ_VIBES_ICAL_URL,
          start.toISOString(),
          end.toISOString(),
          'Google Calendar',
        );
        rawCalendarEvents.push(...gcalEvents);
      } catch (err: any) {
        this.logger.warn(
          `Failed to fetch or parse Google Calendar feed: ${err.message}`,
        );
      }
    }

    if (params.rawCalendarData) {
      const customEvents = await this.parseCalendarData(
        params.rawCalendarData,
        start.toISOString(),
        end.toISOString(),
        'Calendar Feed',
      );
      rawCalendarEvents.push(...customEvents);
    }

    // Deduplicate calendar events against database concerts and each other by normalized title + date
    const seenConcertKeys = new Set(
      concerts.map(
        (c) =>
          `${(c.title || '').toLowerCase().trim()}_${(c.date || '').trim()}`,
      ),
    );

    const calendarEvents: NewsletterSourceConcert[] = [];
    for (const event of rawCalendarEvents) {
      const key = `${(event.title || '').toLowerCase().trim()}_${(event.date || '').trim()}`;
      if (!seenConcertKeys.has(key)) {
        seenConcertKeys.add(key);
        calendarEvents.push(event);
      }
    }

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
      .replace(
        /{{FEATURED_FESTIVAL}}/g,
        params.featuredFestival || 'None specified.',
      )
      .replace(
        /- \*\*Featured Festival Notes:\*\* \[Provided by Evan\]/g,
        `- **Featured Festival Notes:** ${params.featuredFestival || 'None'}`,
      )
      .replace(/{{RAW_CALENDAR_DATA}}/g, params.rawCalendarData)
      .replace(
        /\[Injected programmatically or pasted here\]/g,
        params.rawCalendarData,
      ) +
      `\n\n### EDITORIAL TASTE PROFILE & VOICE GUIDELINES (LEARNED FROM PRODUCTION EDITIONS)
- **Voice & Identity:** You are the authentic editorial voice of Evan and Camille, founders of EZ Vibes. Warm, soulful, local NC scene insider, community-first.
- **Scene DNA:** Jam-adjacent, funk, soul, bluegrass, roots, psychedelic rock, Americana, reggae.
- **Priority Artist Radar:** ${EZ_VIBES_CORE_ARTISTS.join(', ')}.
- **Priority Venue Roster:** ${EZ_VIBES_CORE_VENUES.join(', ')}.
- **Priority Festival Roster:** ${EZ_VIBES_CORE_FESTIVALS.join(', ')}.
- **Language Discipline:** Natural scene vocabulary ("in the pocket", "heaters", "heads", "bring a friend"). Strictly avoid corporate superlatives ("a night you won't forget", "must-see sensation"), fake firsthand attendance, or forced hype.
- **Structural Rules (10-Section Canonical Flow):**
  - 1. Header Banner & Date Range
  - 2. Quick Hits (5 emoji bullets: 👑 EZ Vibes Update, 🐸 Featured Show, 💫 Featured Festival, ✅ Top Picks, 🤝 Partnership Opportunities)
  - 3. The EZ Vibes Update (personal recap & community photos)
  - 4. Featured Show Breakdown (high-contrast ticket button)
  - 5. Featured Festival Spotlight (ticket/info button)
  - 6. Top Picks Schedule (chronological layout: [**Band Name**](Ticket URL) [(FREE!) if applicable] \\n **Venue Name** – City, State \\n *The Vibe:* One punchy sentence)
  - 7. Weekly Community Poll: Ask readers which show/festival they are hitting this week.
  - 8. Partner with EZ Vibes: Highlight the 40%+ open rate.
  - 9. Join the Street Team: 5 referrals = sticker, 10 = hat, 20 = pair of free tickets to The Pour House or Bowstring (with {{ referral_program }}).
  - 10. Sign-off & Social Links: "Find a show and bring a friend,\\nEvan and Camille from EZ Vibes".`;
  }

  public convertMarkdownToHtml(markdown: string): string {
    return formatNewsletterMarkdownToHtml(markdown);
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

  private async parseCalendarData(
    rawInput: string,
    timeMin?: string,
    timeMax?: string,
    sourceName: string = 'Calendar Feed (ICS)',
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
          source: sourceName,
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
        if (line.startsWith('SUMMARY:'))
          current.summary = line.replace('SUMMARY:', '');
        if (line.startsWith('LOCATION:'))
          current.location = line.replace('LOCATION:', '');
        if (line.startsWith('DESCRIPTION:'))
          current.description = line.replace('DESCRIPTION:', '');
        if (line.startsWith('DTSTART:'))
          current.start = { dateTime: line.replace('DTSTART:', '') };
      }
    }

    return events;
  }

  private isWithinRange(
    event: GoogleCalendarEvent,
    min?: string,
    max?: string,
  ): boolean {
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
