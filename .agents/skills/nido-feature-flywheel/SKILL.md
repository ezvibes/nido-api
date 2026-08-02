---
name: nido-feature-flywheel
description: Use when implementing or reviewing a Nido GitHub feature issue that changes NestJS, Vue 3, PostgreSQL migrations, admin behavior, public API behavior, or post-deployment validation. Coordinates issue scoping, bounded implementation, shared verification, independent review, and dev handoff without merging or deploying production.
---

# Nido Feature Flywheel

Deliver one issue through a repeatable chain: contract, implementation, evidence,
independent review, and deployment handoff.

## Start

1. Read the root `AGENTS.md`.
2. Fetch the GitHub issue through the GitHub connector when available.
3. Inspect branch/status before editing. Preserve unrelated work.
4. Read `references/execution-contract.md` and use it to structure the task plan;
   do not create a planning file unless it is durable project documentation.
5. Identify deployment impact. For infrastructure changes, also read
   `developer-docs/catalog-operating-system/nido-infrastructure-agent.md`.

## Coordinate

- The coordinator owns scope and synthesis.
- Delegate only when the user authorized agents and the work splits cleanly.
- Use read-only agents for independent architecture, UX, or risk audits.
- Use one writer per file boundary. Never ask multiple agents to edit the same
  implementation area.
- Keep approval-sensitive actions with the coordinator and maintainer.

## Implement

- Follow existing domain and UI patterns.
- Make migrations explicit, reversible, and safe for existing rows.
- Separate public behavior from admin behavior.
- Treat loading, empty, success, error, authorization, and retry states as feature
  requirements.
- Add focused backend and client tests as behavior is introduced.
- Keep unrelated refactors and speculative future-platform work out of the patch.

## Verify

Run focused tests during implementation. Before handoff, run:

```bash
npm run agent:gate
```

Then use an independent verifier for multi-layer, migration, authorization, or
public-behavior changes. Give the verifier the issue, diff, and raw test output,
not the intended conclusion.

For UI work, verify relevant desktop and mobile flows with browser or Playwright
evidence when available. For deployment-sensitive work, define the authenticated
dev smoke path and rollback target.

## Handoff

- Summarize files and behavior changed.
- Include the evidence table from `references/execution-contract.md`.
- State migration, API, security, privacy, cost, and deployment impact.
- Record independent findings and any fixes made.
- Prepare the branch/PR only when requested or when the active workflow explicitly
  includes publishing. Never merge or deploy production without approval.
- After merge, verify dev behavior and convert failures into a regression test,
  runbook, gate, or follow-up issue.
