# Nido 2026 Platform Vision

Status: Directional planning, not committed delivery scope

Planning horizon: Remainder of 2026

Audience: Nido maintainers, contributors, and implementation agents

## Purpose

Nido is working toward an open concert-data platform that can turn fragmented
live-music information into trusted, structured, reusable public data.

This document preserves that ambition without turning it into an immediate
backlog. The current team is two developers building and hardening a more
feature-rich MVP. Near-term choices should keep the larger platform possible,
but they should not force premature public API, SDK, partner, or governance
work into the MVP critical path.

## North Star

A fan, artist, venue, festival, band, promoter, or developer should be able to
contribute or discover reliable concert information without understanding the
complex processing beneath it.

Nido should make the visible experience simple while the platform provides:

- durable ingestion from posters, calendars, direct entry, and future partners;
- human-reviewed extraction with confidence and provenance;
- one canonical catalog for concerts, artists, venues, festivals, and genres;
- fast, accessible discovery and contribution experiences;
- stable, documented interfaces for future external reuse;
- secure, observable, cost-controlled serverless operation on Google Cloud;
- reproducible local development and agent-assisted delivery.

## Current Operating Reality

The MVP comes first.

- The dev application is live and is the primary integration environment.
- Two core developers are shipping product and infrastructure improvements.
- Poster contribution, catalog administration, discovery, deployment safety,
  and production readiness are the highest-value areas.
- Architecture work should reduce rework and operational risk, not introduce
  enterprise process that the current team cannot maintain.
- Human review remains the publication authority while ingestion quality and
  duplicate controls mature.

## Strategic Product Pillars

### Intelligent Ingestion

Users should be able to upload a poster quickly from a phone and leave. Nido
should process it asynchronously, preserve the source and uploader hints,
extract one or more event candidates, identify uncertainty, and route the
result through human review.

The architecture should remain provider-neutral, idempotent, replayable, and
bounded by explicit compute and provider-call limits.

### Trusted Live-Music Catalog

Uploads, calendar synchronization, manual administration, and future partner
submissions should converge on one source-aware catalog. Canonical publication
must be transactional, duplicate-conscious, reversible where policy allows,
and supported by immutable provenance.

### Modern Product Experience

The Vue 3 application should feel current, fast, and intuitive across mobile
and desktop. Discovery, upload, processing status, and administration should
share coherent controls and product language.

Visual modernization is valuable when it improves scanning, comprehension,
trust, accessibility, or task completion. It should not add decorative or
maintenance-heavy UI for its own sake.

### Agent-Operated Serverless Platform

Cloud Run, Cloud Tasks, Cloud Storage, Cloud SQL, Secret Manager, Firebase, and
Vertex AI can provide a powerful platform with a small operating footprint.
Repository configuration should remain the source of truth, with explicit
environment differences, least-privilege identities, measured cost ceilings,
deployment verification, and practiced rollback paths.

The Nido deployment agent should increasingly help maintainers inventory,
review, deploy, validate, diagnose, recover, and optimize the platform. It must
remain approval-aware and should never trade safety for autonomy.

### Open Data And Developer Ecosystem

The long-term opportunity is larger than the Nido user interface. A stable,
well-governed public data API could allow developers and music organizations to
reuse approved concert data with clear attribution and predictable change
semantics.

This is a future direction, not active MVP scope. Licensing, public provenance,
versioning, identifiers, access tiers, synchronization, corrections, deletion,
documentation, and cost controls require deliberate decisions first.

## Delivery Horizon

### Now: Feature-Rich, Production-Ready MVP

- Improve the current upload, discovery, and admin workflows.
- Establish durable OCR candidate processing and human review.
- Resolve canonical publishing and duplicate behavior.
- Strengthen local testing, CI, deployment validation, migrations, rollback,
  security, observability, and cost controls.
- Measure the current Vue experience before setting redesign budgets.

### Next: Prove The Complete Data Loop

- Demonstrate poster-to-reviewed-catalog publication reliably in dev.
- Make trusted catalog records useful in discovery.
- Validate recovery, retention, privacy, and cost behavior.
- Exercise a production environment using the same reviewed architecture.
- Improve contributor documentation and reproducible local fixtures.

### Later: Open Platform Foundations

- Settle public API and data-governance ADRs.
- Stabilize public identifiers and compatibility policy.
- Define licensing, attribution, correction, merge, archive, and deletion rules.
- Build high-quality OpenAPI documentation and integration examples.
- Introduce external access tiers, synchronization, SDKs, or webhooks only when
  validated demand and operating capacity justify them.

## Decision Guardrails

- Preserve future options without building unused abstractions.
- Prefer reversible decisions while product usage is still being learned.
- Require ADRs for choices that constrain public contracts, data rights,
  security boundaries, or long-term cloud architecture.
- Keep raw ingestion evidence and moderation details out of public contracts.
- Treat budgets as alerts and enforce actual limits through quotas, rate caps,
  maximum instances, and feature flags.
- Do not let automation create canonical catalog entities silently.
- Do not publish unstable API contracts merely to appear platform-ready.
- Do not turn this document into GitHub issues without an explicit planning
  review by the maintainers.

## What Success Looks Like By Year End

Nido does not need to complete every platform idea in 2026. Meaningful progress
means:

- the MVP is demonstrably useful and production-ready;
- mobile poster contribution remains fast and becomes durably processed;
- approved data enters a trusted, source-aware catalog;
- the Vue experience is measurably clearer, faster, and more accessible;
- deployments and asynchronous workloads are observable and recoverable;
- cloud and provider costs are bounded and explainable;
- future public API decisions are documented well enough to begin deliberately;
- contributors and agents can understand the architecture without relying on
  private chat history.

## Related Planning

- `public-api-decision-backlog.md` captures unresolved questions that must be
  answered before activating a detailed public API or developer ecosystem epic.
- `../catalog-operating-system/README.md` describes the current catalog planning
  and agent handoff model.
- `../catalog-operating-system/nido-infrastructure-agent.md` defines the current
  infrastructure agent operating brief.

