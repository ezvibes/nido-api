# Nido Agent Delivery Flywheel

Nido uses a small, evidence-driven delivery system to turn an issue into a safe
development release. The goal is not to operate a large agent swarm. The goal is
to give a small team the planning, implementation, review, and deployment discipline
of a much larger engineering organization.

## The One-Minute Explanation

```text
Maintainer defines the outcome and approval boundaries
                         |
GPT-5.6 SOL coordinator scopes and implements the change
                         |
Local deterministic gate tests API, client, and production builds
                         |
Independent verifier reviews the issue, diff, and raw evidence
                         |
GitHub records review and runs the same CI contract
                         |
GCP migration job -> Cloud Run -> API smoke -> Firebase Hosting -> reachability check
                         |
Failures become tests, runbooks, or the next bounded issue
```

Humans retain authority over product priority, architecture decisions, secrets,
paid-service limits, merge, production deployment, and destructive operations.

## Model And Agent Policy

The current preferred coordinator is GPT-5.6 SOL because feature delivery benefits
from strong repository reasoning, cross-layer implementation, and review judgment.
The workflow is not coupled to a model name; a future model can replace it without
changing the issue, test, GitHub, or GCP contracts.

Use model compute deliberately:

- Use one coordinator for the critical path and final synthesis.
- Use one independent verifier for migrations, authorization, public behavior, or
  other high-risk cross-layer changes.
- Delegate only bounded, non-overlapping research or implementation work.
- Do not use subagents for formatting, builds, test execution, or other deterministic
  tasks that local tools and CI perform more cheaply and reliably.
- Give verifiers the issue, diff, and raw evidence rather than the desired conclusion.
- Turn every useful review finding into code, a regression test, a runbook, or a
  clearly scoped follow-up issue.

## Five Durable Contracts

### 1. Product Contract

The GitHub issue defines the user outcome, acceptance criteria, and non-goals. The
coordinator may exceed the issue through safety, accessibility, or maintainability,
but must not silently expand it into a platform redesign.

### 2. Code Contract

`AGENTS.md` and `.agents/skills/nido-feature-flywheel/` define ownership,
guardrails, evidence, and stop conditions. Application code remains ordinary NestJS,
Vue 3, and PostgreSQL code that developers can understand without an agent runtime.

### 3. Evidence Contract

`npm run agent:gate` is the shared local contract. GitHub CI should run equivalent
tests and builds. Environment-dependent migration, browser, and smoke evidence stays
explicit instead of being implied by unit-test success.

### 4. Release Contract

Deployments use short-lived GitHub Actions credentials through Workload Identity
Federation. A one-shot Cloud Run job applies migrations before the API revision is
promoted. The workflow deploys Cloud Run, runs API smoke tests, deploys Firebase
Hosting, and checks Hosting reachability. An authenticated end-to-end UI smoke is a
future improvement. Production remains an explicit maintainer approval.

### 5. Learning Contract

A failed test, review finding, deployment failure, or dev regression must improve the
system. The preferred output is a durable guardrail, not a longer prompt.

## GCP Cost And Security Posture

The delivery framework should not create standing cloud infrastructure of its own.
Agent reasoning happens in the development environment; GitHub Actions performs
bounded build and deployment work; the application uses existing managed services.

- Keep Cloud Run scale-to-zero for dev and set minimum instances only when measured
  latency requirements justify the cost.
- Run migrations once in a Cloud Run job, never concurrently in API startup.
- Use Workload Identity Federation and least-privilege service accounts instead of
  long-lived service account keys.
- Store runtime secrets in Secret Manager. Pin production environment-variable
  references to numeric versions for deterministic rollback; reserve mutable aliases
  such as `latest` for environments where convenience is the explicit tradeoff.
- Reuse existing Cloud SQL, Cloud Storage, Firebase, and logging boundaries before
  introducing queues, schedulers, or additional services.
- Use expensive OCR or model calls only after cheap validation, deduplication, and
  editorial-lock checks.
- Record revision, image, migration, smoke, and rollback evidence for each deployment.
- Add budgets, retention policies, rate limits, and App Check before public scale makes
  abuse or unbounded storage material risks.

## Demonstration Path

Issue #54 is the first reference implementation:

1. The coordinator converts a small admin request into explicit public/admin state
   contracts.
2. Tests cover query and transaction behavior, authorization, concurrency, sync
   interaction, and Vue controls. Migration execution and PostgreSQL constraints
   remain explicit dev-environment evidence.
3. An independent verifier challenges the green build and identifies real gaps.
4. The coordinator resolves findings and reruns the same gate.
5. The maintainer reviews one branch and one evidence summary before any deployment.

This is the partner-facing value: Nido can move quickly without making correctness,
human editorial authority, cloud security, or cost control depend on trust in a
single model response.

## Growth Triggers

Add infrastructure only when a measured constraint demands it:

| Trigger                               | Smallest next step                                            |
| ------------------------------------- | ------------------------------------------------------------- |
| CI duration blocks iteration          | Cache dependencies or split existing jobs                     |
| Concurrent work causes file conflicts | Add a second worktree with explicit ownership                 |
| Dev regressions escape unit tests     | Add an authenticated dev smoke scenario                       |
| OCR retries become unreliable         | Add a managed task or event queue with idempotency            |
| Public traffic creates abuse risk     | Add App Check, rate limits, and usage telemetry               |
| Cloud spend becomes material          | Add budgets, per-service dashboards, and retention automation |

Until one of these triggers is observed, keep the system simple.
