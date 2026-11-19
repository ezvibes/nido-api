import { z } from 'zod';
import { CanonicalBandSchema } from './band.contract';
import { CanonicalVenueSchema } from './venue.contract';

/**
 * NIDO-002.5: Minimal Read-Only MCP and AI-Assistant Discovery Integration Contract.
 *
 * This contract defines the bounded candidate tool definitions, parameter schemas,
 * publication gates, rate-limit policies, and sanitized output models for read-only
 * assistant discovery integrations.
 */

export const MCP_DISCOVERY_POLICY = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX_REQUESTS: 60,
} as const;

export const MCP_CANDIDATE_TOOL_NAMES = [
  'search_concerts',
  'get_concert_details',
  'get_venue_schedule',
  'get_artist_shows',
] as const;

export type McpCandidateToolName = (typeof MCP_CANDIDATE_TOOL_NAMES)[number];

/* -------------------------------------------------------------------------- */
/*                               Input Schemas                                */
/* -------------------------------------------------------------------------- */

export const SearchConcertsMcpToolInputSchema = z.object({
  query: z
    .string()
    .trim()
    .max(100, 'Search query cannot exceed 100 characters')
    .optional()
    .describe(
      'Text query searching across concert title, genre, venue, or lineup bands',
    ),
  genre: z
    .string()
    .trim()
    .max(50, 'Genre filter cannot exceed 50 characters')
    .optional()
    .describe('Exact genre tag match (e.g. "Indie Rock", "Jazz")'),
  city: z
    .string()
    .trim()
    .max(100, 'City filter cannot exceed 100 characters')
    .optional()
    .describe('Venue city name or slug (e.g. "raleigh", "carrboro")'),
  region: z
    .string()
    .trim()
    .max(50, 'Region filter cannot exceed 50 characters')
    .optional()
    .describe('Venue state abbreviation or region (e.g. "NC")'),
  startsAfter: z
    .string()
    .datetime({ message: 'startsAfter must be a valid ISO-8601 string' })
    .optional()
    .describe('Filter concerts starting on or after this ISO-8601 timestamp'),
  startsBefore: z
    .string()
    .datetime({ message: 'startsBefore must be a valid ISO-8601 string' })
    .optional()
    .describe('Filter concerts starting on or before this ISO-8601 timestamp'),
  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1)
    .describe('1-based page index (default: 1)'),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(
      MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE,
      `Limit capped at ${MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE}`,
    )
    .default(MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE)
    .describe(
      `Maximum concerts to return (default: ${MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE}, max: ${MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE})`,
    ),
});

export type SearchConcertsMcpToolInput = z.infer<
  typeof SearchConcertsMcpToolInputSchema
>;

export const GetConcertDetailsMcpToolInputSchema = z.object({
  concertId: z
    .string()
    .uuid('concertId must be a valid UUID')
    .describe('Unique UUID of the target concert'),
});

export type GetConcertDetailsMcpToolInput = z.infer<
  typeof GetConcertDetailsMcpToolInputSchema
>;

export const GetVenueScheduleMcpToolInputSchema = z.object({
  venueId: z
    .string()
    .uuid('venueId must be a valid UUID')
    .describe('Unique UUID of the target venue'),
  startsAfter: z
    .string()
    .datetime({ message: 'startsAfter must be a valid ISO-8601 string' })
    .optional()
    .describe('Optional ISO-8601 timestamp bound for upcoming shows'),
  startsBefore: z
    .string()
    .datetime({ message: 'startsBefore must be a valid ISO-8601 string' })
    .optional()
    .describe('Optional ISO-8601 timestamp bound for schedule window'),
  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(
      MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE,
      `Limit capped at ${MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE}`,
    )
    .default(MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE)
    .describe(
      `Maximum schedule events to return (default: ${MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE}, max: ${MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE})`,
    ),
});

export type GetVenueScheduleMcpToolInput = z.infer<
  typeof GetVenueScheduleMcpToolInputSchema
>;

export const GetArtistShowsMcpToolInputSchema = z
  .object({
    bandId: z
      .string()
      .uuid('bandId must be a valid UUID')
      .optional()
      .describe('Unique UUID of the target artist/band'),
    bandSlug: z
      .string()
      .trim()
      .min(1, 'bandSlug cannot be empty')
      .max(100, 'bandSlug cannot exceed 100 characters')
      .optional()
      .describe(
        'Canonical URL slug of the target artist/band (e.g. "wednesday", "sylvan-esso")',
      ),
    startsAfter: z
      .string()
      .datetime({ message: 'startsAfter must be a valid ISO-8601 string' })
      .optional()
      .describe('Optional ISO-8601 timestamp bound for upcoming shows'),
    limit: z
      .number()
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(
        MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE,
        `Limit capped at ${MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE}`,
      )
      .default(MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE)
      .describe(
        `Maximum shows to return (default: ${MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE}, max: ${MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE})`,
      ),
  })
  .refine((data) => data.bandId !== undefined || data.bandSlug !== undefined, {
    message: 'Either bandId or bandSlug must be provided',
    path: ['bandId'],
  });

export type GetArtistShowsMcpToolInput = z.infer<
  typeof GetArtistShowsMcpToolInputSchema
>;

/* -------------------------------------------------------------------------- */
/*                               Output Schemas                               */
/* -------------------------------------------------------------------------- */

export const McpConcertSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  startsAt: z.string(),
  venue: z.object({
    id: z.string().uuid(),
    name: z.string(),
    city: z.string(),
    region: z.string(),
  }),
  headliner: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  genre: z.string().nullable().optional(),
  ticketUrl: z.string().nullable().optional(),
  ageRestriction: z.string().nullable().optional(),
});

export type McpConcertSummary = z.infer<typeof McpConcertSummarySchema>;

export const McpConcertDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  startsAt: z.string(),
  doorsAt: z.string().nullable().optional(),
  venue: CanonicalVenueSchema,
  lineup: z.array(
    z.object({
      band: CanonicalBandSchema,
      role: z.string().nullable().optional(),
      order: z.number().int().nullable().optional(),
    }),
  ),
  ticketUrl: z.string().nullable().optional(),
  priceText: z.string().nullable().optional(),
  ageRestriction: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  publicUrl: z.string().url(),
  updatedAt: z.string(),
});

export type McpConcertDetail = z.infer<typeof McpConcertDetailSchema>;

export const McpToolRegistryItemSchema = z.object({
  name: z.enum(MCP_CANDIDATE_TOOL_NAMES),
  description: z.string(),
  readOnly: z.literal(true),
  inputSchema: z.record(z.string(), z.any()),
});

export type McpToolRegistryItem = z.infer<typeof McpToolRegistryItemSchema>;

/* -------------------------------------------------------------------------- */
/*                     Candidate Tool Definitions Metadata                     */
/* -------------------------------------------------------------------------- */

export const MCP_DISCOVERY_CANDIDATE_TOOLS: readonly McpToolRegistryItem[] = [
  {
    name: 'search_concerts',
    description:
      'Search live music concerts in Nido across North Carolina venues, artists, and dates. Returns paginated approved active shows.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text search query for title, venue, genre, or band',
        },
        genre: { type: 'string', description: 'Musical genre filter' },
        city: {
          type: 'string',
          description: 'City name or slug (e.g. "raleigh")',
        },
        region: {
          type: 'string',
          description: 'Region or state abbreviation (e.g. "NC")',
        },
        startsAfter: {
          type: 'string',
          format: 'date-time',
          description: 'Earliest start timestamp (ISO-8601)',
        },
        startsBefore: {
          type: 'string',
          format: 'date-time',
          description: 'Latest start timestamp (ISO-8601)',
        },
        page: { type: 'integer', minimum: 1, default: 1 },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE,
          default: MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE,
        },
      },
    },
  },
  {
    name: 'get_concert_details',
    description:
      'Retrieve canonical details for a specific concert, including complete lineup, performance roles, venue location, and ticket link.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      required: ['concertId'],
      properties: {
        concertId: {
          type: 'string',
          format: 'uuid',
          description: 'Canonical UUID of the concert',
        },
      },
    },
  },
  {
    name: 'get_venue_schedule',
    description:
      'Retrieve upcoming approved concerts scheduled at a specific venue.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      required: ['venueId'],
      properties: {
        venueId: {
          type: 'string',
          format: 'uuid',
          description: 'Canonical UUID of the venue',
        },
        startsAfter: {
          type: 'string',
          format: 'date-time',
          description: 'Optional earliest start timestamp (ISO-8601)',
        },
        startsBefore: {
          type: 'string',
          format: 'date-time',
          description: 'Optional latest start timestamp (ISO-8601)',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE,
          default: MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE,
        },
      },
    },
  },
  {
    name: 'get_artist_shows',
    description:
      'Retrieve upcoming approved concerts for a specific artist or band across all participating venues.',
    readOnly: true,
    inputSchema: {
      type: 'object',
      properties: {
        bandId: {
          type: 'string',
          format: 'uuid',
          description: 'Canonical UUID of the artist/band',
        },
        bandSlug: {
          type: 'string',
          description: 'URL slug of the artist/band (e.g. "wednesday")',
        },
        startsAfter: {
          type: 'string',
          format: 'date-time',
          description: 'Optional earliest start timestamp (ISO-8601)',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: MCP_DISCOVERY_POLICY.MAX_PAGE_SIZE,
          default: MCP_DISCOVERY_POLICY.DEFAULT_PAGE_SIZE,
        },
      },
    },
  },
] as const;

/* -------------------------------------------------------------------------- */
/*              Publication Gate & Non-Leakage Sanitization                   */
/* -------------------------------------------------------------------------- */

export class McpPublicationGateViolationError extends Error {
  constructor(
    message = 'Concert does not satisfy public MCP publication gate (catalogStatus must be "active" and isAdminApproved must be true)',
  ) {
    super(message);
    this.name = 'McpPublicationGateViolationError';
  }
}

/**
 * Asserts that a concert record satisfies the strict public visibility invariant:
 * catalogStatus === 'active' AND isAdminApproved === true.
 * Throws McpPublicationGateViolationError if violated.
 */
export function assertMcpPublicationGate(concert: {
  catalogStatus?: string | null;
  isAdminApproved?: boolean | null;
}): void {
  if (concert.catalogStatus !== 'active' || concert.isAdminApproved !== true) {
    throw new McpPublicationGateViolationError();
  }
}

/**
 * Sanitizes raw concert entities/responses for public MCP output.
 * Guarantees zero leakage of:
 * - adminApprovedByUserId
 * - internal calendar sync coordinates (calendarId, calendarEventId)
 * - internal guidance flags (needsGuidance)
 * - editorial locks (editorialLockedAt)
 * - upload/ingestion worker identifiers
 */
export function sanitizeMcpConcertSummary(
  raw: Record<string, any>,
): McpConcertSummary {
  assertMcpPublicationGate(raw);

  const venue = raw.venue ?? {};
  const startsAt =
    raw.startsAt instanceof Date
      ? raw.startsAt.toISOString()
      : typeof raw.startsAt === 'string'
        ? raw.startsAt
        : `${raw.localEventDate || ''}T${raw.startTime || '00:00:00'}Z`;

  const headliner =
    raw.lineup && Array.isArray(raw.lineup) && raw.lineup.length > 0
      ? {
          id: raw.lineup[0].band?.id || raw.lineup[0].id,
          name: raw.lineup[0].band?.name || raw.lineup[0].name,
        }
      : null;

  return McpConcertSummarySchema.parse({
    id: raw.id,
    title: raw.title,
    startsAt,
    venue: {
      id: venue.id ?? raw.venueId,
      name: venue.name ?? raw.venueName ?? '',
      city: venue.city ?? raw.city ?? '',
      region: venue.region ?? raw.region ?? raw.state ?? '',
    },
    headliner,
    genre: raw.genre ?? null,
    ticketUrl: raw.ticketUrl ?? null,
    ageRestriction: raw.ageRestriction ?? null,
  });
}
