export interface ExtractedVenue {
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface ExtractedPerformer {
  name: string;
  isHeadliner: boolean;
}

export interface ExtractedDate {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM:SS
  timezone?: string;
  warning?: string;
}

export interface ExtractionResult {
  title?: string;
  venue?: ExtractedVenue;
  performers?: ExtractedPerformer[];
  dates?: ExtractedDate[];
  genre?: string;
}

export interface ExtractionHints {
  bandId?: string;
  venueId?: string;
  date?: string;
  genre?: string;
}

export interface IExtractionAdapter {
  extract(
    imageUrl: string,
    mimeType: string,
    hints?: ExtractionHints,
    imageBuffer?: Buffer,
  ): Promise<ExtractionResult[]>;
}
