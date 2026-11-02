import { Injectable, Logger } from '@nestjs/common';
import {
  IExtractionAdapter,
  ExtractionResult,
  ExtractionHints,
} from './iextraction.adapter';
import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { validateImageBuffer } from '../../utils/image-mime.util';
import { inferTimezoneFromLocation } from '../../utils/timezone-lookup.util';

const DEFAULT_EXTRACTION_MODEL = 'gemini-3.8-flash';
const FALLBACK_EXTRACTION_MODEL = 'gemini-flash-latest';
const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
]);

export const CANONICAL_GENRES = [
  'Jazz',
  'Bluegrass',
  'Funk',
  'Jam',
  'Reggae',
  'Hip-Hop',
  'Rock',
  'Folk',
  'Salsa',
  'Electronic',
] as const;

@Injectable()
export class GeminiExtractionAdapter implements IExtractionAdapter {
  private readonly logger = new Logger(GeminiExtractionAdapter.name);
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const configuredModel = (
      this.configService.get<string>('GEMINI_EXTRACTION_MODEL') ||
      this.configService.get<string>('GEMINI_MODEL') ||
      ''
    )
      .trim()
      .replace(/^models\//, '');

    if (!configuredModel || RETIRED_GEMINI_MODELS.has(configuredModel)) {
      if (configuredModel && RETIRED_GEMINI_MODELS.has(configuredModel)) {
        this.logger.warn(
          `Configured Gemini model "${configuredModel}" is retired; upgrading extraction adapter to "${DEFAULT_EXTRACTION_MODEL}".`,
        );
      }
      this.model = DEFAULT_EXTRACTION_MODEL;
    } else {
      this.model = configuredModel;
    }

    this.ai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY') || 'mock-key',
    });
  }

  getModelName(): string {
    return this.model;
  }

  async extract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
    imageBuffer?: Buffer,
  ): Promise<ExtractionResult[]> {
    if (
      this.configService.get('NODE_ENV') === 'test' ||
      !this.configService.get('GEMINI_API_KEY')
    ) {
      return this.mockExtract(imageUrl, mimeType, hints);
    }
    return this.realExtract(imageUrl, mimeType, hints, imageBuffer);
  }

  private async realExtract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
    imageBuffer?: Buffer,
  ): Promise<ExtractionResult[]> {
    try {
      const validation = validateImageBuffer(imageBuffer, mimeType);
      if (!validation.isValid || !imageBuffer) {
        throw new Error(
          validation.error || 'Invalid or unsupported image buffer for extraction',
        );
      }

      const activeMimeType = validation.normalizedMimeType || 'image/jpeg';
      const todayIso = new Date().toISOString().slice(0, 10);

      const prompt = `You are a high-precision live music concert poster analyzer for Nido (nido.events).
Your goal is to extract structured, publication-ready show candidates from this event poster.

Rules & Guidelines:
1. DATE ANCHOR: Today's reference date is ${todayIso}. If the poster omits the year (e.g. "FRIDAY OCT 31"), determine the upcoming calendar year deterministically relative to ${todayIso}.
2. DOORS vs SHOW TIMES:
   - Extract "doorsTime" and "startTime" separately in 24-hour HH:MM:SS format (e.g. "19:00:00" for 7 PM).
   - NEVER output "00:00:00" if no time is printed on the poster; leave it null or omitted.
3. CANONICAL GENRES & FESTIVALS:
   - "primaryGenre": Choose the best matching primary genre from: ${CANONICAL_GENRES.join(', ')}. If none fit, use the closest musical genre.
   - "genres": Array of all applicable genres/subgenres (e.g. ["Folk", "Bluegrass", "Americana"]).
   - "isFestival": true if the graphic is a festival, multi-stage, or multi-day lineup; false for standard club show.
4. LINEUP vs PROMOTERS:
   - "performers": Band/artist names only. Mark the headliner with isHeadliner=true. Optional "setTime" or "stage" if printed.
   - "promotersAndSponsors": Presenters, venues, radio sponsors, or partners (e.g. "Cat's Cradle Presents", "WKNC 88.1", "AEG Presents"). NEVER put promoters in performers!
5. PRICING & RESTRICTIONS:
   - "ticketPrice": Extract door/advance prices (e.g. "$15 ADV / $20 DOS", "Free").
   - "ageRestriction": Extract age limits (e.g. "21+", "18+", "All Ages").
   - "ticketUrlOrInfo": Printed ticketing links, box office phone, or sales locations.
6. HINTS PRECEDENCE:
   - Clear printed poster text is authoritative. Use hints only to resolve ambiguity or missing details.`;

      let hintText = '';
      if (hints) {
        hintText =
          '\nUser Context Hints (use to resolve missing fields, but poster text is authoritative):\n' +
          JSON.stringify(hints);
      }

      const parts: any[] = [
        { text: prompt + hintText },
        {
          inlineData: {
            mimeType: activeMimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ];

      const requestConfig = {
        responseMimeType: 'application/json',
        // Cap thinking tokens to keep per-poster OCR fast (~2.5s) and low-cost (~$0.0002/poster)
        thinkingConfig: {
          thinkingBudget: 256,
        },
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              venue: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  address: { type: Type.STRING },
                  city: { type: Type.STRING },
                  state: { type: Type.STRING },
                },
              },
              performers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    isHeadliner: { type: Type.BOOLEAN },
                    setTime: { type: Type.STRING },
                    stage: { type: Type.STRING },
                  },
                },
              },
              dates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    doorsTime: { type: Type.STRING, description: 'HH:MM:SS' },
                    startTime: { type: Type.STRING, description: 'HH:MM:SS' },
                    timezone: { type: Type.STRING },
                  },
                },
              },
              primaryGenre: { type: Type.STRING },
              genres: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              isFestival: { type: Type.BOOLEAN },
              ticketPrice: { type: Type.STRING },
              ageRestriction: { type: Type.STRING },
              promotersAndSponsors: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              ticketUrlOrInfo: { type: Type.STRING },
              rawOcrText: { type: Type.STRING },
            },
          },
        },
      };

      let response;
      try {
        response = await this.ai.models.generateContent({
          model: this.model,
          contents: parts,
          config: requestConfig,
        });
      } catch (primaryErr) {
        const errMsg =
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        if (
          (errMsg.includes('404') || errMsg.includes('NOT_FOUND')) &&
          this.model !== FALLBACK_EXTRACTION_MODEL
        ) {
          const fallbackModel =
            this.model !== DEFAULT_EXTRACTION_MODEL
              ? DEFAULT_EXTRACTION_MODEL
              : FALLBACK_EXTRACTION_MODEL;
          this.logger.warn(
            `Primary Gemini model "${this.model}" returned NOT_FOUND; retrying with "${fallbackModel}".`,
          );
          response = await this.ai.models.generateContent({
            model: fallbackModel,
            contents: parts,
            config: requestConfig,
          });
        } else {
          throw primaryErr;
        }
      }

      const text = response.text;
      const rawResults: ExtractionResult[] = JSON.parse(text || '[]');
      const flattenedResults: ExtractionResult[] = [];

      for (const item of rawResults) {
        // Normalize primaryGenre & genre
        if (!item.primaryGenre && item.genre) {
          item.primaryGenre = item.genre;
        }
        if (!item.genre && item.primaryGenre) {
          item.genre = item.primaryGenre;
        }

        if ((!Array.isArray(item.dates) || item.dates.length === 0) && hints?.date) {
          item.dates = [{ date: hints.date }];
        }

        // Infer timezone if omitted
        const locationTimezone = inferTimezoneFromLocation(
          item.venue?.state || hints?.state,
          item.venue?.city || hints?.city,
        );

        if (Array.isArray(item.dates)) {
          for (const d of item.dates) {
            if (!d.timezone && locationTimezone) {
              d.timezone = locationTimezone;
            }
          }
        }

        if (Array.isArray(item.dates) && item.dates.length > 1) {
          for (const d of item.dates) {
            flattenedResults.push({ ...item, dates: [{ ...d }] });
          }
        } else {
          flattenedResults.push(item);
        }
      }

      flattenedResults.forEach((result) => {
        if (hints && hints.date && result.dates && result.dates[0]) {
          if (hints.date !== result.dates[0].date) {
            result.dates[0].warning = `Hint conflict: uploader suggested '${hints.date}', poster states '${result.dates[0].date}'`;
          }
        }
      });
      return flattenedResults;
    } catch (e) {
      this.logger.error('Extraction failed', e);
      throw e;
    }
  }

  private async mockExtract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
  ): Promise<ExtractionResult[]> {
    this.logger.log(
      `Mock extracting ${imageUrl} with hints: ${JSON.stringify(hints)}`,
    );
    const mockFilePath = path.join(
      process.cwd(),
      'test/fixtures/posters/mocks/responses.json',
    );
    let mocks: any = {};
    if (fs.existsSync(mockFilePath)) {
      mocks = JSON.parse(fs.readFileSync(mockFilePath, 'utf-8'));
    }

    // Simple mock logic based on url/filename for tests
    let mockResponse = mocks['test-single'];
    if (imageUrl.includes('multi')) mockResponse = mocks['test-multi'];
    if (imageUrl.includes('festival')) {
      mockResponse = {
        title: 'Carolina Music Festival',
        venue: {
          name: 'Cat\'s Cradle Back Room',
          city: 'Carrboro',
          state: 'NC',
        },
        performers: [
          { name: 'Chatham County Line', isHeadliner: true, setTime: '21:00', stage: 'Main Stage' },
          { name: 'Mipso', isHeadliner: false, setTime: '19:30', stage: 'Acoustic Stage' },
        ],
        dates: [
          {
            date: '2026-10-15',
            doorsTime: '18:00:00',
            startTime: '19:00:00',
            timezone: 'America/New_York',
          },
        ],
        primaryGenre: 'Bluegrass',
        genres: ['Bluegrass', 'Folk', 'Americana'],
        isFestival: true,
        ticketPrice: '$25 ADV / $30 DOS',
        ageRestriction: 'All Ages',
        promotersAndSponsors: ['Cat\'s Cradle Presents', 'WUNC Radio'],
        rawOcrText: 'CAROLINA MUSIC FESTIVAL OCT 15 CATS CRADLE DOORS 6PM SHOW 7PM',
      };
    }
    if (imageUrl.includes('malformed')) throw new Error('Malformed JSON');

    if (!mockResponse) {
      return [];
    }

    const results = [{ ...(mockResponse as ExtractionResult) }];

    // Auto-fill primaryGenre & timezone if missing in mock
    const locationTz = inferTimezoneFromLocation(
      results[0].venue?.state || hints?.state,
      results[0].venue?.city || hints?.city,
    );
    if (results[0].dates && results[0].dates[0] && !results[0].dates[0].timezone && locationTz) {
      results[0].dates[0].timezone = locationTz;
    }
    if (!results[0].primaryGenre && results[0].genre) {
      results[0].primaryGenre = results[0].genre;
    }

    // Map to array as single event returns one item, multi returns multi
    if (mockResponse.dates && mockResponse.dates.length > 1) {
      return mockResponse.dates.map((d: any) => {
        let newD = { ...mockResponse, dates: [{ ...d }] };
        if (!newD.dates[0].timezone && locationTz) {
          newD.dates[0].timezone = locationTz;
        }
        if (hints && hints.date && newD.dates && newD.dates[0]) {
          if (hints.date !== newD.dates[0].date) {
            newD.dates[0].warning = `Hint conflict: uploader suggested '${hints.date}', poster states '${newD.dates[0].date}'`;
          }
        }
        return newD;
      });
    }

    if (hints && hints.date && results[0].dates && results[0].dates[0]) {
      if (hints.date !== results[0].dates[0].date) {
        results[0].dates[0].warning = `Hint conflict: uploader suggested '${hints.date}', poster states '${results[0].dates[0].date}'`;
      }
    }

    return results;
  }
}
