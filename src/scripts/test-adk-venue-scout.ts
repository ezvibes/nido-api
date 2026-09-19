import 'reflect-metadata';
import { Agent, FunctionTool, Runner, InMemorySessionService } from '@google/adk';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

// Curated NC Venues dataset
export interface CuratedVenue {
  id: string;
  name: string;
  aliases: string[];
  address: string;
  city: string;
  region: string;
  tier: string;
  vibeSummary: string;
}

export interface ScheduledShow {
  venueId: string;
  title: string;
  date: string;
  genre: string;
  headliner: string;
}

const NC_CURATED_VENUES: CuratedVenue[] = [
  {
    id: 'cats-cradle-carrboro',
    name: "Cat's Cradle",
    aliases: ['cats cradle', 'cradle', 'the cradle', 'cats cradle main stage'],
    address: '300 E Main St',
    city: 'Carrboro',
    region: 'North Carolina',
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Legendary Triangle indie room. Deep rock history, intimate sweatbox energy, iconic sound, and pristine scene clout.',
  },
  {
    id: 'pour-house-raleigh',
    name: 'The Pour House',
    aliases: ['pour house', 'the pour house music hall', 'pour house raleigh'],
    address: '224 S Blount St',
    city: 'Raleigh',
    region: 'North Carolina',
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Record shop by day, gritty vinyl-soaked live music hall by night. Heartbeat of downtown Raleigh local music.',
  },
  {
    id: 'evening-muse-charlotte',
    name: 'The Evening Muse',
    aliases: ['evening muse', 'the muse', 'muse charlotte'],
    address: '3227 N Davidson St',
    city: 'Charlotte',
    region: 'North Carolina',
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Acoustic sanctuary in NoDa. Listening-room perfection, warm mahogany lighting, and impeccable artist intimacy.',
  },
  {
    id: 'neighborhood-theatre-charlotte',
    name: 'Neighborhood Theatre',
    aliases: ['neighborhood theatre', 'neighborhood theater', 'noda theatre'],
    address: '511 E 36th St',
    city: 'Charlotte',
    region: 'North Carolina',
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Historic movie-house turned powerhouse concert hall in the heart of NoDa arts district.',
  },
  {
    id: 'bourgie-nights-wilmington',
    name: 'Bourgie Nights',
    aliases: ['bourgie nights', 'bourgie', 'bourgie wilmington'],
    address: '127 N Front St',
    city: 'Wilmington',
    region: 'North Carolina',
    tier: 'Tier-2 Partner',
    vibeSummary:
      'Chic, sultry, velvet-draped listening lounge in historic downtown Wilmington.',
  },
  {
    id: 'greenfield-lake-wilmington',
    name: 'Greenfield Lake Amphitheater',
    aliases: [
      'greenfield lake amphitheater',
      'greenfield lake',
      'greenfield amphitheater',
    ],
    address: '1941 Amphitheatre Dr',
    city: 'Wilmington',
    region: 'North Carolina',
    tier: 'Tier-1 Outdoor Partner',
    vibeSummary:
      'Lush lakeside outdoor amphitheater framed by Spanish moss and coastal evening breezes.',
  },
  {
    id: 'orange-peel-asheville',
    name: 'The Orange Peel',
    aliases: ['orange peel', 'the orange peel', 'orange peel asheville'],
    address: '101 Biltmore Ave',
    city: 'Asheville',
    region: 'North Carolina',
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'World-famous Asheville music temple with springy hardwood floors and unmatched mountain town soul.',
  },
  {
    id: 'lincoln-theatre-raleigh',
    name: 'Lincoln Theatre',
    aliases: ['lincoln theatre', 'lincoln theater', 'lincoln raleigh'],
    address: '126 E Cabarrus St',
    city: 'Raleigh',
    region: 'North Carolina',
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Spacious indoor theater host to heavy riffs, jam bands, and vibrant Raleigh crowds.',
  },
];

const UPCOMING_SHOWS: ScheduledShow[] = [
  {
    venueId: 'cats-cradle-carrboro',
    title: 'The Mountain Goats Live in Carrboro',
    date: '2025-04-12',
    genre: 'Indie Rock',
    headliner: 'The Mountain Goats',
  },
  {
    venueId: 'cats-cradle-carrboro',
    title: 'Wednesday & Hotline TNT Co-Headline',
    date: '2025-04-18',
    genre: 'Alt Rock / Shoegaze',
    headliner: 'Wednesday',
  },
  {
    venueId: 'pour-house-raleigh',
    title: 'Local Vinyl & Groove Showcase',
    date: '2025-04-10',
    genre: 'Funk / Soul',
    headliner: 'The Funk Apostles',
  },
  {
    venueId: 'evening-muse-charlotte',
    title: 'Songwriters in the Round',
    date: '2025-04-15',
    genre: 'Acoustic / Folk',
    headliner: 'Maya de Vitry',
  },
  {
    venueId: 'orange-peel-asheville',
    title: 'Papadosio & SunSquabi Jam Night',
    date: '2025-04-22',
    genre: 'Jam / Electronic',
    headliner: 'Papadosio',
  },
];

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findVenue(query: string): CuratedVenue | null {
  const normQuery = normalizeName(query);
  if (!normQuery) return null;

  for (const venue of NC_CURATED_VENUES) {
    const normName = normalizeName(venue.name);
    if (normName === normQuery) return venue;
    if (venue.aliases.some((alias) => normalizeName(alias) === normQuery)) {
      return venue;
    }
  }

  // Partial substring match
  for (const venue of NC_CURATED_VENUES) {
    const normName = normalizeName(venue.name);
    if (normName.includes(normQuery) || normQuery.includes(normName)) {
      return venue;
    }
    for (const alias of venue.aliases) {
      const normAlias = normalizeName(alias);
      if (normAlias.includes(normQuery) || normQuery.includes(normAlias)) {
        return venue;
      }
    }
  }

  return null;
}

// Handler functions for tools
export async function handleLookupCuratedVenue({ name }: { name: string }) {
  console.log(`\n  ⚙️  [ADK Tool Executed] lookupCuratedVenue({ name: "${name}" })`);
  const match = findVenue(name);

  if (match) {
    return {
      found: true,
      venueId: match.id,
      name: match.name,
      city: `${match.city}, ${match.region}`,
      address: match.address,
      partnerTier: match.tier,
      verifiedStatus: 'VERIFIED',
      vibeSummary: match.vibeSummary,
    };
  }

  return {
    found: false,
    searchQuery: name,
    verifiedStatus: 'UNVERIFIED',
    partnerTier: 'Unverified / Community Discovery',
    vibeSummary:
      'Unverified room outside Nido curated catalog. Requires manual vibe inspection and local scout input.',
  };
}

export async function handleGetUpcomingShowsAtVenue({
  venueId,
}: {
  venueId: string;
}) {
  console.log(
    `  ⚙️  [ADK Tool Executed] getUpcomingShowsAtVenue({ venueId: "${venueId}" })`,
  );
  const shows = UPCOMING_SHOWS.filter((show) => show.venueId === venueId);
  return {
    venueId,
    showCount: shows.length,
    upcomingShows: shows.map((s) => ({
      title: s.title,
      date: s.date,
      genre: s.genre,
      headliner: s.headliner,
    })),
  };
}

// ADK Tool 1: Catalog Venue Verification
export const lookupCuratedVenueTool = new FunctionTool({
  name: 'lookupCuratedVenue',
  description:
    "Lookup a venue from Nido's curated North Carolina venue catalog to verify partner tier, status, and room metadata.",
  parameters: z.object({
    name: z.string().describe('The name or alias of the venue to look up'),
  }),
  execute: handleLookupCuratedVenue,
});

// ADK Tool 2: Upcoming Shows Lookup
export const getUpcomingShowsAtVenueTool = new FunctionTool({
  name: 'getUpcomingShowsAtVenue',
  description:
    'Get upcoming scheduled concerts and live music performances for a verified venue ID.',
  parameters: z.object({
    venueId: z.string().describe('The Nido venue ID retrieved from lookupCuratedVenue'),
  }),
  execute: handleGetUpcomingShowsAtVenue,
});

export const ezVibesScoutAgent = new Agent({
  name: 'EZVibesSceneScout',
  model: 'gemini-2.5-flash',
  instruction: `
You are EZ Vibes Venue Scout & Vibe Inspector for Nido - North Carolina's indie live music intelligence portal.

When evaluating a venue request:
1. Always call \`lookupCuratedVenue\` with the venue name to verify if the room is in Nido's curated catalog.
2. If verified and a \`venueId\` is returned, call \`getUpcomingShowsAtVenue\` using that \`venueId\`.
3. Synthesize an energetic, soulful assessment of the room, its partner tier, vibe, and upcoming live music schedule.
`,
  tools: [lookupCuratedVenueTool, getUpcomingShowsAtVenueTool],
});

function printFormattedSummary(
  targetVenue: string,
  venueRes: any,
  showsRes?: any,
  agentSynthesizedText?: string,
) {
  console.log('\n======================================================');
  console.log('       🔥 NIDO ADK SCENE SCOUT REPORT 🔥');
  console.log('======================================================');
  console.log(` Target Venue Search : "${targetVenue}"`);
  console.log(
    ` Verification Status : ${venueRes.verifiedStatus === 'VERIFIED' ? '✅ VERIFIED CATALOG ROOM' : '⚠️ UNVERIFIED / UNKNOWN ROOM'}`,
  );
  console.log(` Official Name       : ${venueRes.name || targetVenue}`);
  console.log(` Location            : ${venueRes.city || 'Unknown'}`);
  console.log(` Partner Tier        : ${venueRes.partnerTier}`);
  console.log(` Vibe Profile        : ${venueRes.vibeSummary}`);
  console.log('------------------------------------------------------');

  if (showsRes && showsRes.upcomingShows && showsRes.upcomingShows.length > 0) {
    console.log(` Upcoming Live Music (${showsRes.upcomingShows.length} Shows):`);
    showsRes.upcomingShows.forEach((show: any, i: number) => {
      console.log(
        `   ${i + 1}. [${show.date}] ${show.title} (${show.genre}) - Headliner: ${show.headliner}`,
      );
    });
  } else {
    console.log(' Upcoming Live Music : No upcoming seeded concerts found.');
  }

  if (agentSynthesizedText) {
    console.log('------------------------------------------------------');
    console.log(' Soulful Scout Synthesized Assessment:');
    console.log(` "${agentSynthesizedText.trim()}"`);
  }
  console.log('======================================================\n');
}

async function runAdkScoutWorkflow(venueQuery: string) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  console.log('--- Nido ADK Venue Scout & Vibe Inspector Spike ---');
  console.log(`Searching catalog for: "${venueQuery}"`);

  if (apiKey) {
    try {
      const sessionService = new InMemorySessionService();
      const runner = new Runner({
        agent: ezVibesScoutAgent,
        sessionService,
        appName: 'nido-adk-scout',
      });

      const session = await sessionService.createSession({
        appName: 'nido-adk-scout',
        userId: 'dev-operator',
      });

      console.log(`ADK Session initialized: ID=${session.id}`);
      console.log('Invoking Agent runAsync...\n');

      let lastAgentResponse = '';
      for await (const event of runner.runAsync({
        userId: 'dev-operator',
        sessionId: session.id,
        newMessage: {
          role: 'user',
          parts: [{ text: `Inspect and scout venue: "${venueQuery}"` }],
        },
      })) {
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if (part.text) {
              lastAgentResponse += part.text;
            }
          }
        }
      }

      if (lastAgentResponse) {
        console.log('\n--- Agent Live Output Received ---');
        console.log(lastAgentResponse);
        return;
      }
    } catch (err: any) {
      console.log(
        `\n⚠️  Live Agent API Call Notice: (${err?.message || err}). Falling back to local tool runner execution demonstration.`,
      );
    }
  } else {
    console.log(
      '\nℹ️  GEMINI_API_KEY not set. Running ADK Tool orchestration dry-run simulation.',
    );
  }

  // Fallback / Dry-Run Tool Orchestration Simulation using the tool handler logic
  const venueRes = await handleLookupCuratedVenue({ name: venueQuery });
  let showsRes: any = null;

  if (venueRes.found && venueRes.venueId) {
    showsRes = await handleGetUpcomingShowsAtVenue({
      venueId: venueRes.venueId,
    });
  }

  let synthesizedVibe = '';
  if (venueRes.found) {
    synthesizedVibe = `Yo! ${venueRes.name} in ${venueRes.city} is locked into Nido's catalog as a ${venueRes.partnerTier}. ${venueRes.vibeSummary} ${
      showsRes && showsRes.upcomingShows.length > 0
        ? `We got ${showsRes.upcomingShows.length} hot upcoming shows queued up!`
        : 'Keep your eyes on this room for upcoming live drops.'
    }`;
  } else {
    synthesizedVibe = `Hold up! "${venueQuery}" is an unverified room on our radar. It isn't in Nido's curated NC catalog yet. Time for local scouts to drop in, test the acoustics, and get this space verified!`;
  }

  printFormattedSummary(venueQuery, venueRes, showsRes, synthesizedVibe);
}

const targetVenueArg = process.argv[2] || "Cat's Cradle";
runAdkScoutWorkflow(targetVenueArg).catch((error) => {
  console.error('Fatal error during ADK Venue Scout execution:', error);
  process.exit(1);
});
