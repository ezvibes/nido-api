import 'reflect-metadata';
import { Agent, FunctionTool, Runner } from '@google/adk';
import dataSource from '../data-source';
import { StandaloneTypeOrmSessionService } from '../apis/agents/session/typeorm-session.service';
import {
  createStoreMemoryTool,
  createRetrieveMemoryTool,
} from '../apis/agents/tools/memory.tools';
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
  postalCode?: string;
  capacity?: number;
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

export const NC_CURATED_VENUES: CuratedVenue[] = [
  {
    id: 'cats-cradle-carrboro',
    name: "Cat's Cradle",
    aliases: ['cats cradle', 'cradle', 'the cradle', 'cats cradle main stage'],
    address: '300 E Main St',
    city: 'Carrboro',
    region: 'North Carolina',
    postalCode: '27510',
    capacity: 750,
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Legendary Triangle indie room. Deep rock history, intimate sweatbox energy, iconic sound, and pristine scene clout.',
  },
  {
    id: 'cats-cradle-backroom-carrboro',
    name: "Cat's Cradle Backroom",
    aliases: [
      'cats cradle backroom',
      'cats cradle back room',
      'backroom',
      'the back room',
    ],
    address: '300 E Main St',
    city: 'Carrboro',
    region: 'North Carolina',
    postalCode: '27510',
    capacity: 160,
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Intimate side room of Cat’s Cradle showcasing rising indie, punk, and experimental acts with pristine proximity.',
  },
  {
    id: 'bowstring-brewyard-raleigh',
    name: 'Bowstring Brewyard',
    aliases: [
      'bowstring',
      'bowstring raleigh',
      'bowstring pizza and brewyard',
    ],
    address: '1930 Wake Forest Rd',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27608',
    capacity: 500,
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Revitalized barrel-vault warehouse in Raleigh featuring craft beer, artisanal pizza, and open-air live music stages.',
  },
  {
    id: 'bowstring-brewyard-wilmington',
    name: 'Bowstring Brewyard Wilmington',
    aliases: [
      'bowstring wilmington',
      'bowstring bar & live music venue',
      'bowstring bar',
    ],
    address: '1002 N 4th St',
    city: 'Wilmington',
    region: 'North Carolina',
    postalCode: '28401',
    capacity: 400,
    tier: 'Tier-2 Partner',
    vibeSummary:
      'Vibrant live music and craft beer space anchored in Wilmington’s Brooklyn Arts District.',
  },
  {
    id: 'pour-house-raleigh',
    name: 'The Pour House Music Hall',
    aliases: [
      'pour house',
      'the pour house',
      'the pour house music hall & record shop',
      'pour house raleigh',
    ],
    address: '224 S Blount St',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27601',
    capacity: 289,
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Record shop by day, gritty vinyl-soaked live music hall by night. Heartbeat of downtown Raleigh local music.',
  },
  {
    id: 'rubies-on-five-points-durham',
    name: 'Rubies on Five Points',
    aliases: ['rubies', 'rubies on five points', 'rubies durham'],
    address: '347 W Main St',
    city: 'Durham',
    region: 'North Carolina',
    postalCode: '27701',
    capacity: 150,
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Two-story cocktail and live music room at historic Five Points in Durham. Cozy booth seating, vinyl nights, and indie showcases.',
  },
  {
    id: 'the-pinhook-durham',
    name: 'The Pinhook',
    aliases: ['pinhook', 'the pinhook', 'pinhook durham'],
    address: '117 W Main St',
    city: 'Durham',
    region: 'North Carolina',
    postalCode: '27701',
    capacity: 250,
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Beloved queer, community-centered live music venue in downtown Durham, home to indie rock, dance parties, and activist roots.',
  },
  {
    id: 'carolina-theatre-durham',
    name: 'Carolina Theatre',
    aliases: ['carolina theatre', 'carolina theater durham'],
    address: '309 W Morgan St',
    city: 'Durham',
    region: 'North Carolina',
    postalCode: '27701',
    capacity: 1040,
    tier: 'Tier-1 Historic Partner',
    vibeSummary:
      'Magnificent beaux-arts theater in downtown Durham presenting legendary national touring acts, symphonies, and film festivals.',
  },
  {
    id: 'haw-river-ballroom-saxapahaw',
    name: 'Haw River Ballroom',
    aliases: ['haw river', 'haw river ballroom', 'saxapahaw ballroom'],
    address: '1711 Saxapahaw-Bethlehem Church Rd',
    city: 'Saxapahaw',
    region: 'North Carolina',
    postalCode: '27340',
    capacity: 700,
    tier: 'Tier-1 Premier Partner',
    vibeSummary:
      'Restored riverside dye mill in rural Saxapahaw with soaring pine ceilings, world-class acoustic warmth, and magical setting.',
  },
  {
    id: 'koka-booth-amphitheatre-cary',
    name: 'Koka Booth Amphitheatre',
    aliases: ['koka booth', 'booth amphitheatre', 'booth amphitheater'],
    address: '8001 Regent Pkwy',
    city: 'Cary',
    region: 'North Carolina',
    postalCode: '27518',
    capacity: 7000,
    tier: 'Tier-1 Outdoor Partner',
    vibeSummary:
      'Expansive pine-canopied amphitheater beside Symphony Lake in Cary hosting major summer tours and orchestral evenings.',
  },
  {
    id: 'lenovo-center-raleigh',
    name: 'Lenovo Center',
    aliases: ['lenovo center', 'pnc arena', 'rbc center'],
    address: '1400 Edwards Mill Rd',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27607',
    capacity: 19500,
    tier: 'Tier-1 Arena Partner',
    vibeSummary:
      'Triangle’s premier indoor sports and entertainment arena hosting global arena rock tours and major festivals.',
  },
  {
    id: 'motorco-music-hall-durham',
    name: 'Motorco Music Hall',
    aliases: ['motorco', 'motorco music hall', 'motorco durham'],
    address: '723 Rigsbee Ave',
    city: 'Durham',
    region: 'North Carolina',
    postalCode: '27701',
    capacity: 450,
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Former auto dealership converted into Durham Central Park’s signature indie stage, craft bar, and street-food eatery.',
  },
  {
    id: 'neptunes-parlour-raleigh',
    name: 'Neptunes Parlour',
    aliases: ['neptunes', 'neptunes parlour', 'neptunes raleigh'],
    address: '14 W Martin St',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27601',
    capacity: 100,
    tier: 'Tier-1 Basement Partner',
    vibeSummary:
      'Subterranean cocktail lounge and vinyl cellar tucked below Garland in downtown Raleigh, hosting intimate synth, punk, and DJ sets.',
  },
  {
    id: 'red-hat-amphitheater-raleigh',
    name: 'Red Hat Amphitheater',
    aliases: ['red hat', 'red hat amphitheater', 'red hat amphiteatre'],
    address: '500 S McDowell St',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27601',
    capacity: 5990,
    tier: 'Tier-1 Outdoor Partner',
    vibeSummary:
      'Open-air amphitheater with dramatic skyline backdrops in the heart of downtown Raleigh, steps from the convention center.',
  },
  {
    id: 'the-fruit-durham',
    name: 'The Fruit',
    aliases: ['the fruit', 'durham fruit', 'durham fruit and produce'],
    address: '305 S Dillard St',
    city: 'Durham',
    region: 'North Carolina',
    postalCode: '27701',
    capacity: 800,
    tier: 'Tier-1 Warehouse Partner',
    vibeSummary:
      'Sprawling industrial art warehouse and multi-stage space pioneering electronic, avant-garde, and underground dance culture.',
  },
  {
    id: 'the-rialto-raleigh',
    name: 'The Rialto',
    aliases: ['the rialto', 'rialto theatre', 'rialto raleigh'],
    address: '1620 Glenwood Ave',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27608',
    capacity: 450,
    tier: 'Tier-1 Historic Partner',
    vibeSummary:
      'Beloved 1942 Five Points neighborhood cinema and performance hall revived with indie concerts, comedy, and classic films.',
  },
  {
    id: 'the-ritz-raleigh',
    name: 'The Ritz',
    aliases: ['the ritz', 'ritz raleigh'],
    address: '2820 Industrial Dr',
    city: 'Raleigh',
    region: 'North Carolina',
    postalCode: '27609',
    capacity: 1400,
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Raleigh’s high-energy mid-sized concert hall renowned for big touring acts, heavy mosh pits, and crystal-clear high-output sound.',
  },
  {
    id: 'the-underground-charlotte',
    name: 'The Underground',
    aliases: ['the underground', 'underground charlotte', 'fillmore underground'],
    address: '820 Hamilton St',
    city: 'Charlotte',
    region: 'North Carolina',
    postalCode: '28206',
    capacity: 750,
    tier: 'Tier-1 Partner',
    vibeSummary:
      'Electrifying club venue nestled beside The Fillmore Charlotte at the AvidXchange Music Factory.',
  },
  {
    id: 'harrahs-cherokee-center-asheville',
    name: "Harrah's Cherokee Center - Asheville",
    aliases: [
      'harrahs cherokee center',
      'exploreasheville arena',
      'asheville civic center',
      'asheville',
    ],
    address: '87 Haywood St',
    city: 'Asheville',
    region: 'North Carolina',
    postalCode: '28801',
    capacity: 7600,
    tier: 'Tier-1 Arena Partner',
    vibeSummary:
      'Downtown Asheville’s historic arena and auditorium hosting Warren Haynes’ Christmas Jam and premier national touring productions.',
  },
  {
    id: 'center-city-park-greensboro',
    name: 'Center City Park - Downtown Greensboro',
    aliases: [
      'center city park',
      'greensboro nc',
      'downtown greensboro',
      'nc folk festival grounds',
    ],
    address: '200 N Elm St',
    city: 'Greensboro',
    region: 'North Carolina',
    postalCode: '27401',
    capacity: 5000,
    tier: 'Tier-2 Public Space Partner',
    vibeSummary:
      'Vibrant urban greenspace in downtown Greensboro featuring central fountain stages and outdoor festival lawn.',
  },
  {
    id: 'downtown-lansing-historic-district',
    name: 'Downtown Lansing Historic District',
    aliases: ['lansing', 'downtown lansing', 'lansing historic district'],
    address: '114 S Main St',
    city: 'Lansing',
    region: 'North Carolina',
    postalCode: '28643',
    capacity: 500,
    tier: 'Tier-2 Cultural Partner',
    vibeSummary:
      'Charming mountain street venue in Ashe County hosting Appalachian traditional music, roots gatherings, and community showcases.',
  },
  {
    id: 'evening-muse-charlotte',
    name: 'The Evening Muse',
    aliases: ['evening muse', 'the muse', 'muse charlotte'],
    address: '3227 N Davidson St',
    city: 'Charlotte',
    region: 'North Carolina',
    postalCode: '28205',
    capacity: 120,
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
    postalCode: '28205',
    capacity: 956,
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
    postalCode: '28401',
    capacity: 125,
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
    postalCode: '28401',
    capacity: 1200,
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
    postalCode: '28801',
    capacity: 1050,
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
    postalCode: '27601',
    capacity: 825,
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

export const VenueEnrichmentPatchSchema = z.object({
  venueId: z.string().describe('Target venue ID or name to enrich'),
  postalCode: z.string().optional().describe('Verified postal/ZIP code'),
  capacity: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Verified room capacity (must be positive integer)'),
  proposedVerificationState: z
    .enum(['unverified', 'verified', 'flagged', 'canonical'])
    .optional()
    .describe('Proposed verification state after scout inspection'),
  evidenceSource: z
    .string()
    .describe('Authoritative source or documentation URL (no fabricated data)'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0'),
  notes: z.string().optional().describe('Context notes for the human reviewer'),
});

export type VenueEnrichmentPatch = z.infer<typeof VenueEnrichmentPatchSchema>;

export interface VenueEnrichmentProposal {
  proposalId: string;
  venueId: string;
  patch: {
    postalCode: string | null;
    capacity: number | null;
    verificationState: 'unverified' | 'verified' | 'flagged' | 'canonical';
  };
  evidence: {
    source: string;
    confidence: number;
    notes: string | null;
  };
  humanReviewRequired: boolean;
  status: 'proposed_for_review';
  timestamp: string;
}

export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findVenue(query: string): CuratedVenue | null {
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
  console.log(
    `\n  ⚙️  [ADK Tool Executed] lookupCuratedVenue({ name: "${name}" })`,
  );
  const match = findVenue(name);

  if (match) {
    return {
      found: true,
      venueId: match.id,
      name: match.name,
      city: `${match.city}, ${match.region}`,
      address: match.address,
      postalCode: match.postalCode || null,
      capacity: match.capacity || null,
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

export async function handleProposeVenueEnrichment(
  params: VenueEnrichmentPatch,
): Promise<VenueEnrichmentProposal> {
  console.log(
    `\n  ⚙️  [ADK Tool Executed] proposeVenueEnrichment({ venueId: "${params.venueId}", confidence: ${params.confidence} })`,
  );
  return {
    proposalId: `prop-venue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    venueId: params.venueId,
    patch: {
      postalCode: params.postalCode || null,
      capacity: params.capacity || null,
      verificationState: params.proposedVerificationState || 'unverified',
    },
    evidence: {
      source: params.evidenceSource,
      confidence: params.confidence,
      notes: params.notes || null,
    },
    humanReviewRequired: true,
    status: 'proposed_for_review',
    timestamp: new Date().toISOString(),
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
    venueId: z
      .string()
      .describe('The Nido venue ID retrieved from lookupCuratedVenue'),
  }),
  execute: handleGetUpcomingShowsAtVenue,
});

// ADK Tool 3: Propose Non-Destructive Venue Enrichment
export const proposeVenueEnrichmentTool = new FunctionTool({
  name: 'proposeVenueEnrichment',
  description:
    'Propose a non-destructive enrichment patch (postal code, capacity, verification state) for unverified rooms. Human review remains strictly required before catalog mutation.',
  parameters: VenueEnrichmentPatchSchema,
  execute: handleProposeVenueEnrichment,
});

export function createMunchenVenueScoutAgent(dataSource: any) {
  return new Agent({
    name: 'MunchenVenueScout',
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    description:
      'North Carolina live music venue scout that verifies rooms against the Nido catalog, evaluates partner tiers, and proposes non-destructive enrichment patches.',
    instruction: `
  You are Munchen, the EZ Vibes Venue Scout & Vibe Inspector for Nido - North Carolina's indie live music intelligence portal.

  When evaluating a venue request:
  1. Always call \`lookupCuratedVenue\` with the venue name to verify if the room is in Nido's curated catalog.
  2. If verified and a \`venueId\` is returned, call \`getUpcomingShowsAtVenue\` using that \`venueId\`.
  3. If scouting an unverified room or missing metadata (postal code, capacity), you can call \`proposeVenueEnrichment\` with verified evidence and confidence. Munchen NEVER directly mutates the catalog; all proposals require human review.
  4. You also have access to editorial memory. Before scouting, retrieve operator memory ("scout_preferences") to tailor your response.
  5. If the operator gave you new instructions (e.g. "prioritize X"), use \`storeEditorialMemory\` to save it for future sessions.
  6. Synthesize an energetic, soulful assessment of the room, its partner tier, vibe, and upcoming live music schedule.
  `,
    tools: [
      lookupCuratedVenueTool,
      getUpcomingShowsAtVenueTool,
      proposeVenueEnrichmentTool,
      createStoreMemoryTool(dataSource),
      createRetrieveMemoryTool(dataSource),
    ],
  });
}

export function printFormattedSummary(
  targetVenue: string,
  venueRes: any,
  showsRes?: any,
  agentSynthesizedText?: string,
  proposedPatch?: VenueEnrichmentProposal | null,
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
  if (venueRes.postalCode) {
    console.log(` Postal Code         : ${venueRes.postalCode}`);
  }
  if (venueRes.capacity) {
    console.log(` Capacity            : ${venueRes.capacity} guests`);
  }
  console.log(` Partner Tier        : ${venueRes.partnerTier}`);
  console.log(` Vibe Profile        : ${venueRes.vibeSummary}`);
  console.log('------------------------------------------------------');

  if (showsRes && showsRes.upcomingShows && showsRes.upcomingShows.length > 0) {
    console.log(
      ` Upcoming Live Music (${showsRes.upcomingShows.length} Shows):`,
    );
    showsRes.upcomingShows.forEach((show: any, i: number) => {
      console.log(
        `   ${i + 1}. [${show.date}] ${show.title} (${show.genre}) - Headliner: ${show.headliner}`,
      );
    });
  } else {
    console.log(' Upcoming Live Music : No upcoming seeded concerts found.');
  }

  if (proposedPatch) {
    console.log('------------------------------------------------------');
    console.log(' Proposed Non-Destructive Enrichment Patch (Requires Human Review):');
    console.log(`   - Proposal ID            : ${proposedPatch.proposalId}`);
    console.log(`   - Target Venue ID        : ${proposedPatch.venueId}`);
    console.log(
      `   - Postal Code            : ${proposedPatch.patch.postalCode || 'Not provided'}`,
    );
    console.log(
      `   - Capacity               : ${proposedPatch.patch.capacity || 'Not provided'}`,
    );
    console.log(
      `   - Proposed State         : ${proposedPatch.patch.verificationState}`,
    );
    console.log(
      `   - Evidence Source        : ${proposedPatch.evidence.source}`,
    );
    console.log(
      `   - Confidence Score       : ${(proposedPatch.evidence.confidence * 100).toFixed(0)}%`,
    );
    console.log(
      `   - Human Review Status    : ⏳ ${proposedPatch.status}`,
    );
  }

  if (agentSynthesizedText) {
    console.log('------------------------------------------------------');
    console.log(' Soulful Scout Synthesized Assessment:');
    console.log(` "${agentSynthesizedText.trim()}"`);
  }
  console.log('======================================================\n');
}

export async function runAdkScoutWorkflow(
  venueQuery: string,
  sessionId?: string,
) {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  console.log('--- Nido ADK Venue Scout & Vibe Inspector Spike ---');
  console.log(`Searching catalog for: "${venueQuery}"`);

  if (apiKey) {
    try {
      // Initialize DB
      await dataSource.initialize();
      const sessionService = new StandaloneTypeOrmSessionService(dataSource);
      const agent = createMunchenVenueScoutAgent(dataSource);

      const runner = new Runner({
        agent,
        sessionService,
        appName: 'nido-adk-scout',
      });

      let session;
      if (sessionId) {
        session = await sessionService.getSession({
          appName: 'nido-adk-scout',
          userId: 'dev-operator',
          sessionId,
        });
        if (!session) {
          console.log(`Session ${sessionId} not found. Creating new session.`);
          session = await sessionService.createSession({
            appName: 'nido-adk-scout',
            userId: 'dev-operator',
            sessionId,
          });
        } else {
          console.log(`Resuming existing session: ID=${session.id}`);
        }
      } else {
        session = await sessionService.createSession({
          appName: 'nido-adk-scout',
          userId: 'dev-operator',
        });
      }

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
            if ((part as any).functionCall) {
              const fc = (part as any).functionCall;
              console.log(
                `  🤖 [Agent Reasoning] Executing tool: ${fc.name}(${JSON.stringify(fc.args)})`,
              );
            }
            if ((part as any).functionResponse) {
              const fr = (part as any).functionResponse;
              console.log(`  📦 [Tool Result Received] ${fr.name}`);
            }
            if (part.text) {
              lastAgentResponse += part.text;
            }
          }
        }
      }

      if (lastAgentResponse) {
        console.log('\n--- 🔥 Agent Live Synthesis Received ---');
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

  let proposedPatch: VenueEnrichmentProposal | null = null;
  if (!venueRes.found) {
    proposedPatch = await handleProposeVenueEnrichment({
      venueId: venueQuery.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      evidenceSource: 'Local scene scout discovery / partner request',
      confidence: 0.85,
      notes: `Scouted unverified room "${venueQuery}". Pending human verification of address and capacity.`,
      proposedVerificationState: 'unverified',
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
    synthesizedVibe = `Hold up! "${venueQuery}" is an unverified room on our radar. It isn't in Nido's curated NC catalog yet. Munchen has proposed an enrichment patch for review; local scouts must inspect the room before promotion!`;
  }

  printFormattedSummary(
    venueQuery,
    venueRes,
    showsRes,
    synthesizedVibe,
    proposedPatch,
  );
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const cleanArgs = args.filter((arg) => !arg.startsWith('--'));
  const targetVenueArg = cleanArgs[0] || "Cat's Cradle";

  const sessionIdArg = args
    .find((arg) => arg.startsWith('--session-id='))
    ?.split('=')[1];

  runAdkScoutWorkflow(targetVenueArg, sessionIdArg)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error during ADK Venue Scout execution:', error);
      process.exit(1);
    });
}
