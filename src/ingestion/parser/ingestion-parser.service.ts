import { Injectable } from '@nestjs/common';

const GENRE_HINTS = [
  'rock',
  'indie',
  'punk',
  'metal',
  'hip hop',
  'rap',
  'jazz',
  'country',
  'folk',
  'pop',
  'electronic',
  'house',
  'dj',
];

export const INGESTION_PARSER_VERSION = 'mvp-v1';

export interface ParsedCandidateDraft {
  status: string;
  title?: string;
  description?: string;
  startAt?: Date;
  endAt?: Date;
  venueName?: string;
  city?: string;
  region?: string;
  artistNames?: string[];
  genreHints?: string[];
  parserVersion: string;
  parseConfidence: number;
  parseWarnings: string[];
  rawExtractedFields: Record<string, unknown>;
  rawOcrText: string;
}

@Injectable()
export class IngestionParserService {
  parseOcrText(
    ocrText: string,
    context?: { city?: string },
  ): ParsedCandidateDraft[] {
    const normalizedText = ocrText.trim();
    const lines = normalizedText
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const rawDateTime = this.extractDateTime(normalizedText);
    const rawLocation = this.extractLocation(lines, context?.city);
    const artistNames = this.extractArtists(lines, rawLocation.venueLine);
    const genreHints = this.extractGenreHints(normalizedText);
    const title = this.extractTitle(lines, rawLocation.venueLine);
    const description = lines.slice(0, 6).join(' · ');

    const warnings: string[] = [];

    if (!title) warnings.push('missing_title');
    if (!rawDateTime.startAt) warnings.push('missing_start_date');
    if (!rawLocation.venueName) warnings.push('missing_venue');
    if (!artistNames.length) warnings.push('missing_artists');
    if (!rawLocation.city) warnings.push('missing_city');

    const confidence = this.calculateConfidence({
      title,
      startAt: rawDateTime.startAt,
      venueName: rawLocation.venueName,
      city: rawLocation.city,
      artistCount: artistNames.length,
      genreCount: genreHints.length,
    });

    return [
      {
        status: 'needs_review',
        title,
        description,
        startAt: rawDateTime.startAt,
        endAt: rawDateTime.endAt,
        venueName: rawLocation.venueName,
        city: rawLocation.city,
        region: rawLocation.region,
        artistNames: artistNames.length ? artistNames : undefined,
        genreHints: genreHints.length ? genreHints : undefined,
        parserVersion: INGESTION_PARSER_VERSION,
        parseConfidence: confidence,
        parseWarnings: warnings,
        rawExtractedFields: {
          titleLine: title,
          dateText: rawDateTime.dateText,
          timeText: rawDateTime.timeText,
          venueLine: rawLocation.venueLine,
          cityLine: rawLocation.cityLine,
          artistLine: rawLocation.artistLine,
          matchedGenres: genreHints,
          fallbackCity: context?.city,
          sourceLines: lines,
        },
        rawOcrText: normalizedText,
      },
    ];
  }

  private extractTitle(lines: string[], venueLine?: string): string | undefined {
    return lines.find(
      (line) =>
        line !== venueLine &&
        !this.looksLikeDateOrTime(line) &&
        !/^(doors|tickets|all ages|advance|show|doors open)\b/i.test(line),
    );
  }

  private extractArtists(lines: string[], venueLine?: string): string[] {
    const candidateLine = lines.find(
      (line) =>
        line !== venueLine &&
        !this.looksLikeDateOrTime(line) &&
        /,|\+|&|\bwith\b|\bw\/\b|\bfeat\b|\bft\b|\//i.test(line),
    );

    const sourceLine = candidateLine ?? lines[0] ?? '';
    const artists = sourceLine
      .split(/,|\+|&|\bwith\b|\bw\/\b|\bfeat\.?\b|\bft\.?\b|\//i)
      .map((value) => value.trim())
      .filter((value) => value.length > 1)
      .slice(0, 8);

    return [...new Set(artists)];
  }

  private extractGenreHints(text: string): string[] {
    const lower = text.toLowerCase();
    return GENRE_HINTS.filter((genre) => lower.includes(genre));
  }

  private extractLocation(lines: string[], fallbackCity?: string) {
    const cityRegionMatch = lines
      .map((line) => ({
        line,
        match: line.match(/\b([A-Za-z .'-]+),\s*([A-Z]{2})\b/),
      }))
      .find((item) => item.match);

    const atLine = lines.find((line) => /(?:^|\s)(?:@|at)\s+/i.test(line));
    const venueName = atLine
      ? atLine.replace(/^.*?(?:@|at)\s+/i, '').trim()
      : cityRegionMatch
        ? lines[lines.indexOf(cityRegionMatch.line) - 1]
        : undefined;

    return {
      venueName: venueName && !this.looksLikeDateOrTime(venueName) ? venueName : undefined,
      venueLine: atLine ?? venueName,
      city: cityRegionMatch?.match?.[1]?.trim() ?? fallbackCity,
      region: cityRegionMatch?.match?.[2]?.trim(),
      cityLine: cityRegionMatch?.line,
      artistLine: lines.find((line) => /,|\+|&|\bwith\b|\bw\/\b|\bfeat\b|\bft\b|\//i.test(line)),
    };
  }

  private extractDateTime(text: string) {
    const monthMatch = text.match(
      /\b(?:(Mon|Tue|Tues|Wed|Thu|Thurs|Fri|Sat|Sun)\.?\s+)?(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:[^\n\r\d]{0,12}(\d{1,2}(?::\d{2})?\s?(?:AM|PM)))?(?:\s*[-–]\s*(\d{1,2}(?::\d{2})?\s?(?:AM|PM)))?/i,
    );

    const numericMatch = text.match(
      /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:[^\n\r\d]{0,12}(\d{1,2}(?::\d{2})?\s?(?:AM|PM)))?(?:\s*[-–]\s*(\d{1,2}(?::\d{2})?\s?(?:AM|PM)))?/i,
    );

    const year = new Date().getUTCFullYear();

    if (monthMatch) {
      const [, , month, day, providedYear, startTime, endTime] = monthMatch;
      const dateLabel = `${month} ${day}, ${providedYear ?? year}`;
      return {
        dateText: dateLabel,
        timeText: [startTime, endTime].filter(Boolean).join(' - ') || undefined,
        startAt: this.buildDate(dateLabel, startTime),
        endAt: this.buildDate(dateLabel, endTime),
      };
    }

    if (numericMatch) {
      const [, month, day, providedYear, startTime, endTime] = numericMatch;
      const normalizedYear = providedYear
        ? providedYear.length === 2
          ? `20${providedYear}`
          : providedYear
        : String(year);
      const dateLabel = `${month}/${day}/${normalizedYear}`;
      return {
        dateText: dateLabel,
        timeText: [startTime, endTime].filter(Boolean).join(' - ') || undefined,
        startAt: this.buildDate(dateLabel, startTime),
        endAt: this.buildDate(dateLabel, endTime),
      };
    }

    return {
      dateText: undefined,
      timeText: undefined,
      startAt: undefined,
      endAt: undefined,
    };
  }

  private buildDate(dateLabel: string, timeLabel?: string): Date | undefined {
    const composed = timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel;
    const parsed = new Date(composed);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private calculateConfidence(input: {
    title?: string;
    startAt?: Date;
    venueName?: string;
    city?: string;
    artistCount: number;
    genreCount: number;
  }): number {
    let score = 0.2;
    if (input.title) score += 0.2;
    if (input.startAt) score += 0.2;
    if (input.venueName) score += 0.15;
    if (input.city) score += 0.1;
    if (input.artistCount) score += 0.1;
    if (input.genreCount) score += 0.05;
    return Number(Math.min(score, 0.99).toFixed(4));
  }

  private looksLikeDateOrTime(line: string): boolean {
    return /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun|\d{1,2}:\d{2}|am|pm|\d{1,2}\/\d{1,2})\b/i.test(
      line,
    );
  }
}
