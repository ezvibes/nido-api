import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Artist } from '../../apis/concerts/dto/artist.dto';
import type { Venue } from '../../apis/concerts/dto/venue.dto';
import type { ConcertExtractionResult } from '../interfaces/concert-extraction.interface';
import type { GoogleCalendarEvent } from '../interfaces/google-calendar-event.interface';

interface ExtractionContext {
  customPrompt?: string;
  customContext?: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export interface ConcertExtractionPolicy {
  allowedGenres: string[];
  minimumConfidence: number;
  requireVenue: boolean;
  requireArtist: boolean;
  maxDescriptionLength: number;
}

@Injectable()
export class GeminiConcertExtractorService {
  private readonly logger = new Logger(GeminiConcertExtractorService.name);
  private readonly endpoint =
    'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private readonly configService: ConfigService) {}

  getPromptTemplate() {
    return this.buildPromptTemplate(this.getExtractionPolicy());
  }

  getExtractionPolicy(): ConcertExtractionPolicy {
    const configuredGenres = this.configService
      .get<string>('CONCERT_SYNC_ALLOWED_GENRES')
      ?.trim();

    const allowedGenres = (
      configuredGenres
        ? configuredGenres.split(',').map((value) => value.trim())
        : [
            'Hip Hop',
            'Latin',
            'Metal',
            'Electronic',
            'Jazz',
            'Country',
            'R&B',
            'Indie',
            'Rock',
            'Pop',
            'Live',
          ]
    ).filter(Boolean);

    const minimumConfidence = this.normalizeFloatFromEnv(
      this.configService.get<string>('CONCERT_SYNC_MIN_CONFIDENCE'),
      0.6,
    );

    const requireVenue =
      this.configService.get<string>('CONCERT_SYNC_REQUIRE_VENUE')?.trim() !==
      'false';
    const requireArtist =
      this.configService.get<string>('CONCERT_SYNC_REQUIRE_ARTIST')?.trim() !==
      'false';
    const maxDescriptionLength = this.normalizeIntFromEnv(
      this.configService.get<string>('CONCERT_SYNC_MAX_DESCRIPTION_LENGTH'),
      1200,
      200,
      10_000,
    );

    return {
      allowedGenres,
      minimumConfidence,
      requireVenue,
      requireArtist,
      maxDescriptionLength,
    };
  }

  getSanitizedEventPreview(event: GoogleCalendarEvent) {
    return this.sanitizeEventForPrompt(event);
  }

  isGeminiEnabled() {
    return (
      this.configService
        .get<string>('CONCERT_SYNC_GEMINI_ENABLED')
        ?.trim()
        .toLowerCase() !== 'false'
    );
  }

  buildPromptPreview(event: GoogleCalendarEvent, context: ExtractionContext) {
    return this.buildPrompt(this.sanitizeEventForPrompt(event), context);
  }

  async extractConcert(
    event: GoogleCalendarEvent,
    context: ExtractionContext,
  ): Promise<ConcertExtractionResult> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    const model =
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      DEFAULT_GEMINI_MODEL;

    if (!this.isGeminiEnabled()) {
      return this.buildHeuristicExtraction(event, {
        fallbackReason: 'gemini_disabled',
        model,
      });
    }

    if (!apiKey) {
      return this.buildHeuristicExtraction(event, {
        fallbackReason: 'missing_gemini_api_key',
        model,
      });
    }

    try {
      const sanitizedEvent = this.sanitizeEventForPrompt(event);
      const prompt = this.buildPrompt(sanitizedEvent, context);
      const response = await fetch(
        `${this.endpoint}/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        const providerMessage = this.extractProviderMessage(body);
        this.logger.warn(
          `Gemini extraction failed (${response.status}): ${body.slice(0, 300)}`,
        );
        return this.buildHeuristicExtraction(event, {
          fallbackReason: this.classifyGeminiHttpFailure(response.status, body),
          providerStatus: response.status,
          providerMessage,
          model,
        });
      }

      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return this.buildHeuristicExtraction(event, {
          fallbackReason: 'empty_gemini_response',
          model,
        });
      }

      const parsed = this.tryParseJson(text);
      if (!parsed) {
        return this.buildHeuristicExtraction(event, {
          fallbackReason: 'invalid_gemini_json',
          model,
        });
      }

      return {
        ...this.normalizeExtraction(parsed, event),
        extractionSource: 'gemini',
        model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Gemini extraction threw error: ${message}`);
      return this.buildHeuristicExtraction(event, {
        fallbackReason: 'gemini_request_error',
        providerMessage: message,
        model,
      });
    }
  }

  private buildPrompt(
    sanitizedEvent: Record<string, unknown>,
    context: ExtractionContext,
  ): string {
    const policy = this.getExtractionPolicy();
    return [
      context.customPrompt?.trim() || this.buildPromptTemplate(policy),
      context.customContext?.trim()
        ? `Additional product context: ${context.customContext.trim()}`
        : null,
      'Sanitized calendar event JSON:',
      JSON.stringify(sanitizedEvent),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private sanitizeEventForPrompt(event: GoogleCalendarEvent) {
    return {
      id: event.id,
      status: event.status,
      summary: this.redactSensitiveText(event.summary),
      description: this.redactSensitiveText(event.description),
      location: this.redactSensitiveText(event.location),
      start: {
        dateTime: event.start?.dateTime,
        date: event.start?.date,
        timeZone: event.start?.timeZone,
      },
      end: {
        dateTime: event.end?.dateTime,
        date: event.end?.date,
        timeZone: event.end?.timeZone,
      },
      updated: event.updated,
      created: event.created,
    };
  }

  private redactSensitiveText(value: string | undefined) {
    if (!value) return value;
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted_email]')
      .replace(/https?:\/\/\S+/gi, '[redacted_url]')
      .replace(/\+?\d[\d()\-\s]{7,}\d/g, '[redacted_phone]')
      .slice(0, 4000);
  }

  private tryParseJson(raw: string): Record<string, unknown> | undefined {
    const cleaned = raw.trim();

    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (!fencedMatch) return undefined;
      try {
        return JSON.parse(fencedMatch[1]) as Record<string, unknown>;
      } catch {
        return undefined;
      }
    }
  }

  private normalizeExtraction(
    payload: Record<string, unknown>,
    fallbackEvent: GoogleCalendarEvent,
  ): ConcertExtractionResult {
    const policy = this.getExtractionPolicy();
    const fallback = this.buildHeuristicExtraction(fallbackEvent);

    const artists = this.normalizeArtists(payload.artists, fallback.artists);
    const venues = this.normalizeVenues(payload.venues, fallback.venues);
    const guidanceQuestions = Array.isArray(payload.guidanceQuestions)
      ? payload.guidanceQuestions
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      : [];

    const confidence = Math.min(
      1,
      Math.max(
        0,
        Number(payload.confidence ?? fallback.confidence) ||
          fallback.confidence,
      ),
    );

    const needsGuidance =
      Boolean(payload.needsGuidance) ||
      (policy.requireArtist && artists.length === 0) ||
      (policy.requireVenue && venues.length === 0) ||
      confidence < policy.minimumConfidence;

    const genre = this.normalizeGenre(
      this.normalizeText(payload.genre) || fallback.genre,
      policy.allowedGenres,
    );

    return {
      title: this.normalizeText(payload.title) || fallback.title,
      genre,
      startsAt: this.normalizeIso(payload.startsAt) || fallback.startsAt,
      endsAt:
        this.normalizeNullableIso(payload.endsAt) ?? fallback.endsAt ?? null,
      description: this.trimDescription(
        this.normalizeOptionalText(payload.description) ??
          fallback.description ??
          null,
        policy.maxDescriptionLength,
      ),
      artists,
      venues,
      confidence,
      needsGuidance,
      guidanceQuestions: needsGuidance
        ? guidanceQuestions.length
          ? guidanceQuestions
          : ['Can you confirm headliner name and venue details?']
        : [],
    };
  }

  private buildHeuristicExtraction(
    event: GoogleCalendarEvent,
    metadata: Partial<
      Pick<
        ConcertExtractionResult,
        'fallbackReason' | 'providerStatus' | 'providerMessage' | 'model'
      >
    > = {},
  ): ConcertExtractionResult {
    const policy = this.getExtractionPolicy();
    const title = (event.summary || 'Untitled concert').trim();
    const startsAt = this.resolveStartDate(event);
    const endsAt = this.resolveEndDate(event);

    const venue = this.parseVenueFromLocation(event.location);
    const artists = this.extractArtistsFromTitle(title);
    const venues: Venue[] = venue ? [venue] : [];

    const genre = this.deriveGenre(
      title,
      event.description,
      policy.allowedGenres,
    );
    const needsGuidance =
      (policy.requireArtist && artists.length === 0) ||
      (policy.requireVenue && venues.length === 0);

    return {
      title,
      genre,
      startsAt,
      endsAt,
      description: this.trimDescription(
        event.description?.trim() || null,
        policy.maxDescriptionLength,
      ),
      artists,
      venues,
      confidence: needsGuidance
        ? Math.max(0.35, policy.minimumConfidence - 0.2)
        : Math.max(0.63, policy.minimumConfidence),
      needsGuidance,
      guidanceQuestions: needsGuidance
        ? ['Please confirm artist lineup and venue details for this event.']
        : [],
      extractionSource: 'heuristic',
      ...metadata,
    };
  }

  private classifyGeminiHttpFailure(status: number, body: string) {
    if (status === 429) {
      const normalizedBody = body.toLowerCase();
      if (
        normalizedBody.includes('prepayment credits are depleted') ||
        normalizedBody.includes('billing')
      ) {
        return 'gemini_billing_or_quota_exhausted';
      }
      return 'gemini_rate_limited';
    }

    if (status >= 500) {
      return 'gemini_server_error';
    }

    return 'gemini_http_error';
  }

  private extractProviderMessage(body: string) {
    try {
      const parsed = JSON.parse(body) as {
        error?: { message?: unknown };
      };
      const message = parsed.error?.message;
      if (typeof message === 'string') {
        return message.slice(0, 500);
      }
    } catch {
      // Use the raw body fallback below.
    }

    return body.slice(0, 500);
  }

  private extractArtistsFromTitle(title: string): Artist[] {
    const match = title.match(
      /(?:with|feat\.?|featuring|headliner:?|lineup:?)[\s:]+([^|@]+)/i,
    );

    if (!match?.[1]) {
      return title.trim() ? [{ name: title.trim() }] : [];
    }

    return match[1]
      .split(/,|&|\+/)
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
  }

  private deriveGenre(
    title: string,
    description?: string,
    allowedGenres?: string[],
  ): string {
    const haystack = `${title} ${description || ''}`.toLowerCase();

    const knownGenres: Array<{ keyword: RegExp; genre: string }> = [
      { keyword: /hip\s*hop|rap/, genre: 'Hip Hop' },
      { keyword: /reggaeton|latin/, genre: 'Latin' },
      { keyword: /metal|hardcore/, genre: 'Metal' },
      { keyword: /edm|electronic|dj/, genre: 'Electronic' },
      { keyword: /jazz|blues/, genre: 'Jazz' },
      { keyword: /country/, genre: 'Country' },
      { keyword: /r&b|soul/, genre: 'R&B' },
      { keyword: /indie|alternative/, genre: 'Indie' },
      { keyword: /rock|punk/, genre: 'Rock' },
      { keyword: /pop/, genre: 'Pop' },
    ];

    for (const known of knownGenres) {
      if (known.keyword.test(haystack)) {
        return this.normalizeGenre(known.genre, allowedGenres);
      }
    }

    return this.normalizeGenre('Live', allowedGenres);
  }

  private normalizeGenre(genre: string, allowedGenres?: string[]) {
    const normalized = genre.trim();
    const source = allowedGenres?.length ? allowedGenres : ['Live'];
    const directMatch = source.find(
      (value) => value.toLowerCase() === normalized.toLowerCase(),
    );
    return directMatch || 'Live';
  }

  private trimDescription(value: string | null, maxLength: number) {
    if (!value) return value;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private buildPromptTemplate(policy: ConcertExtractionPolicy) {
    return [
      'You are a deterministic event-to-concert extraction engine for a production API.',
      'Return a single JSON object only. Do not wrap in markdown.',
      'Use this exact schema and keys:',
      '{',
      '  "title": string,',
      `  "genre": one of [${policy.allowedGenres.join(', ')}],`,
      '  "startsAt": string (ISO-8601),',
      '  "endsAt": string | null (ISO-8601),',
      `  "description": string | null (max ${policy.maxDescriptionLength} chars),`,
      '  "artists": [{ "name": string, "role"?: string, "genre"?: string }],',
      '  "venues": [{ "name": string, "city"?: string, "state"?: string, "country"?: string }],',
      '  "confidence": number (0 to 1),',
      '  "needsGuidance": boolean,',
      '  "guidanceQuestions": string[]',
      '}',
      'Rules:',
      '- Extract only from provided event payload and context.',
      '- Never invent private personal data.',
      `- If unknown genre, set genre to "${this.normalizeGenre('Live', policy.allowedGenres)}".`,
      '- If end time is unknown, set endsAt to null.',
      `- Set needsGuidance=true when confidence is below ${policy.minimumConfidence.toFixed(2)}.`,
      `- Require artist=${policy.requireArtist}, require venue=${policy.requireVenue}.`,
    ].join('\n');
  }

  private normalizeFloatFromEnv(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, 0), 1);
  }

  private normalizeIntFromEnv(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), min), max);
  }

  private normalizeArtists(value: unknown, fallback: Artist[]): Artist[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const artists = value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return undefined;
        const record = entry as Record<string, unknown>;
        const name = this.normalizeText(record.name);
        if (!name) return undefined;
        return {
          name,
          role: this.normalizeOptionalText(record.role) ?? undefined,
          genre: this.normalizeOptionalText(record.genre) ?? undefined,
        };
      })
      .filter(Boolean) as Artist[];

    return artists.length ? artists : fallback;
  }

  private normalizeVenues(value: unknown, fallback: Venue[]): Venue[] {
    if (!Array.isArray(value)) {
      return fallback;
    }

    const venues = value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return undefined;
        const record = entry as Record<string, unknown>;
        const name = this.normalizeText(record.name);
        if (!name) return undefined;

        return {
          name,
          city: this.normalizeOptionalText(record.city) ?? undefined,
          state: this.normalizeOptionalText(record.state) ?? undefined,
          country: this.normalizeOptionalText(record.country) ?? undefined,
        };
      })
      .filter(Boolean) as Venue[];

    return venues.length ? venues : fallback;
  }

  private parseVenueFromLocation(location?: string): Venue | null {
    const normalized = location?.trim();
    if (!normalized) return null;

    const parts = normalized
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) return null;

    const venue: Venue = { name: parts[0] };
    const countryCandidate = parts[parts.length - 1];
    if (/^(usa|united states)$/i.test(countryCandidate)) {
      venue.country = 'USA';
    }

    const stateZipIndex = parts.findIndex((part) =>
      /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(part),
    );
    if (stateZipIndex > 0) {
      venue.city = parts[stateZipIndex - 1];
      const stateMatch = parts[stateZipIndex].match(/\b([A-Z]{2})\b/);
      venue.state = stateMatch?.[1];
      return venue;
    }

    const stateOnlyIndex = parts.findIndex((part) => /^[A-Z]{2}$/.test(part));
    if (stateOnlyIndex > 0) {
      venue.city = parts[stateOnlyIndex - 1];
      venue.state = parts[stateOnlyIndex];
      return venue;
    }

    if (parts.length >= 3) {
      venue.city = parts[parts.length - (venue.country ? 3 : 2)];
      const stateMatch =
        parts[parts.length - (venue.country ? 2 : 1)]?.match(/\b([A-Z]{2})\b/);
      venue.state = stateMatch?.[1];
    }

    return venue;
  }

  private resolveStartDate(event: GoogleCalendarEvent): string {
    const value = event.start?.dateTime || event.start?.date || event.created;
    return this.normalizeIso(value) || new Date().toISOString();
  }

  private resolveEndDate(event: GoogleCalendarEvent): string | null {
    return (
      this.normalizeNullableIso(event.end?.dateTime || event.end?.date) ?? null
    );
  }

  private normalizeText(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  private normalizeOptionalText(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeIso(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  }

  private normalizeNullableIso(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return this.normalizeIso(value) ?? null;
  }
}
