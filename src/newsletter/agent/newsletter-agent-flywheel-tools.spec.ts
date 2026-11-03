import { Context } from '@google/adk';
import { createAuditNewsletterDistributionTool } from './tools/audit-newsletter-distribution.tool';
import { createHarvestLineupActsTool } from './tools/harvest-lineup-acts.tool';
import { createEvaluatePostFeedbackTool } from './tools/evaluate-post-feedback.tool';
import { NewsletterDistributionAuditorService } from '../newsletter-distribution-auditor.service';
import { NewsletterLineupHarvesterService } from '../newsletter-lineup-harvester.service';
import { NewsletterFeedbackLoopService } from '../newsletter-feedback-loop.service';
import { BeehiivService } from '../beehiiv.service';
import { NewsletterAgentToolRegistry } from './newsletter-agent-tool-registry.service';

describe('Newsletter Agent Flywheel ADK Tools', () => {
  let mockAuditor: Partial<jest.Mocked<NewsletterDistributionAuditorService>>;
  let mockHarvester: Partial<jest.Mocked<NewsletterLineupHarvesterService>>;
  let mockFeedback: Partial<jest.Mocked<NewsletterFeedbackLoopService>>;
  let mockBeehiiv: Partial<jest.Mocked<BeehiivService>>;

  beforeEach(() => {
    mockAuditor = {
      auditDistribution: jest.fn().mockReturnValue({
        totalEvents: 2,
        isBalanced: true,
        underrepresentedRegions: [],
        underrepresentedGenres: [],
        alerts: [],
        scoutingRecommendations: [],
      }),
    };

    mockHarvester = {
      extractSupportActs: jest.fn().mockReturnValue({
        headliner: 'Big Something',
        supportingActs: ['The Fritz'],
      }),
      parseFestivalLineup: jest.fn().mockReturnValue(['Bela Fleck']),
      processDiscoveredArtists: jest.fn().mockResolvedValue({
        totalExtracted: 2,
        newDiscoveriesCount: 1,
        candidates: [],
        summary: 'Extracted 2',
      }),
    };

    mockFeedback = {
      diffDraftVsPublished: jest.fn().mockReturnValue({
        postId: 'p1',
        draftWordCount: 100,
        publishedWordCount: 90,
        retainedShows: ['Big Something'],
        addedShows: [],
        removedShows: [],
        voiceCalibrations: [],
        summary: 'Diff ok',
      }),
      calculateEngagementAffinities: jest.fn().mockReturnValue({
        postId: 'p1',
        openRate: 0.45,
        clickRate: 0.1,
        totalClicks: 20,
        ticketLinkClicks: 10,
        spotifyClicks: 5,
        entityAffinities: [],
        topPerformers: [],
        curationAdvice: ['Prioritize tickets'],
      }),
    };

    mockBeehiiv = {
      getPost: jest.fn().mockResolvedValue({
        id: 'p1',
        content: { free: { web: '<p>Published</p>' } },
      } as any),
      getPostStats: jest.fn().mockResolvedValue({
        id: 'p1',
        open_rate: 0.45,
        click_rate: 0.1,
        total_clicks: 20,
        links: [],
      }),
    };
  });

  it('createAuditNewsletterDistributionTool executes correctly', async () => {
    const tool = createAuditNewsletterDistributionTool(
      mockAuditor as unknown as NewsletterDistributionAuditorService,
    );
    expect(tool.name).toBe('auditNewsletterDistribution');
    const result: any = await tool.runAsync({
      args: {
        events: [
          {
            artistName: 'Big Something',
            venueName: 'Lincoln Theatre',
            city: 'Raleigh',
          },
        ],
      },
      toolContext: {} as Context,
    });

    expect(result.totalEvents).toBe(2);
    expect(result.isBalanced).toBe(true);
  });

  it('createHarvestLineupActsTool executes correctly for support acts', async () => {
    const tool = createHarvestLineupActsTool(
      mockHarvester as unknown as NewsletterLineupHarvesterService,
    );
    expect(tool.name).toBe('harvestLineupActs');
    const result: any = await tool.runAsync({
      args: {
        sourceType: 'support_act',
        rawText: 'Big Something w/ The Fritz',
        autoCreateInDb: false,
      },
      toolContext: {} as Context,
    });

    expect(result.totalExtracted).toBe(2);
    expect(result.newDiscoveriesCount).toBe(1);
  });

  it('createEvaluatePostFeedbackTool executes correctly', async () => {
    const tool = createEvaluatePostFeedbackTool(
      mockBeehiiv as unknown as BeehiivService,
      mockFeedback as unknown as NewsletterFeedbackLoopService,
    );
    expect(tool.name).toBe('evaluatePostFeedback');
    const result: any = await tool.runAsync({
      args: {
        postId: 'p1',
        draftContent: 'Draft markdown',
      },
      toolContext: {} as Context,
    });

    expect(result.postId).toBe('p1');
    expect(result.openRate).toBe(0.45);
    expect(result.retainedShows).toContain('Big Something');
  });

  it('NewsletterAgentToolRegistry registers all flywheel tools when provided', () => {
    const mockCatalog: any = {};
    const mockCoBill: any = {};
    const mockVerify: any = {};

    const registry = new NewsletterAgentToolRegistry(
      mockCatalog,
      mockCoBill,
      mockVerify,
      mockBeehiiv as unknown as BeehiivService,
      undefined,
      mockAuditor as unknown as NewsletterDistributionAuditorService,
      mockHarvester as unknown as NewsletterLineupHarvesterService,
      mockFeedback as unknown as NewsletterFeedbackLoopService,
    );

    const tools = registry.getTools();
    const toolNames = tools.map((t) => t.name);

    expect(toolNames).toContain('fetchApprovedConcerts');
    expect(toolNames).toContain('getCoBillRecommendations');
    expect(toolNames).toContain('verifyTicketUrl');
    expect(toolNames).toContain('stageBeehiivDraft');
    expect(toolNames).toContain('auditNewsletterDistribution');
    expect(toolNames).toContain('harvestLineupActs');
    expect(toolNames).toContain('evaluatePostFeedback');
    expect(tools).toHaveLength(7);
  });
});
