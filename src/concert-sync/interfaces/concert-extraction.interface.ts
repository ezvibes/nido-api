export interface ExtractedArtist {
  name: string;
  role?: string;
  genre?: string;
}

export interface ExtractedVenue {
  name: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ConcertExtractionResult {
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  artists: ExtractedArtist[];
  venues: ExtractedVenue[];
  confidence: number;
  needsGuidance: boolean;
  guidanceQuestions: string[];
  extractionSource?: 'gemini' | 'heuristic';
  fallbackReason?: string;
  providerStatus?: number;
  providerMessage?: string;
  model?: string;
}
