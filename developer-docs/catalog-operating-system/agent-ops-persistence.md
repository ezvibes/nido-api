# Agent Ops Persistence (Issue #155)

## Purpose

`AgentOpsPersistenceService` (`src/apis/agents/agent-ops-persistence.service.ts`)
provides durable PostgreSQL persistence for agent runs (`agent_runs`),
ordered run lifecycle events (`agent_run_events`), and human-in-the-loop
approval requests (`agent_approval_requests`).

## Contracts & State Rules

- Contracts live in `src/contracts/agent-ops.contract.ts` and are exported from
  `src/contracts/index.ts`.
- Run status lifecycle:
  - `queued -> running | failed | cancelled`
  - `running -> waiting_for_approval | succeeded | failed | cancelled`
  - `waiting_for_approval -> running | succeeded | failed | cancelled`
  - Terminal runs (`succeeded`, `failed`, `cancelled`) cannot reopen;
    transitioning a terminal run to its current terminal status is idempotent.
- Retry runs link back to the original run via `parent_run_id`.
- Run events enforce strictly monotonic `sequence >= 1` per `run_id`
  (backed by unique index `UQ_agent_run_events_run_id_sequence`).
- Usage/cost telemetry uses `AgentUsageTotalsSchema` and preserves
  `'unavailable'` when unmeasured instead of coercing to `0`.

## Redaction & Retention Expectations

- All persisted JSONB metadata (`input_summary`, `output_summary`,
  `agent_run_events.payload`, and `agent_approval_requests.payload`) is
  recursively sanitized via `sanitizeAgentMetadata` prior to database write.
- Keys matching `token`, `secret`, `password`, `apiKey`, `authorization`,
  `cookie`, `privateKey`, `ciphertext`, `accessToken`, or `refreshToken`
  (case-insensitive, across nested objects and arrays) are replaced with
  `[REDACTED]`.
- Retention: run summaries, terminal error categories, and human approval
  decisions are retained for operational auditability and mission evidence
  (minimum 90-day retention before any future archival/pruning job).
