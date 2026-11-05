import type {
  ExtractedVenue,
  ExtractedPerformer,
  ExtractedDate,
  PosterExtractionResult,
} from '../../../contracts';

export type { ExtractedVenue, ExtractedPerformer, ExtractedDate };
export type ExtractionResult = PosterExtractionResult;

export interface ExtractionHints {
  bandId?: string;
  bandName?: string;
  venueId?: string;
  venueName?: string;
  date?: string;
  genre?: string;
  city?: string;
  state?: string;
}

export interface IExtractionAdapter {
  extract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
    imageBuffer?: Buffer,
  ): Promise<ExtractionResult[]>;
  getModelName?(): string;
}
