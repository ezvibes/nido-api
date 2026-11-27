import { z } from 'zod';

/**
 * Bounded lifecycle statuses for persisted agent runs.
 *
 * State transition contract:
 * - queued -> running | cancelled | failed
 * - running -> waiting_for_approval | succeeded | failed | cancelled
 * - waiting_for_approval -> running | succeeded | failed | cancelled
 * - succeeded | failed | cancelled -> terminal (reopening rejected; same-state terminal transition is idempotent)
 */
export const AgentRunStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_for_approval',
  'succeeded',
  'failed',
  'cancelled',
]);

export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;

export const AGENT_RUN_TERMINAL_STATUSES: ReadonlySet<AgentRunStatus> = new Set(
  ['succeeded', 'failed', 'cancelled'],
);

export function isTerminalAgentRunStatus(status: AgentRunStatus): boolean {
  return AGENT_RUN_TERMINAL_STATUSES.has(status);
}

/**
 * Bounded event types recorded sequentially on an agent run.
 */
export const AgentRunEventTypeSchema = z.enum([
  'run_queued',
  'run_started',
  'step_progress',
  'approval_requested',
  'approval_resolved',
  'run_succeeded',
  'run_failed',
  'run_cancelled',
]);

export type AgentRunEventType = z.infer<typeof AgentRunEventTypeSchema>;

/**
 * Bounded statuses for human-in-the-loop agent approval requests.
 */
export const AgentApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'revision_requested',
  'rejected',
  'cancelled',
]);

export type AgentApprovalStatus = z.infer<typeof AgentApprovalStatusSchema>;

/**
 * Bounded output categories for staged agent approval artifacts.
 */
export const AgentApprovalOutputTypeSchema = z.enum([
  'weekly_content_brief',
  'social_concept',
  'newsletter_draft',
  'venue_enrichment',
  'ingestion_publication',
  'other',
]);

export type AgentApprovalOutputType = z.infer<
  typeof AgentApprovalOutputTypeSchema
>;

/**
 * Distinguishes measured numeric usage/cost values from explicitly unavailable telemetry.
 * Never coerce unknown usage/cost to 0.
 */
export const AgentMeasuredNumberOrUnavailableSchema = z.union([
  z.number().nonnegative(),
  z.literal('unavailable'),
]);

export type AgentMeasuredNumberOrUnavailable = z.infer<
  typeof AgentMeasuredNumberOrUnavailableSchema
>;

export const AgentUsageTotalsSchema = z
  .object({
    inputTokens: AgentMeasuredNumberOrUnavailableSchema,
    outputTokens: AgentMeasuredNumberOrUnavailableSchema,
    totalTokens: AgentMeasuredNumberOrUnavailableSchema,
    estimatedCostUsd: AgentMeasuredNumberOrUnavailableSchema,
    modelName: z.string().min(1).max(128).optional(),
    provider: z.string().min(1).max(64).optional(),
  })
  .strict();

export type AgentUsageTotals = z.infer<typeof AgentUsageTotalsSchema>;

export function createUnavailableAgentUsageTotals(extras?: {
  modelName?: string;
  provider?: string;
}): AgentUsageTotals {
  return {
    inputTokens: 'unavailable',
    outputTokens: 'unavailable',
    totalTokens: 'unavailable',
    estimatedCostUsd: 'unavailable',
    ...(extras?.modelName ? { modelName: extras.modelName } : {}),
    ...(extras?.provider ? { provider: extras.provider } : {}),
  };
}
