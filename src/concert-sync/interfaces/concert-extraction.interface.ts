import type { Artist } from '../../apis/concerts/dto/artist.dto';
import type { Venue } from '../../apis/concerts/dto/venue.dto';

export interface ConcertExtractionResult {
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string | null;
  description?: string | null;
  artists: Artist[];
  venues: Venue[];
  confidence: number;
  needsGuidance: boolean;
  guidanceQuestions: string[];
  extractionSource?: 'gemini' | 'heuristic';
  fallbackReason?: string;
  providerStatus?: number;
  providerMessage?: string;
  model?: string;
}
