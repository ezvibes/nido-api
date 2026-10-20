# Mission record template

Use one public-safe Markdown record for an outcome that spans multiple issues,
PRs, or coding sessions. A mission is not a replacement for an issue, ADR, or
implementation brief. Keep it short enough to resume in a new session; link to
evidence rather than copying logs or private submissions. Do not include secrets,
personal data, or private commercial strategy.

```markdown
# NIDO-XXX: Outcome title

- Status: proposed | planned | in_progress | verifying | ready_for_acceptance | needs_iteration | blocked | completed
- Human owner: [maintainer]
- Coordinator: Frankfurt
- Specialists and implementation owner(s): [named per slice]
- Linked issues/ADRs: [links]
- Last evidence review: [date, commit, environment, or "not yet verified"]

## Outcome and demonstration

- A nontechnical user can: [observable result]
- Independent demonstrator: [role/person; no special agent knowledge required]
- Success measures: [small set with collection method]

## Boundaries

- In scope: [capabilities]
- Not in scope: [deferred work]
- Human approvals and safety limits: [decisions, publication, merge, deploy, cost]

## Delivery slices

1. [Slice and dependency]
2. [Slice and dependency]

## Acceptance evidence

| Criterion | Evidence required | State/link |
| --- | --- | --- |
| [User journey] | [Browser/dev demonstration] | Pending |
| [Reliability] | [Tests and recovery drill] | Pending |

## Handoff

- PRs/commits and migrations/rollback: [links or pending]
- Known limitations and observation window: [facts or none]
- Next step, blocker, and maintainer decision: [one clear action]
```

Move to `completed` only after the demonstrated outcome and required evidence
exist. A merged PR or mocked provider test can satisfy part of a criterion but
does not establish live behavior. If the evidence shows a gap, use
`needs_iteration`; use `blocked` only for a real dependency that prevents useful
progress. Record the next owner and recheck stale links before resuming.
