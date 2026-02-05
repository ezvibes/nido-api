export type VibeTag = 'chill' | 'high-energy' | 'jam' | 'indie' | 'dance' | 'acoustic';

export interface EventVenue {
  id: string;
  name: string;
  city: string;
  state: 'NC' | 'SC';
}

export interface EventItem {
  id: string;
  title: string;
  venue: EventVenue;
  startsAt: string;
  imageUrl: string;
  genres: string[];
  vibeTags: VibeTag[];
  description?: string;
  source?: string;
}
