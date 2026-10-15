import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import {
  FindManyOptions,
  FindOperator,
  FindOptionsWhere,
  Repository,
} from 'typeorm';
import {
  Concert,
  ConcertCatalogStatus,
} from '../../src/apis/concerts/entities/concert.entity';
import {
  NewsletterRequestParams,
  NewsletterService,
} from '../../src/newsletter/newsletter.service';
import { NewsletterCatalogService } from '../../src/newsletter/newsletter-catalog.service';
import { BeehiivService } from '../../src/newsletter/beehiiv.service';
import { NewsletterAgentToolRegistry } from '../../src/newsletter/agent/newsletter-agent-tool-registry.service';
import { TypeOrmSessionService } from '../../src/apis/agents/session/typeorm-session.service';
import {
  createMockBeehiivTransport,
  MOCK_BEEHIIV_ENDPOINT,
} from './mocks/mock-beehiiv';

const mockRunAsync = jest.fn();
jest.mock('@google/adk', () => {
  const actual = jest.requireActual('@google/adk');
  return {
    ...actual,
    Runner: jest.fn().mockImplementation(() => {
      return {
        runAsync: mockRunAsync,
      };
    }),
  };
});

const mockGenerateContent = jest.fn<
  Promise<{ response: { text: () => string } }>,
  [string]
>();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

interface Scenario {
  id: string;
  catalogIds: string[];
  request: NewsletterRequestParams;
  expectedConcertIds: string[];
  expectedDisplayDates?: string[];
  modelResponse?: string;
  providerError?: string;
  expectedOutcome: 'draft' | 'error';
  knownLinkStatuses?: Array<{ url: string; status: number }>;
}

const fixtureDirectory = path.join(__dirname, 'fixtures/newsletter');
const catalog = (
  JSON.parse(
    readFileSync(path.join(fixtureDirectory, 'catalog.json'), 'utf8'),
  ) as Array<Omit<Concert, 'startsAt'> & { startsAt: string }>
).map((row) => ({ ...row, startsAt: new Date(row.startsAt) }) as Concert);
const scenarios: Scenario[] = readdirSync(fixtureDirectory)
  .filter((name) => name.endsWith('.json') && name !== 'catalog.json')
  .sort()
  .map(
    (name) =>
      JSON.parse(
        readFileSync(path.join(fixtureDirectory, name), 'utf8'),
      ) as Scenario,
  );

function sqlPatternToRegex(pattern: string): RegExp {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '\\' && index + 1 < pattern.length) {
      index += 1;
      source += pattern[index].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (character === '%') {
      source += '.*';
    } else if (character === '_') {
      source += '.';
    } else {
      source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`${source}$`, 'i');
}

function matchesOperator(actual: unknown, operator: FindOperator<unknown>) {
  switch (operator.type) {
    case 'between': {
      const [start, end] = operator.value as Date[];
      return actual instanceof Date && actual >= start && actual <= end;
    }
    case 'ilike':
      return sqlPatternToRegex(String(operator.value)).test(
        String(actual ?? ''),
      );
    case 'in':
      return (operator.value as unknown[]).includes(actual);
    case 'not':
      if (!operator.child) throw new Error('Expected nested NOT operator.');
      return !matchesOperator(actual, operator.child);
    case 'or':
      return (operator.value as FindOperator<unknown>[]).some((candidate) =>
        matchesOperator(actual, candidate),
      );
    default:
      throw new Error(`Unsupported fixture FindOperator: ${operator.type}`);
  }
}

function matchesWhere(
  row: Record<string, unknown>,
  where: FindOptionsWhere<Concert>,
): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof FindOperator) {
      return matchesOperator(actual, expected);
    }
    if (
      expected &&
      typeof expected === 'object' &&
      !(expected instanceof Date)
    ) {
      return (
        Boolean(actual) &&
        matchesWhere(
          actual as Record<string, unknown>,
          expected as FindOptionsWhere<Concert>,
        )
      );
    }
    return actual === expected;
  });
}

function setup(
  catalogIds: string[],
  configOverrides: Record<string, string> = {},
) {
  const rows = catalog.filter((row) => catalogIds.includes(row.id));
  // Apply the query's actual predicates; omitted approval/status filters must leak
  // fixture rows and fail expectations rather than be hidden by the repository fake.
  const find = jest.fn((options: FindManyOptions<Concert>) => {
    const where = options.where as FindOptionsWhere<Concert>;
    const matched = rows
      .filter((row) =>
        matchesWhere(row as unknown as Record<string, unknown>, where),
      )
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return Promise.resolve(
      options.take === undefined ? matched : matched.slice(0, options.take),
    );
  });
  const configValues: Record<string, string | undefined> = {
    GEMINI_API_KEY: 'fixture-only-not-a-secret',
    GEMINI_MODEL: 'mock-gemini',
    BEEHIIV_API_KEY: 'fixture-only-not-a-secret',
    BEEHIIV_PUBLICATION_ID: 'fixture-publication',
    ...configOverrides,
  };
  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
  const transport = createMockBeehiivTransport();
  jest.spyOn(globalThis, 'fetch').mockImplementation(transport.fetchMock);
  const catalogService = new NewsletterCatalogService({
    find,
  } as unknown as Repository<Concert>);

  const beehiivService = new BeehiivService(config);

  const toolRegistry = {
    getTools: jest.fn().mockReturnValue([]),
  } as unknown as NewsletterAgentToolRegistry;

  const sessionService = {
    createSession: jest.fn().mockResolvedValue({ id: 'fixture-session' }),
    getSession: jest.fn().mockResolvedValue({
      id: 'fixture-session',
      appName: 'nido-newsletter-agent',
      userId: 'admin',
      events: [],
      state: {},
    }),
    appendEvent: jest.fn(),
  } as unknown as TypeOrmSessionService;

  const service = new NewsletterService(
    catalogService,
    config,
    beehiivService,
    toolRegistry,
    sessionService,
  );
  return { service, find, transport };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  mockGenerateContent.mockReset();
});

describe('Offline newsletter fixture replay', () => {
  test.each(scenarios)(
    '[$id] source contract, prompt and draft transport',
    async (fixture) => {
      const { service, find, transport } = setup(fixture.catalogIds);
      const preview = await service.previewNewsletterSources(fixture.request);
      expect(preview.concerts.map((row) => row.id)).toEqual(
        fixture.expectedConcertIds,
      );
      expect(preview.totalCount).toBe(fixture.expectedConcertIds.length);
      expect(preview.calendarEvents).toEqual([]);
      expect(mockRunAsync).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      if (fixture.expectedDisplayDates) {
        expect(preview.concerts.map((row) => row.date)).toEqual(
          fixture.expectedDisplayDates,
        );
      }

      expect(fixture.expectedOutcome).toBe(
        fixture.providerError ? 'error' : 'draft',
      );
      if (fixture.providerError) {
        mockRunAsync.mockImplementationOnce(async function* () {
          throw new Error(fixture.providerError);
        });
        await expect(
          service.generateNewsletter(fixture.request),
        ).rejects.toThrow(fixture.providerError);
        expect(transport.drafts).toEqual([]);
      } else {
        mockRunAsync.mockImplementationOnce(async function* () {
          yield {
            content: {
              parts: [{ text: fixture.modelResponse! }],
            },
          };
        });
        const result = await service.generateNewsletter(fixture.request);
        expect(result.newsletterDraft).toBe(fixture.modelResponse);
        expect(result.concertsCount).toBe(preview.totalCount);
        if (fixture.request.autoPushToBeehiiv) {
          expect(result.beehiivDraft).toMatchObject({
            id: 'fixture-draft-1',
            status: 'draft',
          });
          expect(transport.drafts).toHaveLength(1);
          expect(transport.drafts[0]).toEqual({
            title: `EZ Vibes Top Picks: ${preview.dateRangeLabel}`,
            status: 'draft',
            blocks: [
              {
                type: 'html',
                html: service.convertMarkdownToHtml(fixture.modelResponse!),
              },
            ],
          });
          expect(transport.drafts[0].blocks[0].html).toContain('<h1>');
        } else {
          expect(result.beehiivDraft).toBeUndefined();
          expect(transport.drafts).toEqual([]);
        }
      }

      expect(mockRunAsync).toHaveBeenCalledTimes(1);

      // Removed exact check of the old big raw-data dump prompt, since we aren't doing that anymore.
      const expectedRequests =
        fixture.request.autoPushToBeehiiv && !fixture.providerError ? 1 : 0;
      expect(globalThis.fetch).toHaveBeenCalledTimes(expectedRequests);
      if (expectedRequests) {
        expect(globalThis.fetch).toHaveBeenCalledWith(
          MOCK_BEEHIIV_ENDPOINT,
          expect.objectContaining({ method: 'POST' }),
        );
      }
    },
  );

  test('empty model output fails without staging a draft', async () => {
    const { service, transport } = setup(['fixture-funk']);
    mockRunAsync.mockImplementationOnce(async function* () {
      yield {
        content: {
          parts: [{ text: '' }],
        },
      };
    });
    await expect(
      service.generateNewsletter({
        ...scenarios[0].request,
        autoPushToBeehiiv: true,
      }),
    ).rejects.toThrow('empty newsletter draft');
    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    expect(transport.drafts).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('missing model credentials fail before retrieving or sending data', async () => {
    const { service, find } = setup(['fixture-funk'], { GEMINI_API_KEY: '' });
    await expect(
      service.generateNewsletter(scenarios[0].request),
    ).rejects.toThrow('GEMINI_API_KEY');
    expect(find).not.toHaveBeenCalled();
    expect(mockRunAsync).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('Beehiiv rejects staging errors without retrying or publishing', async () => {
    const { service, transport } = setup(['fixture-funk']);
    mockRunAsync.mockImplementationOnce(async function* () {
      yield {
        content: {
          parts: [{ text: '# Fixture draft' }],
        },
      };
    });
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('Fixture unauthorized', { status: 401 }),
      );
    await expect(
      service.generateNewsletter({
        ...scenarios[0].request,
        autoPushToBeehiiv: true,
      }),
    ).rejects.toThrow('Beehiiv API error (401)');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [endpoint, init] = jest.mocked(globalThis.fetch).mock.calls[0];
    expect(endpoint).toBe(MOCK_BEEHIIV_ENDPOINT);
    expect(typeof init?.body).toBe('string');
    const payload = JSON.parse(init?.body as string) as { status: string };
    expect(payload.status).toBe('draft');
    expect(transport.drafts).toEqual([]);
    expect(mockRunAsync).toHaveBeenCalledTimes(1);
  });
});
