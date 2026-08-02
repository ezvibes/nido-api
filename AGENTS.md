# Nido Agent Operating Contract

## Mission

Nido is an open concert-data platform being built by a two-developer team. Improve
the feature-rich MVP and production readiness in small, reviewable slices while
preserving the longer-term ingestion, catalog, public API, and partner vision.

## Authority

- Maintainers own product priority, architecture approval, merge, production
  deployment, destructive data operations, IAM, secrets, and paid-service limits.
- The coordinator owns task scope, delegation, synthesis, and the final release
  recommendation.
- An implementation agent may edit only the approved scope and must preserve
  unrelated working-tree changes.
- A verifier reviews the completed diff and evidence independently for substantial
  changes.
- GitHub Actions provides repeatable validation and deploys approved merges.
- Never merge a pull request or trigger a production deployment without explicit
  maintainer approval.

## Agent Routing

- Feature work across NestJS, Vue, migrations, admin behavior, or public API
  behavior: use `.agents/skills/nido-feature-flywheel/SKILL.md`.
- Infrastructure and production-readiness work: use
  `developer-docs/catalog-operating-system/nido-infrastructure-agent.md`.
- Vue interaction and design work: use the local frontend specialist when
  available, while following existing Vue 3 patterns.
- Catalog architecture and publishing work: read
  `developer-docs/catalog-operating-system/README.md` and the relevant ADR.
- Future public API direction is not active MVP scope. Read
  `developer-docs/future-vision/public-api-decision-backlog.md` before proposing
  public contracts or developer-platform issues.

## Feature Workflow

1. Read the GitHub issue and restate the user outcome, acceptance criteria, and
   non-goals.
2. Inspect the current branch, working tree, implementation, tests, migrations,
   and deployment impact before editing.
3. Resolve material architecture ambiguity before coding. Record durable decisions
   in an ADR or issue when needed.
4. Split independent research among subagents only when the user has authorized
   delegation. Give each agent a bounded question or disjoint write area.
5. Assign one implementation owner per file boundary. Do not allow overlapping
   writes.
6. Run focused checks while developing.
7. Run `npm run agent:gate` before handoff.
8. Use an independent verifier for changes spanning multiple layers, migrations,
   security boundaries, or public behavior.
9. Prepare a PR evidence table. Do not merge.
10. After an approved merge, verify the dev deployment and record the revision,
    behavior, remaining risk, and rollback target.

## Engineering Rules

- Follow existing NestJS, TypeORM, Vue 3, and repository patterns before adding
  abstractions or dependencies.
- Use migrations for deployed schema changes. Keep `DB_SYNCHRONIZE=false` outside
  throwaway local databases.
- Public queries and admin queries must have explicit visibility and authorization
  contracts.
- Preserve provenance and human publication authority for automated ingestion.
- Keep secrets out of source, logs, issue bodies, task payloads, and screenshots.
- Do not run destructive Git, GCP, Firebase, or database commands without explicit
  approval and a rollback path.
- Keep dev and production configuration separate.
- Do not revert or overwrite changes that were not made for the current task.

## Validation

Use focused commands during implementation, then run the shared gate:

```bash
npm run agent:gate
```

The shared gate runs API tests, client tests, the API build, and the client build.
Database migration execution, authenticated dev tests, browser verification, and
cloud inspection remain explicit evidence because they require environment access.

Do not add the existing mutating `npm run lint` command or database-dependent
`migration:show` to the universal gate.

## Definition Of Complete

A feature handoff includes:

- linked issue and bounded scope;
- implementation and migration summary;
- focused test evidence;
- successful shared gate;
- manual or browser verification for user-facing behavior;
- security, privacy, cost, API, and deployment impact;
- independent review findings or explicit reason it was unnecessary;
- known limitations and follow-up issues;
- dev verification plan and rollback target.
