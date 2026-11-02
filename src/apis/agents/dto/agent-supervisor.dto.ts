import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type AgentExecutionStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'WAITING_FOR_HUMAN'
  | 'ERROR';

export type AgentReadinessState =
  | 'available_runtime'
  | 'operating_role'
  | 'partially_implemented'
  | 'experimental'
  | 'proposed';

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'waiting_for_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface AgentActiveTaskSummary {
  runId: string;
  workflow: string;
  missionSummary: string;
  activeStep: string;
  startedAt: string;
  elapsedMs: number;
  modelCalls: number;
  toolCalls: number;
  estimatedTokens: number | null;
  delegatedFrom?: string | null;
  delegatedTo?: string | null;
}

export interface AgentDirectoryEntry {
  key: string;
  name: string;
  cityCode: string;
  role: string;
  responsibility: string;
  readiness: AgentReadinessState;
  readinessLabel: string;
  status: AgentExecutionStatus;
  model: string;
  documentationPath: string;
  expectedMaxRuntimeSeconds: number | null;
  supportedWorkflows: string[];
  tools: string[];
  currentTask: AgentActiveTaskSummary | null;
  lastVerifiedOutcome: {
    runId?: string;
    summary: string;
    status: AgentRunStatus | 'verified';
    timestamp: string;
    evidenceLink?: string;
  } | null;
  nextAction: {
    label: string;
    route?: string;
    actionItemCount?: number;
  };
}

export interface AgentTraceEvent {
  id: string;
  sequence: number;
  timestamp: string;
  agentKey: string;
  runId: string;
  type:
    | 'lifecycle'
    | 'reasoning_summary'
    | 'tool_call'
    | 'tool_response'
    | 'approval_gate'
    | 'steering'
    | 'error';
  title: string;
  summary: string;
  toolName?: string;
  arguments?: Record<string, unknown> | null;
  response?: Record<string, unknown> | null;
  latencyMs?: number | null;
  httpStatus?: number | null;
  status?: 'ok' | 'pending' | 'warning' | 'error';
}

export interface AgentRunRecord {
  id: string;
  agentKey: string;
  agentName: string;
  workflow: string;
  missionKey?: string | null;
  title: string;
  status: AgentRunStatus;
  isStale: boolean;
  initiator: string;
  model: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  durationMs: number;
  modelCalls: number;
  toolCalls: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  inputSummary: string;
  outputSummary: string;
  errorCategory?: string | null;
  evidenceLinks: Array<{ label: string; url: string }>;
  events: AgentTraceEvent[];
}

export interface AgentActionItem {
  id: string;
  type:
    | 'venezia_candidate_review'
    | 'venezia_duplicate_conflict'
    | 'firenze_newsletter_draft'
    | 'agent_error_attention';
  agentKey: string;
  agentName: string;
  status: 'pending' | 'resolved' | 'rejected';
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  createdAt: string;
  ageMinutes: number;
  runId?: string;
  candidateId?: string;
  uploadId?: string;
  posterUrl?: string;
  extractedData?: {
    title: string;
    date: string;
    time: string;
    venueName: string;
    venueId?: string | null;
    city?: string;
    state?: string;
    genre: string;
    bandNames: string[];
    confidence?: number | null;
    warnings: string[];
    modelName?: string;
  };
  probableDuplicates?: Array<{
    id: string;
    title: string;
    startsAt: string;
    venueName?: string;
  }>;
  newsletterDraft?: {
    title: string;
    dateRangeLabel: string;
    concertsCount: number;
    htmlPreview: string;
    targetSystem: 'beehiiv';
  };
  supportedActions: Array<
    | 'publish'
    | 'link'
    | 'merge'
    | 'publish_separately'
    | 'reject'
    | 'approve_beehiiv_draft'
    | 'reject_with_feedback'
    | 'acknowledge'
  >;
}

export interface AgentMissionSummary {
  missionKey: string;
  title: string;
  coordinator: string;
  integrationSpecialist: string;
  status: 'in_progress' | 'waiting_for_verification' | 'completed';
  summary: string;
  completedSlices: number;
  totalSlices: number;
  blocker: string | null;
  nextStep: string;
  linkedIssues: Array<{ number: number; title: string; state: 'open' | 'closed'; url: string }>;
  linkedPrs: Array<{ number: number; title: string; state: 'merged' | 'open'; url: string }>;
  evidence: Array<{ label: string; verified: boolean; detail: string }>;
}

export interface AgentSupervisorSummaryMetrics {
  environment: string;
  generatedAt: string;
  fixtureMode: boolean;
  freshness: {
    status: 'fresh' | 'partial' | 'degraded';
    checkedAt: string;
    sources: {
      agentSessions: 'ok' | 'unavailable';
      ingestionPipeline: 'ok' | 'unavailable';
      memoryStore: 'ok' | 'unavailable';
    };
    warnings: string[];
  };
  kpis: {
    activeRuns: number;
    waitingForApproval: number;
    attentionCount: number;
    staleRuns: number;
    completionRate24h: number;
    completionRate7d: number;
    totalRuns24h: number;
    totalRuns7d: number;
    medianDurationMs7d: number;
    p95DurationMs7d: number;
    oldestApprovalAgeMinutes: number | null;
  };
  usage24h: {
    modelCalls: number;
    toolCalls: number;
    measuredTokens: number | null;
    measuredCostUsd: number | null;
    availabilityNote: string;
  };
}

export interface AgentSupervisorStatusResponse {
  summary: AgentSupervisorSummaryMetrics;
  agents: AgentDirectoryEntry[];
  actionItems: AgentActionItem[];
  recentRuns: AgentRunRecord[];
  missions: AgentMissionSummary[];
}

export class ListAgentRunsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by canonical agent key', example: 'firenze' })
  @IsOptional()
  @IsString()
  agentKey?: string;

  @ApiPropertyOptional({
    description: 'Filter by run status',
    enum: ['queued', 'running', 'waiting_for_approval', 'succeeded', 'failed', 'cancelled', 'all'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Include demo fixture records (non-production only)', example: 'false' })
  @IsOptional()
  @IsString()
  fixture?: string;

  @ApiPropertyOptional({ description: 'Max items to return', default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Pagination offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class ResolveActionItemPublishPayloadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venueName?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bandIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bandNames?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genreIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  genre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveAgentActionItemDto {
  @ApiProperty({
    description: 'Resolution decision for the human-in-the-loop gate',
    enum: [
      'publish',
      'link',
      'merge',
      'publish_separately',
      'reject',
      'approve_beehiiv_draft',
      'reject_with_feedback',
      'acknowledge',
    ],
  })
  @IsString()
  @IsIn([
    'publish',
    'link',
    'merge',
    'publish_separately',
    'reject',
    'approve_beehiiv_draft',
    'reject_with_feedback',
    'acknowledge',
  ])
  action:
    | 'publish'
    | 'link'
    | 'merge'
    | 'publish_separately'
    | 'reject'
    | 'approve_beehiiv_draft'
    | 'reject_with_feedback'
    | 'acknowledge';

  @ApiPropertyOptional({ description: 'Target concert ID when linking or merging a duplicate' })
  @IsOptional()
  @IsString()
  targetConcertId?: string;

  @ApiPropertyOptional({ description: 'Operator feedback, rejection reason, or review notes' })
  @IsOptional()
  @IsString()
  feedback?: string;

  @ApiPropertyOptional({ description: 'Review duration in milliseconds', default: 1500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reviewDurationMs?: number;

  @ApiPropertyOptional({ type: ResolveActionItemPublishPayloadDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ResolveActionItemPublishPayloadDto)
  publishData?: ResolveActionItemPublishPayloadDto;
}

export class SteerAgentDto {
  @ApiProperty({
    description: 'Bounded operator steering instruction or intervention note for the agent session',
    example: 'Prioritize independent Durham venues and exclude sold-out shows.',
  })
  @IsString()
  @IsNotEmpty()
  instruction: string;

  @ApiPropertyOptional({ description: 'Optional target run or session ID' })
  @IsOptional()
  @IsString()
  runId?: string;
}
