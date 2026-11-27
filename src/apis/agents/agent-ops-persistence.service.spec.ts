import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  AgentUsageTotalsSchema,
  createUnavailableAgentUsageTotals,
} from '../../contracts';
import {
  AgentOpsPersistenceService,
  sanitizeAgentMetadata,
} from './agent-ops-persistence.service';
import { AgentApprovalRequest } from './entities/agent-approval-request.entity';
import { AgentRunEvent } from './entities/agent-run-event.entity';
import { AgentRun } from './entities/agent-run.entity';

interface FindOneOptionsMock {
  where?: { id?: string; runId?: string };
  relations?: string[];
}

interface FindManyOptionsMock {
  where?: Partial<AgentRun>;
  skip?: number;
  take?: number;
}

describe('AgentOpsPersistenceService', () => {
  let service: AgentOpsPersistenceService;
  let runsStore: Map<string, AgentRun>;
  let eventsStore: AgentRunEvent[];
  let approvalsStore: Map<string, AgentApprovalRequest>;
  let idCounter: number;

  const nextUuid = () => {
    idCounter += 1;
    return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
  };

  const mockRunRepo = {
    create: jest.fn((data: Partial<AgentRun>) => ({
      ...data,
    })),
    save: jest.fn((run: AgentRun) => {
      const now = new Date();
      const persisted: AgentRun = {
        ...run,
        id: run.id ?? nextUuid(),
        createdAt: run.createdAt ?? now,
        updatedAt: now,
      };
      runsStore.set(persisted.id, persisted);
      return Promise.resolve(persisted);
    }),
    findOne: jest.fn((options: FindOneOptionsMock) => {
      const id = options?.where?.id;
      const run = id ? (runsStore.get(id) ?? null) : null;
      if (!run) {
        return Promise.resolve(null);
      }
      if (options?.relations?.length) {
        const clone: AgentRun = { ...run };
        if (options.relations.includes('events')) {
          clone.events = eventsStore
            .filter((e) => e.runId === run.id)
            .sort((a, b) => a.sequence - b.sequence);
        }
        if (options.relations.includes('approvalRequests')) {
          clone.approvalRequests = Array.from(approvalsStore.values())
            .filter((a) => a.runId === run.id)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return Promise.resolve(clone);
      }
      return Promise.resolve({ ...run });
    }),
    find: jest.fn((options: FindManyOptionsMock) => {
      const where = options?.where ?? {};
      let results = Array.from(runsStore.values()).filter((run) => {
        if (where.agentKey && run.agentKey !== where.agentKey) return false;
        if (where.status && run.status !== where.status) return false;
        if (where.missionKey && run.missionKey !== where.missionKey)
          return false;
        if (where.workflowId && run.workflowId !== where.workflowId)
          return false;
        if (where.parentRunId && run.parentRunId !== where.parentRunId)
          return false;
        return true;
      });
      results = results.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      const skip = options?.skip ?? 0;
      const take = options?.take ?? results.length;
      return Promise.resolve(results.slice(skip, skip + take));
    }),
  };

  const mockEventRepo = {
    create: jest.fn((data: Partial<AgentRunEvent>) => ({
      ...data,
    })),
    save: jest.fn((event: AgentRunEvent) => {
      const persisted: AgentRunEvent = {
        ...event,
        id: event.id ?? nextUuid(),
        createdAt: event.createdAt ?? new Date(),
      };
      eventsStore.push(persisted);
      return Promise.resolve(persisted);
    }),
    findOne: jest.fn((options: FindOneOptionsMock) => {
      const runId = options?.where?.runId;
      const matching = eventsStore
        .filter((e) => e.runId === runId)
        .sort((a, b) => b.sequence - a.sequence);
      return Promise.resolve(matching[0] ?? null);
    }),
  };

  const mockApprovalRepo = {
    create: jest.fn((data: Partial<AgentApprovalRequest>) => ({
      ...data,
    })),
    save: jest.fn((approval: AgentApprovalRequest) => {
      const now = new Date();
      const persisted: AgentApprovalRequest = {
        ...approval,
        id: approval.id ?? nextUuid(),
        createdAt: approval.createdAt ?? now,
        updatedAt: now,
      };
      approvalsStore.set(persisted.id, persisted);
      return Promise.resolve(persisted);
    }),
    findOne: jest.fn((options: FindOneOptionsMock) => {
      const id = options?.where?.id;
      const found = id ? (approvalsStore.get(id) ?? null) : null;
      return Promise.resolve(found ? { ...found } : null);
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    runsStore = new Map();
    eventsStore = [];
    approvalsStore = new Map();
    idCounter = 0;

    service = new AgentOpsPersistenceService(
      mockRunRepo as unknown as Repository<AgentRun>,
      mockEventRepo as unknown as Repository<AgentRunEvent>,
      mockApprovalRepo as unknown as Repository<AgentApprovalRequest>,
    );
  });

  describe('run lifecycle and state transitions', () => {
    it('supports queued -> running -> waiting_for_approval -> succeeded', async () => {
      const run = await service.createRun({
        agentKey: 'firenze',
        workflowId: 'tps2-weekly',
        missionKey: 'NIDO-003',
        initiatedByUserId: 7,
        inputSummary: { weekOf: '2026-11-30' },
      });

      expect(run.status).toBe('queued');
      expect(run.startedAt).toBeNull();
      expect(run.completedAt).toBeNull();

      const running = await service.transitionRunStatus(run.id, 'running');
      expect(running.status).toBe('running');
      expect(running.startedAt).toBeInstanceOf(Date);
      expect(running.completedAt).toBeNull();

      const waiting = await service.transitionRunStatus(
        run.id,
        'waiting_for_approval',
      );
      expect(waiting.status).toBe('waiting_for_approval');
      expect(waiting.completedAt).toBeNull();

      const succeeded = await service.transitionRunStatus(run.id, 'succeeded', {
        outputSummary: { draftId: 'post_123' },
        externalEvidenceRef: 'beehiiv:post_123',
      });
      expect(succeeded.status).toBe('succeeded');
      expect(succeeded.completedAt).toBeInstanceOf(Date);
      expect(succeeded.outputSummary).toEqual({ draftId: 'post_123' });
      expect(succeeded.externalEvidenceRef).toBe('beehiiv:post_123');
    });

    it('rejects invalid transitions such as queued -> waiting_for_approval or queued -> succeeded', async () => {
      const run = await service.createRun({ agentKey: 'munchen' });

      await expect(
        service.transitionRunStatus(run.id, 'waiting_for_approval'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.transitionRunStatus(run.id, 'succeeded'),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents reopening terminal runs', async () => {
      const run = await service.createRun({ agentKey: 'venezia' });
      await service.transitionRunStatus(run.id, 'running');
      await service.transitionRunStatus(run.id, 'failed', {
        terminalErrorCategory: 'model_timeout',
      });

      await expect(
        service.transitionRunStatus(run.id, 'running'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.transitionRunStatus(run.id, 'queued'),
      ).rejects.toThrow(BadRequestException);
    });

    it('treats terminal transitions to the same terminal state as idempotent', async () => {
      const run = await service.createRun({ agentKey: 'firenze' });
      await service.transitionRunStatus(run.id, 'running');
      const failedOnce = await service.transitionRunStatus(run.id, 'failed', {
        terminalErrorCategory: 'upstream_429',
      });

      const failedAgain = await service.transitionRunStatus(run.id, 'failed', {
        terminalErrorCategory: 'different_error',
      });

      expect(failedAgain.status).toBe('failed');
      expect(failedAgain.terminalErrorCategory).toBe(
        failedOnce.terminalErrorCategory,
      );
      expect(mockRunRepo.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('retry linkage', () => {
    it('creates a retry run linked via parentRunId', async () => {
      const parent = await service.createRun({
        agentKey: 'munchen',
        workflowId: 'venue-scout',
        missionKey: 'NIDO-004',
        initiatedByUserId: 12,
        inputSummary: { venueSlug: 'cat-s-cradle' },
      });
      await service.transitionRunStatus(parent.id, 'cancelled');

      const retry = await service.createRetryRun(parent.id);

      expect(retry.id).not.toBe(parent.id);
      expect(retry.parentRunId).toBe(parent.id);
      expect(retry.status).toBe('queued');
      expect(retry.agentKey).toBe('munchen');
      expect(retry.workflowId).toBe('venue-scout');
      expect(retry.missionKey).toBe('NIDO-004');
      expect(retry.initiatedByUserId).toBe(12);
      expect(retry.inputSummary).toEqual({ venueSlug: 'cat-s-cradle' });
    });

    it('throws NotFoundException when parent run does not exist', async () => {
      await expect(
        service.createRetryRun('00000000-0000-4000-8000-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('monotonic event sequence enforcement', () => {
    it('auto-increments sequence and rejects non-monotonic explicit sequences', async () => {
      const run = await service.createRun({ agentKey: 'firenze' });

      const ev1 = await service.appendEvent({
        runId: run.id,
        eventType: 'run_queued',
        message: 'Queued run',
      });
      const ev2 = await service.appendEvent({
        runId: run.id,
        eventType: 'run_started',
        message: 'Started run',
      });
      const ev5 = await service.appendEvent({
        runId: run.id,
        eventType: 'step_progress',
        sequence: 5,
        message: 'Checkpoint reached',
      });

      expect(ev1.sequence).toBe(1);
      expect(ev2.sequence).toBe(2);
      expect(ev5.sequence).toBe(5);

      await expect(
        service.appendEvent({
          runId: run.id,
          eventType: 'step_progress',
          sequence: 5,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.appendEvent({
          runId: run.id,
          eventType: 'step_progress',
          sequence: 3,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.appendEvent({
          runId: run.id,
          eventType: 'step_progress',
          sequence: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('metadata redaction', () => {
    it('recursively redacts sensitive keys in run summaries, events, and approvals', async () => {
      const rawMetadata = {
        safeField: 'visible',
        token: 'tok_123',
        secret: 'sec_123',
        password: 'pw',
        apiKey: 'AIza...',
        authorization: 'Bearer abc',
        cookie: 'session=xyz',
        privateKey: '-----BEGIN PRIVATE KEY-----',
        ciphertext: '0xdeadbeef',
        accessToken: 'at_123',
        refreshToken: 'rt_123',
        nested: {
          x_api_key: 'nested-key',
          items: [{ clientSecret: 'nested-secret', label: 'ok' }],
        },
      };

      const sanitized = sanitizeAgentMetadata(rawMetadata);
      expect(sanitized.safeField).toBe('visible');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.authorization).toBe('[REDACTED]');
      expect(sanitized.cookie).toBe('[REDACTED]');
      expect(sanitized.privateKey).toBe('[REDACTED]');
      expect(sanitized.ciphertext).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      const nested = sanitized.nested as {
        x_api_key: string;
        items: Array<{ clientSecret: string; label: string }>;
      };
      expect(nested.x_api_key).toBe('[REDACTED]');
      expect(nested.items[0]).toEqual({
        clientSecret: '[REDACTED]',
        label: 'ok',
      });

      const run = await service.createRun({
        agentKey: 'firenze',
        inputSummary: { apiKey: 'raw-key', campaign: 'weekly' },
      });
      expect(run.inputSummary).toEqual({
        apiKey: '[REDACTED]',
        campaign: 'weekly',
      });

      const event = await service.appendEvent({
        runId: run.id,
        eventType: 'step_progress',
        payload: { authorization: 'Bearer secret', step: 'fetch' },
      });
      expect(event.payload).toEqual({
        authorization: '[REDACTED]',
        step: 'fetch',
      });

      const approval = await service.createApprovalRequest({
        runId: run.id,
        outputType: 'newsletter_draft',
        title: 'Review Draft',
        payload: { refreshToken: 'rt_secret', subject: 'Top Picks' },
      });
      expect(approval.payload).toEqual({
        refreshToken: '[REDACTED]',
        subject: 'Top Picks',
      });
    });
  });

  describe('usage and cost unavailable handling', () => {
    it('distinguishes measured numeric usage from unavailable without coercing to 0', async () => {
      const unavailable = createUnavailableAgentUsageTotals({
        modelName: 'gemini-2.5-flash',
        provider: 'google-genai',
      });
      expect(unavailable.inputTokens).toBe('unavailable');
      expect(unavailable.estimatedCostUsd).toBe('unavailable');
      expect(() => AgentUsageTotalsSchema.parse(unavailable)).not.toThrow();

      const partial = AgentUsageTotalsSchema.parse({
        inputTokens: 1200,
        outputTokens: 350,
        totalTokens: 1550,
        estimatedCostUsd: 'unavailable',
      });
      expect(partial.totalTokens).toBe(1550);
      expect(partial.estimatedCostUsd).toBe('unavailable');

      expect(() =>
        AgentUsageTotalsSchema.parse({
          inputTokens: -1,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        }),
      ).toThrow();

      const run = await service.createRun({
        agentKey: 'venezia',
        usageTotals: unavailable,
      });
      expect(run.usageTotals).toEqual(unavailable);
    });
  });

  describe('approval resolution and queries', () => {
    it('creates and resolves an approval request and enforces resolution rules', async () => {
      const run = await service.createRun({ agentKey: 'firenze' });
      const approval = await service.createApprovalRequest({
        runId: run.id,
        outputType: 'weekly_content_brief',
        title: 'Approve Weekly Brief',
        summary: '3 headliners selected',
      });
      expect(approval.status).toBe('pending');
      expect(approval.decidedAt).toBeNull();

      const resolved = await service.resolveApprovalRequest(approval.id, {
        status: 'approved',
        decidedByUserId: 42,
        decisionNote: 'Looks great',
      });
      expect(resolved.status).toBe('approved');
      expect(resolved.decidedByUserId).toBe(42);
      expect(resolved.decisionNote).toBe('Looks great');
      expect(resolved.decidedAt).toBeInstanceOf(Date);

      // Idempotent same-status resolution
      const resolvedAgain = await service.resolveApprovalRequest(approval.id, {
        status: 'approved',
        decidedByUserId: 99,
      });
      expect(resolvedAgain.status).toBe('approved');
      expect(resolvedAgain.decidedByUserId).toBe(42);

      // Reject changing an already-resolved approval to another status
      await expect(
        service.resolveApprovalRequest(approval.id, {
          status: 'rejected',
          decidedByUserId: 42,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lists runs with filters and loads run with events and approvals', async () => {
      const runA = await service.createRun({
        agentKey: 'firenze',
        missionKey: 'NIDO-003',
      });
      await service.createRun({
        agentKey: 'munchen',
        missionKey: 'NIDO-004',
      });

      await service.appendEvent({
        runId: runA.id,
        eventType: 'run_queued',
      });
      await service.createApprovalRequest({
        runId: runA.id,
        outputType: 'social_concept',
        title: 'IG Carousel',
      });

      const firenzeRuns = await service.listRuns({ agentKey: 'firenze' });
      expect(firenzeRuns).toHaveLength(1);
      expect(firenzeRuns[0].id).toBe(runA.id);

      const loaded = await service.getRunWithEventsAndApprovals(runA.id);
      expect(loaded.events).toHaveLength(1);
      expect(loaded.approvalRequests).toHaveLength(1);
    });
  });
});
