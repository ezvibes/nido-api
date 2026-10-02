# Agent Context Map

Use this index to find the relevant code, workflow, and evidence before starting a
task. Read the [root operating contract](../../AGENTS.md) first, then load the
entries that match the task. The [agent setup](agent-setup.md) explains the roles
and tools; the [learning guide](agent-learning-guide.md) describes how to retain
useful findings.

## Snapshot And Evidence Rules

Repository inspection: 2026-10-02. The #106 harness update is based on main commit
`375a575`; entries describe this checkout and proposals. Use the harness report's
revision and dirty-working-tree flag to identify the tested state. No live
environment verification was performed for this map.

- **Implemented** means the cited behavior or configuration exists in this checkout.
- **Partial** identifies an existing foundation with a specific missing capability.
- **Proposed** means a design or next step is documented, without an implemented contract here.
- **Verified** is a separate claim: cite a command or artifact, result, commit,
  date, and environment. For deployments, also cite the workflow run and revision.

Recheck the current branch and cited source before making a decision. A green
build, proposed ADR, previous deployment, or installed dependency does not prove
the behavior is working in the current environment.

## Task Routing

| Task | Read first | Supporting context |
| --- | --- | --- |
| API, Vue, schema, or catalog behavior | [Feature flywheel](../../.agents/skills/nido-feature-flywheel/SKILL.md) | [Admin catalog contract](admin-concert-catalog.md), [test/deploy guide](admin-concert-testing-deployment-guide.md) |
| Deployments, cloud, rollback, or release readiness | [Deployment manager](../../.agents/skills/nido-deployment-manager/SKILL.md) | [Deployment overview](../DEPLOYMENT.md), current workflow and environment config |
| Agent instructions, adapters, or skills | [Infrastructure maintainer](../../.agents/skills/agent-infrastructure-maintainer/SKILL.md) | [Agent directory](../../.agents/README.md), setup and learning guides |
| Newsletter curation and prompt changes | [TPS2 curator](../../.agents/skills/tps2-curator/SKILL.md) | [Newsletter module guide](../../src/newsletter/README.md), existing service/client tests |
| ADK experiments and agent architecture | [GEAR flywheel](../../.agents/skills/gear-agent-flywheel/SKILL.md) | [ADK guide](gear-adk-agent-guide.md), proposed newsletter/ingestion ADRs |
| Future developer platform and public API | [Decision backlog](../future-vision/public-api-decision-backlog.md) | [Platform vision](../future-vision/2026-platform-vision.md); confirm active scope with the maintainer |

No frontend specialist brief is tracked in `.agents/` in this snapshot. Follow the
existing Vue patterns; use an available session specialist only when appropriate
and authorized.

## Capability Map

| Capability | State and boundary | Implementation entry points | Evidence to inspect |
| --- | --- | --- | --- |
| Public discovery and admin catalog | Implemented: visibility, approval, catalog state, optimistic version checks, and editorial protection | [Concert service](../../src/apis/concerts/concert.service.ts), [admin page](../../client/src/pages/AdminConcertsPage.vue), [concert card](../../client/src/components/concerts/ConcertCard.vue) | [Service tests](../../src/apis/concerts/concert.service.spec.ts), [admin HTTP tests](../../src/apis/concerts/admin-concert.controller.http.spec.ts), [admin UI tests](../../client/src/pages/AdminConcertsPage.spec.ts) |
| Bands, venues, and genres | Implemented: relational catalog entities and a seeded genre-option table; concert genre is still a string | [Bands](../../src/apis/bands/band.service.ts), [venues](../../src/apis/venues/venue.service.ts), [genre migration](../../src/migrations/1760000013000-CreateGenresCatalog.ts), [genre selector](../../client/src/components/GenreCombobox.vue) | [Band tests](../../src/apis/bands/band.service.spec.ts), [venue tests](../../src/apis/venues/venue.service.spec.ts), [selector tests](../../client/src/components/GenreCombobox.spec.ts); verify migration execution separately |
| Calendar sync | Implemented: source clients, job records, import and editorial-protection logic | [Sync service](../../src/concert-sync/concert-sync.service.ts), [Google client](../../src/concert-sync/services/google-calendar-client.service.ts), [iCal client](../../src/concert-sync/services/ical-calendar-client.service.ts), [Sync Doctor](../../client/src/pages/ConcertSyncPage.vue) | [Sync tests](../../src/concert-sync/concert-sync.service.spec.ts), [iCal tests](../../src/concert-sync/services/ical-calendar-client.service.spec.ts), [UI tests](../../client/src/pages/ConcertSyncPage.spec.ts); provider access needs live evidence |
| Poster submission and review | Implemented: storage upload, hints, job records, and admin review; OCR processing is partial | [Ingestion service](../../src/ingestion/ingestion.service.ts), [upload panel](../../client/src/components/ingestion/IngestionUploadPanel.vue), [review page](../../client/src/pages/AdminIngestionUploadsPage.vue) | [Service tests](../../src/ingestion/ingestion.service.spec.ts), [upload UI tests](../../client/src/components/ingestion/IngestionUploadPanel.spec.ts), [review UI tests](../../client/src/pages/AdminIngestionUploadsPage.spec.ts) |
| OCR worker and durable execution | Proposed: current `createJob()` launches in-process `runJobSkeleton()` with placeholder OCR text; no dedicated task worker is implemented here | [Current skeleton](../../src/ingestion/ingestion.service.ts), [ingestion v2 proposal](adr-multimodal-agent-ingestion-v2.md) | Require a settled execution ADR, implemented worker contract, retries/idempotency tests, and deployment evidence before claiming readiness |
| Newsletter preview, generation, and Beehiiv draft | Implemented: source preview, prompt hydration, one Gemini generation call, and optional external draft creation | [Newsletter service](../../src/newsletter/newsletter.service.ts), [Beehiiv service](../../src/newsletter/beehiiv.service.ts), [prompt](../../.gemini/prompts/weekly_top_picks.md), [admin page](../../client/src/pages/AdminWeeklyPicksPage.vue) | [Service tests](../../src/newsletter/newsletter.service.spec.ts), [Beehiiv tests](../../src/newsletter/beehiiv.service.spec.ts), [UI tests](../../client/src/pages/AdminWeeklyPicksPage.spec.ts); mocks do not verify model availability or real draft creation |
| ADK venue scout | Implemented experiment: seeded venue/show data and typed tools; not a live database-backed discovery service | [Scout script](../../src/scripts/test-adk-venue-scout.ts), [ADK guide](gear-adk-agent-guide.md) | Record execution mode, model configuration, tool events, and result when running `npm run adk:venue-scout`; fallback output alone does not establish successful model execution |
| Runtime AI evaluation harness | Partial: #106 offline newsletter fixtures, SDK/HTTP mocks, reports, and shared-gate/CI integration implemented; live AI quality evaluation remains proposed | [Harness README](../../test/agent-harness/README.md), [runner](../../scripts/eval-newsletter-harness.mjs), [voice rubric](../../test/agent-harness/brand-voice.md), [harness guide](agent-development-harness-guide.md) | Run `npm run test:newsletter:harness`; mocked replay does not establish live factual accuracy, voice, or URL reachability |

## Development And Release Evidence

| Surface | Source | What it establishes |
| --- | --- | --- |
| Local setup | [Root README](../../README.md), [API env example](../../.env.example), [client env example](../../client/.env.example), [Docker Compose](../../docker-compose.yml) | Setup instructions and example config; inspect actual configuration locally without publishing credentials |
| Shared gate | [package.json](../../package.json) | Hygiene, API/client tests, offline newsletter harness, API/client builds; run `npm run agent:gate` |
| PR validation | [Deployment validation](../../.github/workflows/validate-deployment.yml), [PR hygiene](../../.github/workflows/pr-hygiene.yml) | Configured checks; deployment validation uses path filters, so it may not run on agent-doc-only changes |
| Deployment configuration | [Dev workflow](../../.github/workflows/deploy-dev.yml), [dev config](../../.github/deploy/environments/dev.env), [prod example](../../.github/deploy/environments/prod.env.example) | Configured migration job, API/Hosting deployment, and smoke steps; a prod example does not establish a live production environment |
| Environment smoke | [Smoke script](../../scripts/smoke-test-api.mjs), [health-check script](../../.agents/skills/nido-deployment-manager/scripts/check_gcp_health.sh) | Behavior of the target environment at execution time; authenticated smoke may be skipped without configured credentials |
| Migration behavior | [Migrations](../../src/migrations/), [runner](../../src/scripts/run-migrations.ts) | Schema intent and execution mechanism; inspect DB results and rollback compatibility for the actual change |

## Decisions And Unresolved Context

The [catalog principles](README.md) and [admin contract](admin-concert-catalog.md)
explain existing product boundaries. The [newsletter v2](adr-newsletter-agent-v2.md),
[ingestion v2](adr-multimodal-agent-ingestion-v2.md), and
[catalog publishing](public-adr-catalog-publishing.md) ADRs currently carry proposed
status. Treat their runtime choices and numeric targets as proposals pending
verification and maintainer decisions.

Some older documents reference ADR files absent from this checkout. If a task
depends on such a decision, locate the authoritative issue or maintainer-approved
record and document the gap. Do not infer approval from a filename or a learning
journey entry. GitHub issue status and cloud state require a fresh inspection.

## Keeping The Map Useful

Update the affected row when a PR changes a capability boundary, route, or source
path. Cite the implementation commit or PR, and keep test execution and live
verification evidence in the corresponding handoff. Recheck this snapshot when
using it on another branch. Replace stale statements rather than appending
duplicate descriptions of the same capability.
