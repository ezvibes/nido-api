import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentSupervisorService } from './agent-supervisor.service';

describe('AgentSupervisorService', () => {
  let service: AgentSupervisorService;
  let mockConfigValues: Record<string, string>;

  const mockSessionRepo = {
    find: jest.fn(),
  };

  const mockMemoryRepo = {
    create: jest.fn((val) => val),
    save: jest.fn(async (val) => val),
  };

  const mockIngestionJobRepo = {
    find: jest.fn(),
  };

  const mockIngestionCandidateRepo = {
    find: jest.fn(),
  };

  const mockPublicationService = {
    listCandidates: jest.fn(),
    getCandidate: jest.fn(),
    publishCandidate: jest.fn(),
    handleDuplicateDecision: jest.fn(),
  };

  const mockBeehiivService = {
    createDraftFromHtml: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigValues = {
      NODE_ENV: 'development',
      GEMINI_MODEL: 'gemini-3.6-flash',
      GEMINI_EXTRACTION_MODEL: 'gemini-3.8-flash',
      AGENT_OPS_DEMO_FIXTURES: 'false',
    };

    const configService = {
      get: jest.fn((key: string) => mockConfigValues[key]),
    } as unknown as ConfigService;

    mockSessionRepo.find.mockResolvedValue([]);
    mockIngestionJobRepo.find.mockResolvedValue([]);
    mockIngestionCandidateRepo.find.mockResolvedValue([]);
    mockPublicationService.listCandidates.mockResolvedValue({
      total: 0,
      items: [],
    });

    service = new AgentSupervisorService(
      configService,
      mockSessionRepo as any,
      mockMemoryRepo as any,
      mockIngestionJobRepo as any,
      mockIngestionCandidateRepo as any,
      mockPublicationService as any,
      mockBeehiivService as any,
    );
  });

  describe('production safety and fixture guard (#156)', () => {
    it('throws on startup if NODE_ENV=production and AGENT_OPS_DEMO_FIXTURES=true', () => {
      mockConfigValues.NODE_ENV = 'production';
      mockConfigValues.AGENT_OPS_DEMO_FIXTURES = 'true';

      expect(() => service.onModuleInit()).toThrow(
        /Refusing to start in production with AGENT_OPS_DEMO_FIXTURES=true/,
      );
    });

    it('rejects fixture=true query parameter in production with ForbiddenException', async () => {
      mockConfigValues.NODE_ENV = 'production';

      await expect(
        service.getSupervisorStatus({ fixture: 'true' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns deterministic sanitized demo fixtures in non-production when requested', async () => {
      const snapshot = await service.getSupervisorStatus({ fixture: 'true' });

      expect(snapshot.summary.fixtureMode).toBe(true);
      expect(snapshot.agents).toHaveLength(7);
      expect(snapshot.actionItems.length).toBeGreaterThanOrEqual(2);
      expect(snapshot.recentRuns.length).toBeGreaterThanOrEqual(3);

      const firenzeEntry = snapshot.agents.find((a) => a.key === 'firenze');
      const frankfurtEntry = snapshot.agents.find((a) => a.key === 'frankfurt');
      expect(firenzeEntry?.readiness).toBe('available_runtime');
      expect(firenzeEntry?.status).toBe('WAITING_FOR_HUMAN');
      expect(frankfurtEntry?.readiness).toBe('operating_role');
      expect(frankfurtEntry?.status).toBe('IDLE');
    });
  });

  describe('sensitive metadata and chain-of-thought redaction (#153, #155)', () => {
    it('redacts tokens, api keys, signed URLs, emails, and chain-of-thought keys', () => {
      const sanitized = service.sanitizeMetadata({
        apiKey: 'AIzaSySecretKey123',
        nested: {
          authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.secret',
          userEmail: 'operator@example.com',
          signedPoster:
            'https://storage.googleapis.com/nido-bucket/flyer.png?X-Goog-Signature=abc',
          chainOfThought: 'Internal hidden reasoning',
          safeField: 'Durham Fringe Festival',
        },
      }) as Record<string, any>;

      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.nested.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.userEmail).toBe('[REDACTED]');
      expect(sanitized.nested.chainOfThought).toBe('[REDACTED]');
      expect(sanitized.nested.signedPoster).toContain('[REDACTED_SIGNED_URL]');
      expect(sanitized.nested.safeField).toBe('Durham Fringe Festival');
    });

    it('ignores ADK parts marked with thought=true when ingesting session events', async () => {
      service.ingestAdkSessionEvent({
        id: 'session-100',
        appName: 'nido-newsletter-agent',
        userId: 'admin',
        event: {
          content: {
            parts: [
              { text: 'Secret internal reasoning trace', thought: true },
              { text: 'Curated 5 verified Durham concerts.', thought: false },
            ],
          },
        },
      });

      const run = await service.getRunById('session-100');
      const summaries = run.events.map((e) => e.summary);
      expect(summaries).not.toContain('Secret internal reasoning trace');
      expect(summaries).toContain('Curated 5 verified Durham concerts.');
    });
  });

  describe('human-in-the-loop action item resolution', () => {
    it('stages Beehiiv draft and marks Firenze run succeeded on approve_beehiiv_draft', async () => {
      const runId = service.recordAgentRunStart({
        runId: 'firenze-live-1',
        agentKey: 'firenze',
        workflow: 'Weekly Top Picks',
        missionSummary: 'Draft Nov Week 1 Newsletter',
      });

      service.recordAgentWaitingForHuman({
        runId,
        agentKey: 'firenze',
        gateTitle: 'Confirm Beehiiv Draft',
        gateSummary: 'Ready for review',
        newsletterDraft: {
          title: 'Triangle Top Picks',
          dateRangeLabel: 'Nov 1-8',
          concertsCount: 4,
          htmlContent: '<h1>Top Picks</h1>',
        },
      });

      mockBeehiivService.createDraftFromHtml.mockResolvedValue({
        id: 'bh-post-99',
        status: 'draft',
        webUrl: 'https://app.beehiiv.com/posts/bh-post-99',
      });

      const resolved = await service.resolveActionItem(
        `firenze-draft-${runId}`,
        { action: 'approve_beehiiv_draft' },
        42,
      );

      expect(resolved.status).toBe('resolved');
      expect(mockBeehiivService.createDraftFromHtml).toHaveBeenCalledWith({
        title: 'Triangle Top Picks',
        htmlContent: '<h1>Top Picks</h1>',
      });

      const updatedRun = await service.getRunById(runId);
      expect(updatedRun.status).toBe('succeeded');
    });

    it('delegates Venezia candidate duplicate resolution to IngestionPublicationService', async () => {
      mockPublicationService.getCandidate.mockResolvedValue({
        candidate: {
          id: 'cand-123',
          provenance: {
            title: { rawValue: 'Cattyrompus Festival' },
            date: { rawValue: '2026-10-31' },
            time: { rawValue: '20:00' },
            venueExtracted: { rawValue: 'The Pinhook' },
          },
        },
        probableDuplicates: [{ id: 'concert-existing-1', title: 'Cattyrompus' }],
      });
      mockPublicationService.handleDuplicateDecision.mockResolvedValue({
        publishedConcertId: 'concert-existing-1',
        status: 'published',
      });

      const res = await service.resolveActionItem(
        'venezia-candidate-cand-123',
        {
          action: 'merge',
          targetConcertId: 'concert-existing-1',
          reviewDurationMs: 1800,
        },
        7,
      );

      expect(res.status).toBe('resolved');
      expect(mockPublicationService.handleDuplicateDecision).toHaveBeenCalledWith(
        'cand-123',
        expect.objectContaining({
          decision: 'merge',
          targetConcertId: 'concert-existing-1',
        }),
        7,
      );
    });

    it('throws NotFoundException when steering an unknown agent key', async () => {
      await expect(
        service.steerAgent(
          'unknown_city',
          { instruction: 'Focus on jazz shows' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('stages a Frankfurt mission PR, lists it in getActionItems, and approves it', async () => {
      const runId = 'frankfurt-test-run-176';

      // 1. Report mission started
      const startRes = service.recordMissionReport({
        runId,
        issueNumber: 176,
        issueTitle: 'Transition overnight builds to Frankfurt',
        state: 'started',
      });
      expect(startRes.received).toBe(true);

      // 2. Report PR staged
      const stageRes = service.recordMissionReport({
        runId,
        issueNumber: 176,
        issueTitle: 'Transition overnight builds to Frankfurt',
        state: 'pr_staged',
        branchName: 'feat/frankfurt-issue-176',
        prUrl: 'https://github.com/ezvibes/nido-api/pull/177',
        diffStat: '5 files changed, 200 insertions(+)',
        summary: 'Autonomously implemented issue #176',
        rubric: {
          optimizations: ['Opt 1', 'Opt 2', 'Opt 3'],
          concern: 'Concern 1',
        },
      });
      expect(stageRes.received).toBe(true);

      // 3. Inspect action items
      const actionItems = await service.getActionItems({ fixture: 'false' });
      const frankfurtItem = actionItems.find(
        (item) => item.id === `frankfurt-pr-${runId}`,
      );
      expect(frankfurtItem).toBeDefined();
      expect(frankfurtItem?.type).toBe('frankfurt_mission_pr');
      expect(frankfurtItem?.agentKey).toBe('frankfurt');
      expect(frankfurtItem?.missionPr?.prUrl).toBe(
        'https://github.com/ezvibes/nido-api/pull/177',
      );

      // 4. Resolve action item with approve_pr
      const resolveRes = await service.resolveActionItem(
        `frankfurt-pr-${runId}`,
        { action: 'approve_pr' },
        1,
      );
      expect(resolveRes.status).toBe('resolved');
      expect(resolveRes.action).toBe('approve_pr');

      const run = await service.getRunById(runId);
      expect(run.status).toBe('succeeded');
    });
  });
});
