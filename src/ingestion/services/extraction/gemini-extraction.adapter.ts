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

const DEFAULT_EXTRACTION_MODEL = 'gemini-3.8-flash';
const FALLBACK_EXTRACTION_MODEL = 'gemini-flash-latest';
const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
]);

export const CANONICAL_CONCERT_GENRES = [
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

export const US_STATE_TIMEZONE_MAP: Record<string, string> = {
  NC: 'America/New_York',
  SC: 'America/New_York',
  VA: 'America/New_York',
  GA: 'America/New_York',
  FL: 'America/New_York',
  NY: 'America/New_York',
  PA: 'America/New_York',
  NJ: 'America/New_York',
  MA: 'America/New_York',
  MD: 'America/New_York',
  DC: 'America/New_York',
  TN: 'America/Chicago',
  IL: 'America/Chicago',
  TX: 'America/Chicago',
  OH: 'America/New_York',
  CA: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  OR: 'America/Los_Angeles',
  CO: 'America/Denver',
  AZ: 'America/Phoenix',
};

export function inferTimezone(state?: string, city?: string): string | undefined {
  if (state) {
    const st = state.trim().toUpperCase();
    if (US_STATE_TIMEZONE_MAP[st]) {
      return US_STATE_TIMEZONE_MAP[st];
    }
  }
  if (city) {
    const c = city.trim().toLowerCase();
    if (['raleigh', 'durham', 'chapel hill', 'carrboro', 'charlotte', 'asheville', 'greensboro', 'wilmington', 'richmond', 'atlanta', 'brooklyn', 'new york'].includes(c)) {
      return 'America/New_York';
    }
    if (['chicago', 'nashville', 'austin', 'dallas', 'houston', 'new orleans'].includes(c)) {
      return 'America/Chicago';
    }
    if (['los angeles', 'san francisco', 'seattle', 'portland', 'oakland', 'san diego'].includes(c)) {
      return 'America/Los_Angeles';
    }
    if (['denver', 'boulder', 'salt lake city'].includes(c)) {
      return 'America/Denver';
    }
  }
  return undefined;
}

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
      const todayDate = new Date().toISOString().slice(0, 10);
      const prompt = `You are an expert concert poster extraction engine. Extract concert and live music event details with precision.
Current Reference Upload Date: ${todayDate}. If the poster mentions a day of the week and month/day without a year (e.g. "SATURDAY OCT 31"), resolve the year deterministically to the upcoming calendar date on or after the reference date.

CRITICAL EXTRACTION RULES:
1. Canonical Primary Genre & Multi-Genre Arrays:
   - primaryGenre: Must select the single best matching canonical genre from: [${CANONICAL_CONCERT_GENRES.join(', ')}].
   - genres: Array of all applicable genres/subgenres stated or implied (e.g. ["Folk", "Bluegrass", "Americana"]).
   - isFestival: Set to true if the poster represents a multi-act festival, showcase, or special event series.
2. Times & Timezones:
   - doorsTime: The doors open time in 24-hour HH:MM:SS format (e.g., "19:00:00" for 7 PM).
   - startTime: The show / concert start time in 24-hour HH:MM:SS format (e.g., "20:00:00" for 8 PM).
   - NEVER output "00:00:00" if no time is printed on the poster! If a time is not printed, leave it null/empty.
   - Infer the IANA timezone (e.g., "America/New_York", "America/Chicago", "America/Los_Angeles") based on the venue city and state.
3. Performers vs. Promoters/Sponsors:
   - Separate organizers, presenters, promoters, series names, or radio sponsors ("Presented by Cat's Cradle & WKNC", "Live Nation Presents") into promotersAndSponsors.
   - NEVER misclassify a presenter or promoter as a performer in the lineup!
   - Capture optional setTime and stage in performers if printed (e.g., festival schedules).
4. Additional Metadata:
   - ticketPrice: Printed ticket prices (e.g., "$15 ADV / $20 DOS", "Free").
   - ageRestriction: Age limit (e.g., "21+", "18+", "All Ages").
   - ticketUrlOrInfo: Printed ticket URLs or box office details.
   - rawOcrText: Verbatim text transcription of the entire poster graphic.
5. Hints:
   - Poster evidence is authoritative when clearly printed. Uploader hints should only fill in missing fields (like missing year or city/state) and should never override clear poster text.`;

      let hintText = '';
      if (hints) {
        hintText =
          '\nHints provided by user (use these only if missing or ambiguous on the poster, do not override clear poster evidence):\n' +
          JSON.stringify(hints);
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Poster image buffer is required for live Gemini extraction');
      }

      const sniffResult = validateImageBuffer(imageBuffer);
      if (!sniffResult.isValid || !sniffResult.mimeType) {
        throw new Error('Corrupted or unsupported image buffer rejected before Gemini extraction');
      }

      const verifiedMimeType = sniffResult.mimeType;

      const parts: any[] = [
        { text: prompt + hintText },
        {
          inlineData: {
            mimeType: verifiedMimeType,
            data: imageBuffer.toString('base64'),
          },
        },
      ];

      const requestConfig = {
        responseMimeType: 'application/json',
        // Cap thinking tokens to keep per-poster OCR fast (~2.5s) and low-cost (< $0.001/poster)
        thinkingConfig: {
          thinkingBudget: 256,
        },
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              isFestival: { type: Type.BOOLEAN },
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
                    doorsTime: { type: Type.STRING, description: 'HH:MM:SS 24-hr doors time or empty' },
                    startTime: { type: Type.STRING, description: 'HH:MM:SS 24-hr show time or empty' },
                    timezone: { type: Type.STRING, description: 'IANA timezone like America/New_York' },
                  },
                },
              },
              primaryGenre: {
                type: Type.STRING,
                enum: CANONICAL_CONCERT_GENRES as unknown as string[],
              },
              genres: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              genre: { type: Type.STRING },
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
        // Deterministic post-processing of times: 00:00:00 -> undefined
        if (Array.isArray(item.dates)) {
          for (const d of item.dates) {
            if (d.startTime === '00:00:00' || d.startTime === '00:00') {
              delete d.startTime;
            }
            if (d.doorsTime === '00:00:00' || d.doorsTime === '00:00') {
              delete d.doorsTime;
            }
            if (!d.timezone) {
              const inferred = inferTimezone(item.venue?.state || hints?.state, item.venue?.city || hints?.city);
              if (inferred) d.timezone = inferred;
            }
          }
        }

        // Fill in missing date from hints if absent
        if ((!Array.isArray(item.dates) || item.dates.length === 0) && hints?.date) {
          item.dates = [{
            date: hints.date,
            timezone: inferTimezone(item.venue?.state || hints?.state, item.venue?.city || hints?.city) || 'America/New_York',
          }];
        }

        // Canonical primary genre mapping
        if (!item.primaryGenre && item.genre) {
          const match = CANONICAL_CONCERT_GENRES.find(
            (g) => g.toLowerCase() === item.genre?.toLowerCase(),
          );
          if (match) {
            item.primaryGenre = match;
          }
        }
        if (!item.genre && item.primaryGenre) {
          item.genre = item.primaryGenre;
        }

        // Split multi-date events
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

    let mockResponse = mocks['test-single'];
    if (imageUrl.includes('multi')) mockResponse = mocks['test-multi'];
    if (imageUrl.includes('malformed')) throw new Error('Malformed JSON');

    if (!mockResponse) {
      return [];
    }

    // Clone to prevent mutating cache
    const responseClone = JSON.parse(JSON.stringify(mockResponse));

    if (responseClone.dates && responseClone.dates.length > 1) {
      return responseClone.dates.map((d: any) => {
        let newD = { ...responseClone, dates: [d] };
        if (hints && hints.date && newD.dates && newD.dates[0]) {
          if (hints.date !== newD.dates[0].date) {
            newD.dates[0].warning = `Hint conflict: uploader suggested '${hints.date}', poster states '${newD.dates[0].date}'`;
          }
        }
        return newD;
      });
    }

    const results = [responseClone as ExtractionResult];
    if (hints && hints.date && results[0].dates && results[0].dates[0]) {
      if (hints.date !== results[0].dates[0].date) {
        results[0].dates[0].warning = `Hint conflict: uploader suggested '${hints.date}', poster states '${results[0].dates[0].date}'`;
      }
    }

    return results;
  }
}
