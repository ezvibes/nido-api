# Execution Contract

## Brief

- Issue and user outcome:
- Acceptance criteria:
- Non-goals:
- Existing implementation reused:
- Architecture or data decisions:
- Files and boundaries:
- Migration and existing-row behavior:
- Public and admin API behavior:
- UI states and accessibility:
- Security, privacy, cost, and deployment impact:
- Focused test plan:
- Dev verification and rollback plan:
- Model/agent budget: coordinator only, coordinator + verifier, or explicitly bounded delegates

## Evidence

| Layer                | Result                 | Evidence                    |
| -------------------- | ---------------------- | --------------------------- |
| Focused API tests    | Pass, fail, or skipped | Exact command and result    |
| Focused client tests | Pass, fail, or skipped | Exact command and result    |
| Shared gate          | Pass or fail           | `npm run agent:gate`        |
| Migration review     | Pass or skipped        | Forward, defaults, rollback |
| Manual/browser path  | Pass or skipped        | User journey and viewport   |
| Independent review   | Pass or findings       | Findings and resolution     |
| CI                   | Pass, fail, or pending | Workflow run                |
| Dev deployment       | Pass, fail, or pending | Commit, revision, behavior  |
| Rollback target      | Recorded or pending    | Prior commit/revision       |

## Stop Conditions

Stop and return to the maintainer when:

- the issue requires an unresolved architecture or product decision;
- unrelated working-tree changes make a safe patch impossible;
- a migration cannot preserve existing production data;
- required credentials or environment access are unavailable;
- tests reveal a broader regression outside the approved scope;
- the next action is merge, production deployment, destructive data change, IAM,
  secret mutation, or a paid-service limit increase without explicit approval.

## Compute Discipline

- Use GPT-5.6 SOL for the current coordination and high-judgment implementation path.
- Keep the workflow model-portable; tests, issue contracts, and deployment evidence are
  the durable interface.
- Use deterministic tools for builds, tests, formatting, and deployment checks.
- Add one verifier only when migration, authorization, public behavior, or another
  material cross-layer risk justifies it.
- Do not create always-on GCP agent services. Prefer local execution, bounded CI jobs,
  and the existing scale-to-zero application architecture.
