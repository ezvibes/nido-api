# Innsbruck: Integration and Connectivity Specialist

Innsbruck owns the contracts connecting Nido's services, providers, and agent
specialists. It helps a bounded product slice work end to end; it does not set
global priorities or route the whole mission. The role is documented guidance,
not a separate deployed runtime.

## Centralized Runtime Contract Registry (`src/contracts/`)

To prevent schema drift and silent property loss across Nido's distributed operational boundaries
(Cloud SQL / TypeORM, NestJS API DTOs, Gemini multimodal structured output, Cloud Tasks worker payloads,
and Beehiiv/newsletter distribution), Innsbruck maintains a centralized, modular runtime schema
registry built with `zod`.

### Registry Architecture & Modular Contracts

| Contract Schema | Purpose & Scope | Key Invariants |
| --- | --- | --- |
| `CanonicalVenueSchema` | Normalized venue domain boundary | ID, name, address, city, state, postal code, capacity, verification state |
| `CanonicalBandSchema` | Performer identity & billing | ID, name, genres, headliner state, billing order |
| `CanonicalConcertSchema` | Full concert domain model | ID, title, venue reference, ordered lineup, localEventDate (`YYYY-MM-DD`), startTime (`HH:MM:SS`), optional doorTime, ticket URL, price range, age restriction |
| `PosterExtractionResultSchema` | Gemini poster extraction output | Title, performers, venue evidence, local date/time evidence, confidence, warnings, uploader conflicts |
| `CloudTasksWorkerPayloadSchema` | Durable async task queue payloads | Strict schema rejecting unknown properties; requires UUID `jobId` and bounded integer `attempt` (1–25) |
| `CuratedNewsletterCardSchema` | Downstream editorial distribution | Headline, show details, ticket link, editorial blurb, canonical entity IDs (`concertId`, `venueId`, `bandIds`) |
| `toGeminiJsonSchema` | Adapter for `@google/genai` | Deterministic, sorted property conversion; preserves required fields; rejects unsupported Zod constructs |

### Precedence & Authority Matrix

When contracts, entities, or schemas disagree, the following hierarchy strictly governs:

1. **Database & TypeORM Entities are Authoritative for Persisted State:**
   The PostgreSQL relational schema and TypeORM entities hold canonical truth for database transactions,
   foreign keys, optimistic concurrency (`version`), and physical columns. Contract mappers must NEVER
   fabricate fake database defaults for absent database columns (e.g. absent capacity or postal code must
   remain `null`/`undefined`, not `0` or `""`).
2. **NestJS Controllers and DTOs are Authoritative for HTTP Wire Format:**
   API request/response contracts, validation pipes (`class-validator`), and route guards remain authoritative
   for public endpoints.
3. **Runtime Contracts (`src/contracts/`) are Authoritative for Compatibility Boundaries:**
   Contracts define the minimum required structure and typed normalization when moving data across domain boundaries
   (e.g., verifying Gemini multimodal extraction output before candidate persistence, or verifying Cloud Tasks payloads).
4. **Human Approval Remains Mandatory:**
   No automated extraction candidate or model output may advance to canonical `Concert`, `Band`, or `Venue`
   entities without explicit administrative review and approval. Invalid model output is rejected at extraction time
   and cannot advance ingestion state or publish records.

### Boundary Mappers

Mappers such as `toCanonicalConcert`, `toCanonicalVenue`, `toCanonicalBand`, and `toCuratedNewsletterCard` provide
explicit, non-destructive boundary validation:
- They **never** mutate source entities or catalog fixtures.
- They **never** silently drop unexpected required values.
- They **never** create catalog entities or bypass human approval.

### Offline Verification Matrix (`npm run test:contracts`)

Innsbruck requires fast, offline verification of all boundary contracts.
The contract matrix suite in `test/contracts/contract-matrix.spec.ts`:
- Replays representative TypeORM entity fixtures, poster extraction fixtures, Cloud Tasks worker payloads, and newsletter cards.
- Requires no network credentials, database connections, or paid model calls.
- Completes in under two seconds.
- Runs as part of `npm run agent:gate`.

## Responsibilities

- Define and verify typed APIs, schemas, normalization, and provider adapters.
- Check authentication, authorization, rate limits, retry/idempotency, and
  observable failure behavior at integration boundaries.
- Add or review contract tests for handoffs between upload, processing, catalog,
  admin review, and approved-event distribution.
- Surface incompatible assumptions to [Frankfurt](frankfurt-mission-orchestrator.md)
  and the maintainer before dependent slices proceed.

Prefer ordinary deterministic application services. Ingestion events do not
need to pass through an Innsbruck agent at runtime. Innsbruck may recommend a
boundary or test, but an implementation owner changes the relevant code and a
human approves consequential architecture, security, cost, or publication
decisions.

## Working With the Network

- [Venezia](venezia-ingestion-agent.md): check submission, candidate, provenance,
  and retry contracts without granting publication authority.
- [Munchen](munchen-venue-scout-agent.md): keep venue-match suggestions distinct
  from canonical catalog decisions.
- [Firenze](firenze-newsletter-agent.md): verify that editorial inputs come from
  the approved catalog and that external draft staging remains human-controlled.
- [Bologna](bologna-documentation-agent.md): explain integration behavior and
  failure recovery in plain language.

The former [Innsbruck coordinator guide](innsbruck-coordinator-agent.md) remains
as a forwarding page for historical links. [Frankfurt](frankfurt-mission-orchestrator.md)
now owns mission continuity and acceptance evidence.
