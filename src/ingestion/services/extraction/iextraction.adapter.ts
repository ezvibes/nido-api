export interface ExtractedVenue {
  name: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface ExtractedPerformer {
  name: string;
  isHeadliner: boolean;
  setTime?: string;
  stage?: string;
}

export interface ExtractedDate {
  date: string; // YYYY-MM-DD
  doorsTime?: string; // HH:MM:SS
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
  primaryGenre?: string;
  genres?: string[];
  isFestival?: boolean;
  ticketPrice?: string;
  ageRestriction?: string;
  promotersAndSponsors?: string[];
  ticketUrlOrInfo?: string;
  rawOcrText?: string;
}

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
