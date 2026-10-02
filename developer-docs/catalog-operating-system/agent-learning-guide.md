# Agent Learning Guide

Nido improves by turning concrete findings into reusable tests, runbooks, and
instructions. This is reviewed project memory: documentation does not train a
model or run a background agent. The [operating contract](../../AGENTS.md) retains
authority over scope, architecture, and sensitive actions.

Use the [context map](agent-context-map.md) to locate the affected workflow and
the [agent setup](agent-setup.md) to understand ownership.

## When To Capture A Lesson

Capture a lesson when a review, deployment, test, or user observation reveals a
recurring failure, an expensive detour, a wrong assumption, or a useful new check.
Routine successful tasks do not require a new entry. Keep the finding in its
existing PR or issue until it offers a lesson worth reusing.

Record observations separately from explanations. For example, a provider's 404
response establishes that a request failed in that environment; it does not by
itself establish that the model is unavailable everywhere.

## Improvement Cycle

1. **Observe:** Capture the failed behavior, sanitized evidence, commit, and environment.
2. **Explain:** Identify the supported cause and list anything still uncertain.
3. **Improve:** Make the smallest authorized change that prevents or exposes the failure.
4. **Verify:** Run the relevant check and record its outcome and limits.
5. **Retain:** Put the lesson in the source that the next task will actually read.
6. **Revisit:** Compare a later result when the lesson claims an ongoing benefit.

Use status `Observed`, `Proposed`, `Applied`, `Verified`, or `Superseded`. `Applied`
means a change was made; `Verified` requires evidence for the named behavior and
environment. Neither means merged or deployed unless that is explicitly recorded.

## Where The Improvement Belongs

| Finding | Preferred durable change |
| --- | --- |
| A deterministic defect or missing boundary | Regression test and the smallest implementation fix |
| A release or operational failure | Deployment check or relevant runbook, with environment-specific evidence kept private |
| A repeated routing or context mistake | Context-map entry, adapter reference, or narrowly scoped skill instruction |
| An unresolved architecture tradeoff | ADR proposal and maintainer decision, with a revisit trigger |
| A prompt or extraction-quality regression | Representative fixture and evaluation criterion; measure before promoting a new prompt |
| A product or usability observation | Bounded issue or existing issue update, backed by the observed user behavior |

Keep each rule in one canonical location and link to it elsewhere. Public-safe
lessons belong in `developer-docs/`; credentials, private submissions, operational
logs, and personal details do not. Repository context and lessons are supporting
evidence, not authorization to expand scope or change approval boundaries.

## Compact Lesson Record

Place this block in an existing PR/issue or the relevant durable guide. Create a
separate document only when several related findings need a shared reference.

```markdown
### Lesson: <short concrete finding>

- Status: Observed | Proposed | Applied | Verified | Superseded
- Observed: <date, commit/PR, environment or execution mode>
- Evidence: <sanitized artifact or command and actual result>
- Cause: <supported explanation; remaining uncertainty>
- Change: <small correction and link to its canonical source>
- Verification: <command/behavior, result, commit and environment; or pending>
- Revisit: <specific recurrence, contract change, or measured trigger>
```

For a substantial failure, add impact, owner, and rollback details to the existing
incident or issue. Link evidence rather than copying long logs into instructions.

## Example: Preventing A False Readiness Claim

This example is grounded in the repository inspection for the context map:

- **Observed:** On 2026-10-02 at `66e064d`, ingestion had upload/review code but
  `runJobSkeleton()` still supplied placeholder OCR text. The harness guide
  described a fixture runner and benchmark workflow absent from the checkout.
- **Cause:** Proposed architecture and implemented foundations appeared together
  without an index identifying their different states.
- **Change:** The [context map](agent-context-map.md) records implemented, partial,
  and proposed capabilities, and requires separate verification evidence.
- **Verification:** Source inspection supports the current-state distinction.
  Whether the map reduces mistakes in later tasks remains unmeasured.
- **Revisit:** Update the relevant rows when real OCR execution or evaluation
  tooling ships. Check whether the next related handoff identifies its remaining
  evidence correctly.

## Maintaining Useful Memory

The coordinator captures reusable findings within the active task. Maintainers
review changes to policy or architecture; the infrastructure-maintainer skill
checks routing and documentation consistency. No recurring agent or paid model
evaluation is required to maintain this guide.

When touching a related area, merge duplicate lessons, replace superseded advice,
and link to the accepted decision or regression test. Keep historical evidence in
its PR or issue; keep only the current instruction in the skill or runbook.

Measure improvements with evidence already available: escaped defects, review
rework, time to a verified handoff, unnecessary model calls, or fixture results.
Record a baseline before claiming a speed or quality improvement. Use offline
checks where they answer the question; record the configured budget and limits
for any authorized live evaluation.
