# NIDO-001: Poster to approved concert demonstration

- Status: approved
- Approved by: Nido maintainer (2026-10-20)
- Target milestone: January 2027 Beta Launch
- Human owner: Nido maintainer
- Coordinator: Frankfurt (documented role, not a running service)
- Specialists: Venezia for intake/candidates; Innsbruck for integration
  contracts; Munchen for venue evidence when needed; Firenze for an approved
  catalog handoff; Bologna for contributor and operator guidance.
- Implementation owners: assign per slice before coding; no overlapping files.
- Linked roadmap and issues: [#70](https://github.com/ezvibes/nido-api/issues/70),
  [#61](https://github.com/ezvibes/nido-api/issues/61),
  [#64](https://github.com/ezvibes/nido-api/issues/64),
  [#67](https://github.com/ezvibes/nido-api/issues/67),
  [#68](https://github.com/ezvibes/nido-api/issues/68),
  [#77](https://github.com/ezvibes/nido-api/issues/77).
- Baseline: local source inspected 2026-10-20; no deployed beta demonstration
  or live extraction verification is claimed here.

## User-visible outcome

A first-time contributor uploads a poster on mobile, leaves, and returns to a
clear submission status. An authorized editor verifies or corrects the result,
decides any possible duplicate, and publishes one canonical Concert. That
approved record appears in a working Nido or EZ Vibes downstream view or
content output. A nontechnical contributor and editor can demonstrate the
journey without knowing what OCR, queues, or agents are.

### Success & Efficiency Ceilings
- **Processing Cost Ceiling:** < $0.05 estimated provider and compute cost per published concert.
- **Admin Review Effort:** < 60 seconds and ≤ 3 interactions (clicks/taps) for a clean, ready-to-approve candidate.
- **Turnaround Durability:** Contributor can close mobile browser immediately after upload without stalling or dropping background extraction.

## Current baseline and scope

The repository has authenticated image upload, private storage, upload/job
records, admin image review, and a path for admin-approved publication into the
existing Concert catalog. The current ingestion job is an in-process skeleton
with placeholder OCR text. Durable processing, extraction candidates, recovery,
and the complete return-and-publish journey remain unverified or unimplemented.
Recheck this baseline against current code before starting each slice.

Deliver a small, cost-bounded, accessible journey using the existing Concert,
Band, and Venue contracts. Email/link intake, direct social intake, partner APIs,
autonomous publication, and a new catalog are outside this first demonstration.
Human approval remains mandatory for canonical publication, architecture and
paid-provider choices, PR merge, and production deployment.

## Proposed slices and dependencies

1. **Durable Core Pipeline (Offline Proof):** Prove durable submission,
   persisted user-visible state, retry/idempotency, and recovery with fixtures
   (#63, #62) via a feature-flagged dev proof before paid extraction is required.
2. **Measured Extraction & Provenance:** Make a bounded provider decision from
   permission-safe posters under #64; persist reviewable extraction candidates,
   provenance, and conservative duplicate suggestions without silent merges (#66).
3. **Usable Interfaces:** Make the contributor return path (#68) and admin
   correction/publication workflow (#67) fast and usable on mobile and desktop.
4. **Downstream Value Read:** Read one approved Concert through a real downstream
   Nido/EZ Vibes surface (#77); measure review effort, errors, processing cost,
   and distribution activity.

## Acceptance evidence

| Criterion | Evidence required | Current state |
| --- | --- | --- |
| Contributor submits and returns to understandable status | Mobile/browser walkthrough against dev | Pending |
| Processing survives retry, duplicate delivery, restart, and one representative failure | Fixture and integration tests; recovery demonstration | Pending |
| Extraction and matching are reviewable, bounded, and permission-safe | Representative fixtures, provenance/conflict/duplicate tests, call (< $0.05) limits | Pending |
| Only an authorized editor publishes one canonical Concert | Authorization and publication tests; dev walkthrough (≤ 3 actions / < 60s) | Pending |
| Approved record reaches a downstream surface | Demonstrated read/content output from approved catalog data | Pending |
| Operators can see failures and effort | Error/cost observations and review-time measurement | Pending |

## Handoff

- PRs, migrations, dev URLs, rollback targets, and operator feedback: pending.
- Observation window: define with the maintainer when real contributors use the
  beta; do not infer adoption from fixture or smoke tests.
- Status: Approved by maintainer on 2026-10-20. Issue alignments for #61, #67, #68, #77 proceed in coordination with this contract.
