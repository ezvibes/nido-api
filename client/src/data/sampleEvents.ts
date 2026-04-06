import type { EventListItem } from '../types/events';
import { mapConcertToEventListItem } from '../types/events';

const daysFromNow = (days: number, hour = 19, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

export const sampleEvents: EventListItem[] = [
  mapConcertToEventListItem(
    {
      id: 'evt-duck',
      title: 'Duck',
      genre: 'rock',
      startsAt: daysFromNow(2, 20, 0),
      venues: [
        {
          name: 'Bowstring Brewyard',
          city: 'Raleigh',
          state: 'NC',
        },
      ],
      artists: [{ name: 'Duck', role: 'headliner', genre: 'rock' }],
      description: 'High-energy local show with a late set and a packed room.',
    },
    {
      posterUrl: 'https://placehold.co/720x900/f2eee5/2f402e?text=Duck',
      sourceLabel: 'Bowstring Brewyard',
      displayTags: ['rock', 'local', 'high energy'],
      demoRank: 10,
    }
  ),
  mapConcertToEventListItem(
    {
      id: 'evt-pine-street-groove',
      title: 'Pine Street Groove',
      genre: 'jam',
      startsAt: daysFromNow(4, 19, 30),
      venues: [{ name: 'The Lincoln Theatre', city: 'Raleigh', state: 'NC' }],
      artists: [{ name: 'Pine Street Groove', role: 'headliner', genre: 'jam' }],
      description: 'Big grooves, two sets, and a crowd that wants to stay out late.',
    },
    {
      posterUrl: 'https://placehold.co/720x900/e7efe2/3a4f39?text=Pine+Street+Groove',
      sourceLabel: 'Venue Flyer',
      displayTags: ['jam', 'danceable', 'triangle'],
      demoRank: 9,
    }
  ),
  mapConcertToEventListItem(
    {
      id: 'evt-midnight-garden-tour',
      title: 'Midnight Garden Tour',
      genre: 'indie',
      startsAt: daysFromNow(6, 20, 0),
      venues: [{ name: "Cat's Cradle", city: 'Chapel Hill', state: 'NC' }],
      artists: [{ name: 'Midnight Garden Tour', role: 'headliner', genre: 'indie' }],
      description: 'A softer indie night with layered guitars and a strong local opener.',
    },
    {
      posterUrl: 'https://placehold.co/720x900/f7efe7/56403b?text=Midnight+Garden+Tour',
      sourceLabel: 'Poster Upload',
      displayTags: ['indie', 'night out', 'carolina'],
      demoRank: 8,
    }
  ),
  mapConcertToEventListItem(
    {
      id: 'evt-carolina-brass-ensemble',
      title: 'Carolina Brass Ensemble',
      genre: 'jazz',
      startsAt: daysFromNow(8, 18, 30),
      venues: [{ name: 'DPAC', city: 'Durham', state: 'NC' }],
      artists: [{ name: 'Carolina Brass Ensemble', role: 'headliner', genre: 'jazz' }],
      description: 'Brass-led jazz with a cleaner seated-room feel.',
    },
    {
      posterUrl: 'https://placehold.co/720x900/e8eef4/2c4157?text=Carolina+Brass',
      sourceLabel: 'DPAC Listing',
      displayTags: ['jazz', 'seated', 'durham'],
      demoRank: 7,
    }
  ),
  mapConcertToEventListItem(
    {
      id: 'evt-riverwalk-sessions',
      title: 'Riverwalk Sessions',
      genre: 'folk',
      startsAt: daysFromNow(11, 19, 0),
      venues: [{ name: 'The Orange Peel', city: 'Asheville', state: 'NC' }],
      artists: [{ name: 'Riverwalk Sessions', role: 'headliner', genre: 'folk' }],
      description: 'A quieter acoustic-forward booking with a packed support lineup.',
    },
    {
      posterUrl: 'https://placehold.co/720x900/f0f1e7/49523d?text=Riverwalk+Sessions',
      sourceLabel: 'Promoter Post',
      displayTags: ['folk', 'acoustic', 'asheville'],
      demoRank: 6,
    }
  ),
  mapConcertToEventListItem(
    {
      id: 'evt-neon-skyline-night',
      title: 'Neon Skyline Night',
      genre: 'electronic',
      startsAt: daysFromNow(14, 21, 0),
      venues: [{ name: 'The Fillmore Charlotte', city: 'Charlotte', state: 'NC' }],
      artists: [{ name: 'Neon Skyline Night', role: 'headliner', genre: 'electronic' }],
      description: 'A bigger room electronic booking with strong production and a late crowd.',
    },
    {
      posterUrl: 'https://placehold.co/720x900/efe7f4/47335a?text=Neon+Skyline',
      sourceLabel: 'Promoter Import',
      displayTags: ['electronic', 'late', 'charlotte'],
      demoRank: 5,
    }
  ),
];
