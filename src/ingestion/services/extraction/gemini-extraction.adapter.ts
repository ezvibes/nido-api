import { Injectable, Logger } from '@nestjs/common';
import {
  IExtractionAdapter,
  ExtractionResult,
  ExtractionHints,
} from './iextraction.adapter';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

const DEFAULT_EXTRACTION_MODEL = 'gemini-3.8-flash';
const FALLBACK_EXTRACTION_MODEL = 'gemini-flash-latest';
const RETIRED_GEMINI_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
]);

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
      const prompt = `Extract the concert details from this poster.
      If you receive hints, do not let them override what is clearly stated on the poster.`;

      let hintText = '';
      if (hints) {
        hintText =
          'Hints provided by user (use these only if the poster is ambiguous, but do not override clear poster evidence):\n' +
          JSON.stringify(hints);
      }

      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Poster image buffer is required for live Gemini extraction');
      }

      const parts: any[] = [
        { text: prompt + '\n' + hintText },
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
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
                  },
                },
              },
              dates: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    startTime: { type: Type.STRING, description: 'HH:MM:SS' },
                    timezone: { type: Type.STRING },
                  },
                },
              },
              genre: { type: Type.STRING },
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
        if ((!Array.isArray(item.dates) || item.dates.length === 0) && hints?.date) {
          item.dates = [{ date: hints.date }];
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
    if (imageUrl.includes('malformed')) throw new Error('Malformed JSON');

    if (!mockResponse) {
      return [];
    }

    const results = [mockResponse as ExtractionResult];

    // Map to array as single event returns one item, multi returns multi
    if (mockResponse.dates && mockResponse.dates.length > 1) {
      return mockResponse.dates.map((d: any) => {
        let newD = { ...mockResponse, dates: [d] };
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
