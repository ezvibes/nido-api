export interface IngestionCandidateResponse {
  id: string;
  ingestionJobId: string;
  sourceAssetId: string;
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
  parserVersion?: string;
  parseConfidence?: number;
  parseWarnings?: string[];
  rawExtractedFields?: Record<string, unknown>;
  rawOcrText: string;
  createdAt: Date;
  updatedAt: Date;
}
