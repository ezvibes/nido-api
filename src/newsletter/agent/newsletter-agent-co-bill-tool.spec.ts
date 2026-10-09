import { Context } from '@google/adk';
import { NewsletterCoBillService } from '../newsletter-co-bill.service';
import {
  getCoBillRecommendationsInputSchema,
  getCoBillRecommendationsOutputSchema,
} from './contracts/get-co-bill-recommendations.schema';
import {
  createGetCoBillRecommendationsTool,
  GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME,
} from './tools/get-co-bill-recommendations.tool';

jest.mock('lodash-es', () => {
  const lodash: unknown = jest.requireActual('lodash');
  return lodash;
});

describe('getCoBillRecommendations ADK tool', () => {
  const anchorBandId = '11111111-1111-4111-8111-111111111111';
  const candidateBandId = '22222222-2222-4222-8222-222222222222';
  const upcomingConcertId = '33333333-3333-4333-8333-333333333333';
  const findRecommendations = jest.fn();
  const coBillService = {
    findRecommendations,
  } as unknown as NewsletterCoBillService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates defaulted arguments and returns validated evidence', async () => {
    const recommendation = {
      candidateBand: { id: candidateBandId, name: 'Discovery Band' },
      connection: {
        anchorBandId,
        anchorBandName: 'Anchor Band',
        sharedBillCount: 2,
      },
      upcomingConcert: {
        id: upcomingConcertId,
        title: 'Discovery Band Live',
        startsAt: '2026-11-08T01:00:00.000Z',
      },
    };
    findRecommendations.mockResolvedValue([recommendation]);
    const tool = createGetCoBillRecommendationsTool(coBillService);

    const result = await tool.runAsync({
      args: {
        anchorBandIds: [anchorBandId],
        targetDateRange: {
          start: '2026-11-01T00:00:00.000Z',
          end: '2026-11-30T23:59:59.999Z',
        },
      },
      toolContext: {} as Context,
    });

    expect(tool.name).toBe(GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME);
    expect(findRecommendations).toHaveBeenCalledWith({
      anchorBandIds: [anchorBandId],
      targetStart: new Date('2026-11-01T00:00:00.000Z'),
      targetEnd: new Date('2026-11-30T23:59:59.999Z'),
      preferredVenues: undefined,
      historicalLookbackMonths: 60,
      minimumSharedBills: 1,
      limit: 20,
    });
    expect(result).toEqual({ recommendations: [recommendation], count: 1 });
  });

  it('rejects invalid and unknown model arguments before service execution', async () => {
    const tool = createGetCoBillRecommendationsTool(coBillService);

    await expect(
      tool.runAsync({
        args: {
          anchorBandIds: ['not-a-uuid'],
          targetDateRange: {
            start: 'next week',
            end: '2026-11-30T23:59:59.999Z',
          },
          useVectorSearch: true,
        },
        toolContext: {} as Context,
      }),
    ).rejects.toThrow(
      `Error in tool '${GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME}'`,
    );
    expect(findRecommendations).not.toHaveBeenCalled();
  });

  it('rejects malformed service output before returning it to the agent', async () => {
    findRecommendations.mockResolvedValue([
      {
        candidateBand: { id: 'not-a-uuid', name: 'Invalid Band' },
      },
    ]);
    const tool = createGetCoBillRecommendationsTool(coBillService);

    await expect(
      tool.runAsync({
        args: {
          anchorBandIds: [anchorBandId],
          targetDateRange: {
            start: '2026-11-01T00:00:00.000Z',
            end: '2026-11-30T23:59:59.999Z',
          },
        },
        toolContext: {} as Context,
      }),
    ).rejects.toThrow(
      `Error in tool '${GET_CO_BILL_RECOMMENDATIONS_TOOL_NAME}'`,
    );
  });
});

describe('getCoBillRecommendations schemas', () => {
  it('applies bounded defaults and rejects unknown properties', () => {
    expect(
      getCoBillRecommendationsInputSchema.parse({
        anchorBandIds: ['11111111-1111-4111-8111-111111111111'],
        targetDateRange: {
          start: '2026-11-01T00:00:00.000Z',
          end: '2026-11-30T23:59:59.999Z',
        },
      }),
    ).toMatchObject({
      historicalLookbackMonths: 60,
      minimumSharedBills: 1,
      limit: 20,
    });
    expect(
      getCoBillRecommendationsInputSchema.safeParse({
        anchorBandIds: ['11111111-1111-4111-8111-111111111111'],
        targetDateRange: {
          start: '2026-11-01T00:00:00.000Z',
          end: '2026-11-30T23:59:59.999Z',
        },
        unknown: true,
      }).success,
    ).toBe(false);
    expect(
      getCoBillRecommendationsInputSchema.safeParse({
        anchorBandIds: ['11111111-1111-4111-8111-111111111111'],
        targetDateRange: {
          start: '2026-11-30T23:59:59.999Z',
          end: '2026-11-01T00:00:00.000Z',
        },
      }).success,
    ).toBe(false);
  });

  it('requires complete recommendation evidence', () => {
    expect(
      getCoBillRecommendationsOutputSchema.safeParse({
        recommendations: [{ candidateBand: { id: 'invalid', name: 'Band' } }],
        count: 1,
      }).success,
    ).toBe(false);
  });
});
