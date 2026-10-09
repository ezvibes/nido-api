import { Context } from '@google/adk';
import { NewsletterCatalogService } from '../newsletter-catalog.service';
import { NewsletterCoBillService } from '../newsletter-co-bill.service';
import { BeehiivService } from '../beehiiv.service';
import { TicketUrlVerificationService } from '../ticket-url-verification.service';
import {
  fetchApprovedConcertsInputSchema,
  fetchApprovedConcertsOutputSchema,
} from './contracts/fetch-approved-concerts.schema';
import { NewsletterAgentToolRegistry } from './newsletter-agent-tool-registry.service';
import { FETCH_APPROVED_CONCERTS_TOOL_NAME } from './tools/fetch-approved-concerts.tool';
import { GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME } from './tools/get-co-bill-recommendations.tool';
import { STAGE_BEEHIIV_DRAFT_TOOL_NAME } from './tools/stage-beehiiv-draft.tool';
import { VERIFY_TICKET_URL_TOOL_NAME } from './tools/verify-ticket-url.tool';

// ADK's CommonJS bundle imports lodash-es. Node loads it correctly, while this
// repository's CommonJS Jest runtime needs the equivalent CommonJS entrypoint.
jest.mock('lodash-es', () => {
  const lodash: unknown = jest.requireActual('lodash');
  return lodash;
});

describe('NewsletterAgentToolRegistry', () => {
  const approvedConcert = {
    id: '8da58775-806a-43a4-a526-824c73027106',
    title: 'Dr. Bacon at The Pour House',
    date: 'Friday, Oct 9, 2026',
    venue: 'The Pour House Music Hall (Raleigh, NC)',
    artists: 'Dr. Bacon',
    genre: 'Funk',
    description: 'A hometown funk show.',
    isTopPick: true,
    topPickScore: 0.9,
    isHighlightArtist: true,
    isPartnerArtist: true,
    source: 'Nido Concert Database' as const,
  };

  const findApprovedConcerts = jest.fn();
  const catalogService = {
    findApprovedConcerts,
  } as unknown as NewsletterCatalogService;
  const verificationService = {
    verifyUrls: jest.fn(),
  } as unknown as TicketUrlVerificationService;
  const beehiivService = {
    createDraftFromHtml: jest.fn(),
  } as unknown as BeehiivService;
  const coBillService = {
    findRecommendations: jest.fn(),
  } as unknown as NewsletterCoBillService;

  const createRegistry = () =>
    new NewsletterAgentToolRegistry(
      catalogService,
      coBillService,
      verificationService,
      beehiivService,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes only operational tools and protects the registry array', () => {
    const registry = createRegistry();

    const firstRead = registry.getTools();
    const declaration = firstRead[0]._getDeclaration();
    const parameters = declaration.parameters as unknown as {
      type: string;
      required: string[];
      properties: Record<string, Record<string, unknown>>;
    };
    firstRead.length = 0;

    expect(registry.getTools().map((tool) => tool.name)).toEqual([
      FETCH_APPROVED_CONCERTS_TOOL_NAME,
      GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME,
      VERIFY_TICKET_URL_TOOL_NAME,
      STAGE_BEEHIIV_DRAFT_TOOL_NAME,
    ]);
    expect(declaration.name).toBe(FETCH_APPROVED_CONCERTS_TOOL_NAME);
    expect(parameters.type).toBe('OBJECT');
    expect(parameters.required).toEqual(['startDate', 'endDate']);
    expect(parameters.properties.startDate).toMatchObject({
      type: 'STRING',
      format: 'date-time',
    });
    expect(parameters.properties.limit).toMatchObject({
      type: 'INTEGER',
      minimum: 1,
      maximum: 100,
      default: 20,
    });
  });

  it('delegates validated, defaulted arguments to the catalog service', async () => {
    findApprovedConcerts.mockResolvedValue([approvedConcert]);
    const [tool] = createRegistry().getTools();

    const result = await tool.runAsync({
      args: {
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-11T23:59:59.999Z',
        cities: ['Raleigh'],
      },
      toolContext: {} as Context,
    });

    expect(findApprovedConcerts).toHaveBeenCalledWith({
      start: new Date('2026-10-09T00:00:00.000Z'),
      end: new Date('2026-10-11T23:59:59.999Z'),
      region: 'NC',
      cities: ['Raleigh'],
      genres: undefined,
      venues: undefined,
      limit: 20,
    });
    expect(result).toEqual({ concerts: [approvedConcert], count: 1 });
  });

  it('rejects unknown or invalid model arguments before service execution', async () => {
    const [tool] = createRegistry().getTools();

    await expect(
      tool.runAsync({
        args: {
          startDate: 'next Friday',
          endDate: '2026-10-11T23:59:59.999Z',
          includePendingConcerts: true,
        },
        toolContext: {} as Context,
      }),
    ).rejects.toThrow(`Error in tool '${FETCH_APPROVED_CONCERTS_TOOL_NAME}'`);
    expect(findApprovedConcerts).not.toHaveBeenCalled();
  });
});

describe('fetchApprovedConcerts schemas', () => {
  it('applies bounded defaults and rejects extra properties', () => {
    expect(
      fetchApprovedConcertsInputSchema.parse({
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-11T23:59:59.999Z',
      }),
    ).toMatchObject({ region: 'NC', limit: 20 });

    expect(
      fetchApprovedConcertsInputSchema.safeParse({
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-11T23:59:59.999Z',
        limit: 101,
      }).success,
    ).toBe(false);
    expect(
      fetchApprovedConcertsInputSchema.safeParse({
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2027-01-03T00:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      fetchApprovedConcertsInputSchema.safeParse({
        startDate: '2026-10-09T00:00:00.000Z',
        endDate: '2026-10-11T23:59:59.999Z',
        unknown: true,
      }).success,
    ).toBe(false);
  });

  it('rejects malformed tool output before it returns to the agent', () => {
    expect(
      fetchApprovedConcertsOutputSchema.safeParse({
        concerts: [{ id: 'not-a-uuid' }],
        count: 1,
      }).success,
    ).toBe(false);
  });
});
