import { Context } from '@google/adk';
import { BeehiivService } from '../beehiiv.service';
import { TicketUrlVerificationService } from '../ticket-url-verification.service';
import {
  stageBeehiivDraftInputSchema,
  stageBeehiivDraftOutputSchema,
} from './contracts/stage-beehiiv-draft.schema';
import {
  verifyTicketUrlInputSchema,
  verifyTicketUrlOutputSchema,
} from './contracts/verify-ticket-url.schema';
import {
  createStageBeehiivDraftTool,
  STAGE_BEEHIIV_DRAFT_TOOL_NAME,
} from './tools/stage-beehiiv-draft.tool';
import {
  createVerifyTicketUrlTool,
  VERIFY_TICKET_URL_TOOL_NAME,
} from './tools/verify-ticket-url.tool';

jest.mock('lodash-es', () => {
  const lodash: unknown = jest.requireActual('lodash');
  return lodash;
});

describe('newsletter external ADK tools', () => {
  const verifyUrls = jest.fn();
  const verificationService = {
    verifyUrls,
  } as unknown as TicketUrlVerificationService;
  const createDraftFromHtml = jest.fn();
  const beehiivService = {
    createDraftFromHtml,
  } as unknown as BeehiivService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('verifies a bounded batch and summarizes classifications', async () => {
    verifyUrls.mockResolvedValue([
      {
        url: 'https://tickets.example.com/show',
        status: 'reachable',
        statusCode: 200,
        method: 'HEAD',
      },
      {
        url: 'https://tickets.example.com/missing',
        status: 'unreachable',
        statusCode: 404,
        method: 'HEAD',
      },
    ]);
    const tool = createVerifyTicketUrlTool(verificationService);

    const result = await tool.runAsync({
      args: {
        urls: [
          'https://tickets.example.com/show',
          'https://tickets.example.com/missing',
        ],
      },
      toolContext: {} as Context,
    });

    expect(tool.name).toBe(VERIFY_TICKET_URL_TOOL_NAME);
    expect(verifyUrls).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      results: [
        {
          url: 'https://tickets.example.com/show',
          status: 'reachable',
          statusCode: 200,
          method: 'HEAD',
        },
        {
          url: 'https://tickets.example.com/missing',
          status: 'unreachable',
          statusCode: 404,
          method: 'HEAD',
        },
      ],
      summary: { reachable: 1, unreachable: 1, blocked: 0, indeterminate: 0 },
    });
  });

  it('rejects unsafe URL schemes before the verifier runs', async () => {
    const tool = createVerifyTicketUrlTool(verificationService);

    await expect(
      tool.runAsync({
        args: { urls: ['file:///etc/passwd'] },
        toolContext: {} as Context,
      }),
    ).rejects.toThrow(`Error in tool '${VERIFY_TICKET_URL_TOOL_NAME}'`);
    expect(verifyUrls).not.toHaveBeenCalled();
  });

  it('requires operator confirmation before staging a Beehiiv draft', async () => {
    const tool = createStageBeehiivDraftTool(beehiivService);
    const requestConfirmation = jest.fn();

    const result = await tool.runAsync({
      args: {
        title: 'EZ Vibes Weekly Top Picks',
        htmlContent: '<p>Draft copy</p>',
        status: 'draft',
      },
      toolContext: {
        requestConfirmation,
        actions: {},
      } as unknown as Context,
    });

    expect(result).toEqual({
      error: 'This tool call requires confirmation, please approve or reject.',
    });
    expect(requestConfirmation).toHaveBeenCalledTimes(1);
    expect(createDraftFromHtml).not.toHaveBeenCalled();
    await expect(tool.checkRequireConfirmation({})).resolves.toBe(true);
  });

  it('stages only a validated draft after confirmation', async () => {
    createDraftFromHtml.mockResolvedValue({
      id: 'post_123',
      title: 'EZ Vibes Weekly Top Picks',
      status: 'draft',
      web_url: 'https://www.beehiiv.com/posts/post_123',
    });
    const tool = createStageBeehiivDraftTool(beehiivService);

    const result = await tool.runAsync({
      args: {
        title: 'EZ Vibes Weekly Top Picks',
        htmlContent: '<p>Draft copy</p>',
        postTemplateId: 'template_123',
        status: 'draft',
      },
      toolContext: {
        toolConfirmation: { confirmed: true },
      } as unknown as Context,
    });

    expect(tool.name).toBe(STAGE_BEEHIIV_DRAFT_TOOL_NAME);
    expect(createDraftFromHtml).toHaveBeenCalledWith({
      title: 'EZ Vibes Weekly Top Picks',
      htmlContent: '<p>Draft copy</p>',
      postTemplateId: 'template_123',
    });
    expect(result).toEqual(
      expect.objectContaining({ id: 'post_123', status: 'draft' }),
    );
  });

  it('rejects publish authority and malformed provider output', async () => {
    const tool = createStageBeehiivDraftTool(beehiivService);

    await expect(
      tool.runAsync({
        args: {
          title: 'Publish this',
          htmlContent: '<p>Unsafe</p>',
          status: 'confirmed',
        },
        toolContext: {} as Context,
      }),
    ).rejects.toThrow(`Error in tool '${STAGE_BEEHIIV_DRAFT_TOOL_NAME}'`);
    expect(createDraftFromHtml).not.toHaveBeenCalled();

    createDraftFromHtml.mockResolvedValue({
      id: 'post_123',
      title: 'Unexpected result',
      status: 'published',
    });
    await expect(
      tool.runAsync({
        args: {
          title: 'Expected draft',
          htmlContent: '<p>Draft copy</p>',
          status: 'draft',
        },
        toolContext: {
          toolConfirmation: { confirmed: true },
        } as unknown as Context,
      }),
    ).rejects.toThrow(`Error in tool '${STAGE_BEEHIIV_DRAFT_TOOL_NAME}'`);
  });
});

describe('newsletter external tool schemas', () => {
  it('keeps URL verification batches bounded and strict', () => {
    expect(
      verifyTicketUrlInputSchema.safeParse({
        urls: Array.from(
          { length: 11 },
          (_, index) => `https://example.com/${index}`,
        ),
      }).success,
    ).toBe(false);
    expect(
      verifyTicketUrlOutputSchema.safeParse({
        results: [],
        summary: { reachable: 0, unreachable: 0, blocked: 0, indeterminate: 0 },
        ignored: true,
      }).success,
    ).toBe(false);
  });

  it('keeps Beehiiv staging draft-only and validates provider output', () => {
    expect(
      stageBeehiivDraftInputSchema.safeParse({
        title: 'Top Picks',
        htmlContent: '<p>Copy</p>',
        status: 'published',
      }).success,
    ).toBe(false);
    expect(
      stageBeehiivDraftOutputSchema.safeParse({
        id: 'post_123',
        title: 'Top Picks',
        status: 'published',
      }).success,
    ).toBe(false);
  });
});
