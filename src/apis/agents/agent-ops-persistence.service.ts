import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AgentApprovalOutputType,
  AgentApprovalOutputTypeSchema,
  AgentApprovalStatus,
  AgentApprovalStatusSchema,
  AgentRunEventType,
  AgentRunEventTypeSchema,
  AgentRunStatus,
  AgentRunStatusSchema,
  AgentUsageTotals,
  AgentUsageTotalsSchema,
  isTerminalAgentRunStatus,
} from '../../contracts';
import { AgentApprovalRequest } from './entities/agent-approval-request.entity';
import { AgentRunEvent } from './entities/agent-run-event.entity';
import { AgentRun } from './entities/agent-run.entity';

const REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /token/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /private[_-]?key/i,
  /ciphertext/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
];

const ALLOWED_RUN_TRANSITIONS: Record<
  AgentRunStatus,
  ReadonlySet<AgentRunStatus>
> = {
  queued: new Set(['running', 'failed', 'cancelled']),
  running: new Set([
    'waiting_for_approval',
    'succeeded',
    'failed',
    'cancelled',
  ]),
  waiting_for_approval: new Set([
    'running',
    'succeeded',
    'failed',
    'cancelled',
  ]),
  succeeded: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

const RESOLVED_APPROVAL_STATUSES: ReadonlySet<AgentApprovalStatus> = new Set([
  'approved',
  'revision_requested',
  'rejected',
  'cancelled',
]);

export interface CreateAgentRunInput {
  agentKey: string;
  workflowId?: string | null;
  missionKey?: string | null;
  externalEvidenceRef?: string | null;
  parentRunId?: string | null;
  initiatedByUserId?: number | null;
  inputSummary?: Record<string, unknown>;
  usageTotals?: AgentUsageTotals | null;
}

export interface TransitionAgentRunOptions {
  outputSummary?: Record<string, unknown> | null;
  terminalErrorCategory?: string | null;
  usageTotals?: AgentUsageTotals | null;
  externalEvidenceRef?: string | null;
}

export interface CreateRetryRunInput {
  workflowId?: string | null;
  missionKey?: string | null;
  externalEvidenceRef?: string | null;
  initiatedByUserId?: number | null;
  inputSummary?: Record<string, unknown>;
}

export interface AppendAgentRunEventInput {
  runId: string;
  eventType: AgentRunEventType;
  sequence?: number;
  message?: string | null;
  payload?: Record<string, unknown>;
}

export interface CreateAgentApprovalRequestInput {
  runId: string;
  outputType: AgentApprovalOutputType;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown>;
}

export interface ResolveAgentApprovalRequestInput {
  status: Exclude<AgentApprovalStatus, 'pending'>;
  decidedByUserId?: number | null;
  decisionNote?: string | null;
}

export interface ListAgentRunsFilters {
  agentKey?: string;
  status?: AgentRunStatus;
  missionKey?: string;
  workflowId?: string;
  parentRunId?: string;
  limit?: number;
  offset?: number;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);
    return value.map((item) => sanitizeValue(item, seen));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);

    const sanitized: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      sanitized[key] = isSensitiveKey(key)
        ? REDACTED_VALUE
        : sanitizeValue(entryValue, seen);
    }
    return sanitized;
  }

  return value;
}

/**
 * Recursively redacts sensitive keys (tokens, secrets, passwords, API keys,
 * authorization headers, cookies, private keys, and ciphertext) before
 * persisting agent run summaries or event/approval payloads.
 */
export function sanitizeAgentMetadata(
  metadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return sanitizeValue(metadata, new WeakSet<object>()) as Record<
    string,
    unknown
  >;
}

/**
 * Persistence service for agent runs, ordered run events, and human-in-the-loop
 * approval requests.
 *
 * Retention & Redaction Policy:
 * - All JSONB metadata fields (`inputSummary`, `outputSummary`, event `payload`,
 *   approval `payload`) pass through `sanitizeAgentMetadata` before persistence
 *   so secrets, tokens, cookies, and credentials are never stored in Cloud SQL.
 * - Usage and cost fields must use `AgentUsageTotalsSchema`, explicitly marking
 *   unmeasured telemetry as `'unavailable'` rather than coercing to `0`.
 * - Run records (`agent_runs`) and their audit trail (`agent_run_events`,
 *   `agent_approval_requests`) are retained for operational traceability and
 *   mission evidence; pruning/archival jobs should preserve terminal summaries
 *   and approval decisions for at least 90 days.
 */
@Injectable()
export class AgentOpsPersistenceService {
  constructor(
    @InjectRepository(AgentRun)
    private readonly runRepo: Repository<AgentRun>,
    @InjectRepository(AgentRunEvent)
    private readonly eventRepo: Repository<AgentRunEvent>,
    @InjectRepository(AgentApprovalRequest)
    private readonly approvalRepo: Repository<AgentApprovalRequest>,
  ) {}

  async createRun(input: CreateAgentRunInput): Promise<AgentRun> {
    const agentKey = input.agentKey?.trim();
    if (!agentKey) {
      throw new BadRequestException('agentKey is required');
    }

    const validatedUsageTotals =
      input.usageTotals !== undefined && input.usageTotals !== null
        ? AgentUsageTotalsSchema.parse(input.usageTotals)
        : null;

    const run = this.runRepo.create({
      agentKey,
      workflowId: input.workflowId ?? null,
      missionKey: input.missionKey ?? null,
      externalEvidenceRef: input.externalEvidenceRef ?? null,
      parentRunId: input.parentRunId ?? null,
      initiatedByUserId: input.initiatedByUserId ?? null,
      status: 'queued',
      inputSummary: sanitizeAgentMetadata(input.inputSummary),
      outputSummary: null,
      terminalErrorCategory: null,
      usageTotals: validatedUsageTotals,
      startedAt: null,
      completedAt: null,
    });

    return this.runRepo.save(run);
  }

  async transitionRunStatus(
    runId: string,
    nextStatus: AgentRunStatus,
    options: TransitionAgentRunOptions = {},
  ): Promise<AgentRun> {
    const parsedNextStatus = AgentRunStatusSchema.parse(nextStatus);
    const run = await this.runRepo.findOne({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException(`AgentRun ${runId} not found`);
    }

    if (isTerminalAgentRunStatus(run.status)) {
      if (run.status === parsedNextStatus) {
        return run;
      }
      throw new BadRequestException(
        `Cannot transition terminal AgentRun ${runId} from '${run.status}' to '${parsedNextStatus}'`,
      );
    }

    const allowedTargets = ALLOWED_RUN_TRANSITIONS[run.status];
    if (!allowedTargets.has(parsedNextStatus)) {
      throw new BadRequestException(
        `Invalid AgentRun status transition from '${run.status}' to '${parsedNextStatus}'`,
      );
    }

    const now = new Date();
    run.status = parsedNextStatus;

    if (parsedNextStatus === 'running' && !run.startedAt) {
      run.startedAt = now;
    }

    if (isTerminalAgentRunStatus(parsedNextStatus)) {
      run.completedAt = now;
    }

    if (options.outputSummary !== undefined) {
      run.outputSummary =
        options.outputSummary === null
          ? null
          : sanitizeAgentMetadata(options.outputSummary);
    }

    if (options.terminalErrorCategory !== undefined) {
      run.terminalErrorCategory = options.terminalErrorCategory;
    }

    if (options.usageTotals !== undefined) {
      run.usageTotals =
        options.usageTotals === null
          ? null
          : AgentUsageTotalsSchema.parse(options.usageTotals);
    }

    if (options.externalEvidenceRef !== undefined) {
      run.externalEvidenceRef = options.externalEvidenceRef;
    }

    return this.runRepo.save(run);
  }

  async createRetryRun(
    parentRunId: string,
    overrides: CreateRetryRunInput = {},
  ): Promise<AgentRun> {
    const parentRun = await this.runRepo.findOne({
      where: { id: parentRunId },
    });
    if (!parentRun) {
      throw new NotFoundException(`Parent AgentRun ${parentRunId} not found`);
    }

    return this.createRun({
      agentKey: parentRun.agentKey,
      workflowId:
        overrides.workflowId !== undefined
          ? overrides.workflowId
          : parentRun.workflowId,
      missionKey:
        overrides.missionKey !== undefined
          ? overrides.missionKey
          : parentRun.missionKey,
      externalEvidenceRef:
        overrides.externalEvidenceRef !== undefined
          ? overrides.externalEvidenceRef
          : null,
      parentRunId: parentRun.id,
      initiatedByUserId:
        overrides.initiatedByUserId !== undefined
          ? overrides.initiatedByUserId
          : parentRun.initiatedByUserId,
      inputSummary:
        overrides.inputSummary !== undefined
          ? overrides.inputSummary
          : parentRun.inputSummary,
    });
  }

  async appendEvent(input: AppendAgentRunEventInput): Promise<AgentRunEvent> {
    const eventType: AgentRunEventType = AgentRunEventTypeSchema.parse(
      input.eventType,
    );

    const run = await this.runRepo.findOne({ where: { id: input.runId } });
    if (!run) {
      throw new NotFoundException(`AgentRun ${input.runId} not found`);
    }

    const latestEvent = await this.eventRepo.findOne({
      where: { runId: input.runId },
      order: { sequence: 'DESC' },
    });
    const currentMax = latestEvent?.sequence ?? 0;

    let sequence: number;
    if (input.sequence !== undefined) {
      if (!Number.isInteger(input.sequence) || input.sequence < 1) {
        throw new BadRequestException('Event sequence must be an integer >= 1');
      }
      if (input.sequence <= currentMax) {
        throw new ConflictException(
          `Non-monotonic sequence ${input.sequence} for AgentRun ${input.runId} (current max: ${currentMax})`,
        );
      }
      sequence = input.sequence;
    } else {
      sequence = currentMax + 1;
    }

    const event = this.eventRepo.create({
      runId: input.runId,
      sequence,
      eventType,
      message: input.message ?? null,
      payload: sanitizeAgentMetadata(input.payload),
    });

    return this.eventRepo.save(event);
  }

  async createApprovalRequest(
    input: CreateAgentApprovalRequestInput,
  ): Promise<AgentApprovalRequest> {
    const outputType = AgentApprovalOutputTypeSchema.parse(input.outputType);
    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException('Approval request title is required');
    }

    const run = await this.runRepo.findOne({ where: { id: input.runId } });
    if (!run) {
      throw new NotFoundException(`AgentRun ${input.runId} not found`);
    }

    const approval = this.approvalRepo.create({
      runId: input.runId,
      status: 'pending',
      outputType,
      title,
      summary: input.summary ?? null,
      payload: sanitizeAgentMetadata(input.payload),
      decidedByUserId: null,
      decisionNote: null,
      decidedAt: null,
    });

    return this.approvalRepo.save(approval);
  }

  async resolveApprovalRequest(
    approvalId: string,
    input: ResolveAgentApprovalRequestInput,
  ): Promise<AgentApprovalRequest> {
    const nextStatus = AgentApprovalStatusSchema.parse(input.status);
    if (!RESOLVED_APPROVAL_STATUSES.has(nextStatus)) {
      throw new BadRequestException(
        `Approval resolution status must be one of: ${Array.from(RESOLVED_APPROVAL_STATUSES).join(', ')}`,
      );
    }

    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId },
    });
    if (!approval) {
      throw new NotFoundException(
        `AgentApprovalRequest ${approvalId} not found`,
      );
    }

    if (approval.status !== 'pending') {
      if (approval.status === nextStatus) {
        return approval;
      }
      throw new BadRequestException(
        `Cannot resolve AgentApprovalRequest ${approvalId} from '${approval.status}' to '${nextStatus}'`,
      );
    }

    approval.status = nextStatus;
    approval.decidedByUserId = input.decidedByUserId ?? null;
    approval.decisionNote = input.decisionNote ?? null;
    approval.decidedAt = new Date();

    return this.approvalRepo.save(approval);
  }

  async listRuns(filters: ListAgentRunsFilters = {}): Promise<AgentRun[]> {
    const where: FindOptionsWhere<AgentRun> = {};
    if (filters.agentKey) {
      where.agentKey = filters.agentKey;
    }
    if (filters.status) {
      where.status = AgentRunStatusSchema.parse(filters.status);
    }
    if (filters.missionKey) {
      where.missionKey = filters.missionKey;
    }
    if (filters.workflowId) {
      where.workflowId = filters.workflowId;
    }
    if (filters.parentRunId) {
      where.parentRunId = filters.parentRunId;
    }

    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const skip = Math.max(filters.offset ?? 0, 0);

    return this.runRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
  }

  async getRunWithEventsAndApprovals(runId: string): Promise<AgentRun> {
    const run = await this.runRepo.findOne({
      where: { id: runId },
      relations: ['events', 'approvalRequests'],
      order: {
        events: { sequence: 'ASC' },
        approvalRequests: { createdAt: 'ASC' },
      },
    });

    if (!run) {
      throw new NotFoundException(`AgentRun ${runId} not found`);
    }

    return run;
  }
}
