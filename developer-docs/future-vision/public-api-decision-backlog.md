# Public API And Developer Ecosystem Decision Backlog

Status: Discovery backlog, not an active implementation epic

Planning horizon: Remainder of 2026 and beyond

## Purpose

This document preserves the decisions Nido must make before expanding from a
feature-rich MVP into broadly reusable open concert-data infrastructure.

It is intentionally a decision backlog rather than a set of GitHub issues.
Maintainers should refine these questions through product discovery, ADRs, and
documentation before creating implementation-level scope.

## Activation Conditions

Detailed public API work should not enter the delivery critical path until most
of the following are true:

- the canonical concert, artist, venue, festival, genre, and source model is
  accepted and exercised by real workflows;
- duplicate, merge, archive, correction, and deletion behavior is defined;
- poster and calendar ingestion can produce reviewable catalog candidates;
- production security, observability, rate controls, rollback, and retention
  have owners and verified runbooks;
- the two-developer team has capacity to maintain a public contract;
- at least one external integration use case has been validated;
- public API work has a clear benefit beyond the existing Vue client.

## ADR Candidates

ADR numbers should be assigned only when the maintainers begin the relevant
decision review.

### Public Resource Model

- Which domain object is the canonical public event record?
- Are artists, bands, venues, festivals, genres, and sources first-class public
  resources or embedded summaries?
- Which fields are required for a publishable record?
- Which provenance is public, partner-only, admin-only, or permanently private?
- How are confidence, freshness, and correction status represented safely?

### Identifier Stability

- Are UUIDs exposed directly or mapped to separate public identifiers?
- What happens to identifiers when records merge?
- Do archived or deleted records return tombstones, redirects, or `404`?
- Can an external consumer safely store Nido identifiers long term?
- How are source identifiers kept separate from canonical public identifiers?

### Versioning And Compatibility

- Use URI, header, media-type, or evolutionary schema versioning?
- What constitutes a breaking change?
- What compatibility window can two maintainers realistically support?
- How are deprecations announced and measured?
- Which CI contract tests prevent accidental breaking changes?

### Data Licensing And Attribution

- Which license applies to Nido-authored catalog data?
- Which third-party source terms restrict redistribution?
- What attribution must API consumers display?
- What rights apply to poster artwork, descriptions, ticket URLs, and submitted
  corrections?
- What correction, dispute, takedown, and deletion process is required?
- How is contributor consent recorded for submitted data and media?

### Authentication And Access Tiers

- Which reads remain anonymous?
- When are Firebase user tokens, API keys, or another client credential used?
- Are community, partner, and internal access tiers distinct?
- How are keys issued, hashed, rotated, revoked, and audited?
- Which endpoints require stronger abuse controls or administrative approval?

### Rate Limits, Abuse, And Cost

- What are the per-IP, per-user, per-key, and project-wide limits?
- Which workloads need hard daily ceilings and emergency kill switches?
- Where should rate limits live: application, Firebase App Check, API Gateway,
  Cloud Armor, or a staged combination?
- How is cost attributed to a client and successful product outcome?
- What happens when a consumer exceeds quota?

### Query And Synchronization Contract

- Which filters, sort orders, and cursor semantics are stable?
- Is `updatedSince` sufficient for early synchronization?
- How are create, update, merge, archive, restore, and delete changes exposed?
- Are polling change feeds sufficient before webhooks are justified?
- How are timezone changes and event reschedules represented?
- What consistency and freshness guarantees can Nido make?

### Corrections And Trust

- Can public consumers submit corrections?
- How are correction sources, evidence, review, and outcomes preserved?
- Which trusted partners can publish directly, if any?
- How are probable duplicates and disputed records represented externally?
- What quality indicators are helpful without leaking moderation internals?

### Documentation And SDK Strategy

- Is deployed OpenAPI the authoritative contract?
- How is documentation verified against dev and production behavior?
- Which examples prove the core discovery and synchronization workflows?
- When does a generated TypeScript client provide enough value to maintain?
- What changelog and migration guidance is required?
- Is a developer portal warranted, or are repository docs sufficient initially?

### Operations And Service Expectations

- What availability, latency, freshness, and error-rate SLOs are supportable?
- Which request IDs and stable error codes are public?
- What incident and status communication can the team maintain?
- How are schema, database, and API rollbacks coordinated?
- Which metrics demonstrate healthy external adoption rather than traffic alone?

## Developer Experience Research

Before selecting tools or generating SDKs, run a small integration exercise:

1. Give a developer only the public documentation and a test credential if
   required.
2. Ask them to list upcoming events for a location.
3. Ask them to fetch full event, venue, and performer context.
4. Ask them to synchronize changes without duplicating records.
5. Ask them to interpret a merge, archive, correction, and rate-limit response.
6. Record setup time, questions, contract ambiguities, and failed assumptions.

The results should drive documentation and API design decisions. Do not assume
that an OpenAPI page alone constitutes a good developer experience.

## Documentation Deliverables Before Implementation Issues

- Public resource and provenance glossary.
- API compatibility and deprecation policy draft.
- Data licensing and attribution decision.
- Authentication and access-tier decision.
- Pagination and incremental synchronization contract.
- Merge, archive, deletion, and tombstone semantics.
- Rate-limit and cost-control model.
- Public versus private data boundary.
- One end-to-end integration example reviewed by someone other than its author.

## Explicit Non-Goals For The Current MVP

- Broad public API launch.
- Multiple supported SDKs.
- Webhook infrastructure without validated demand.
- Complex API monetization or billing.
- A standalone developer portal.
- Guaranteed statewide data completeness.
- Automatic publication based only on AI confidence.
- Supporting unstable contracts indefinitely.

## Review Cadence

Review this backlog at major catalog, ingestion, and production-readiness
milestones. Promote a question into an ADR only when a near-term decision or
validated integration requires it.

Do not create detailed GitHub implementation issues from this document without
an explicit maintainers' planning session.
