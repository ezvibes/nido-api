# EZ Vibes Workflow Plan

Last updated: 2026-04-30

## Working Thesis

EZ Vibes should be built around a single operational loop:

1. Show data enters the system through uploads, submissions, or imports.
2. Ingestion converts messy inputs into structured draft records.
3. Admin review protects quality before anything becomes public.
4. Approved events power discovery, alerts, exports, and partner distribution.
5. User interaction data improves ranking and curation over time.

This is still the right workflow, but the plan now needs to balance two tracks:

- **Foundation track:** ingestion quality, normalization, moderation, and canonical event data
- **Activation track:** discovery engagement, recurring distribution, and audience growth

If the team over-builds ingestion without activation, there is no proof that users care.
If the team over-builds engagement without canonical event quality, the feed becomes untrustworthy.

## Current Product Priorities

### Priority 1: Publish trustworthy event data

- Standardize ingestion inputs
- Normalize event, venue, and artist data
- Preserve provenance and review states
- Prevent obvious duplicates

### Priority 2: Make the discovery feed more alive

- Add upvotes on events
- Add a "Trending this week" sort
- Prepare for city-aware alerts
- Tighten the highest-traffic UX flows

### Priority 3: Turn catalog data into distribution assets

- Generate a 90-day "Top Picks" export
- Reuse that output for newsletter and partner workflows
- Treat Beehiiv as a downstream integration, not a starting point

## Product Loop

### Core Loop

1. Event content is uploaded or submitted.
2. The ingestion engine extracts structured signals from posters, flyers, and forms.
3. The system normalizes that data into canonical event records.
4. Admins review low-confidence or duplicate-prone records.
5. Approved events are published into the discovery catalog.
6. Users discover, react to, and share events.
7. Distribution channels reuse approved event data for alerts, exports, and partner delivery.

## Canonical System Design

### Ingestion Layer

- Accept image uploads, PDFs, and structured event submissions
- Validate core metadata early: file type, size, source, city, state, uploader
- Store raw assets in Google Cloud Storage
- Run OCR and parsing on raw assets
- Assign confidence scores and route uncertain records to review

### Catalog Layer

- Canonical public domains should be `events`, `venues`, and `artists`
- Preserve source provenance and ingestion history
- Support draft, approved, rejected, and duplicate-review states
- Model engagement data separately from source records

### Discovery Layer

- Public feed powered only by approved events
- Deterministic ranking first: upcoming soon, city match, featured boost, engagement boost
- Add explicit user signals over time: upvotes, saved preferences, alert subscriptions

### Distribution Layer

- Partner-facing API for approved event data
- Export service for editorial and newsletter workflows
- Notification pipeline for city-based alerts

## User Groups

### Consumers

- Discover upcoming live music by city and date
- Upvote events and use trending discovery views
- Receive city-aware alerts for new shows

### Venues and Promoters

- Submit events quickly
- Ensure listings are accurate and timely
- Gain visibility in local discovery and downstream distribution

### Internal Admins and Curators

- Review OCR output and parser decisions
- Resolve duplicates
- Approve, reject, or edit normalized records
- Review media and enrichment submissions when needed

### Partners

- Retrieve structured, approved event data
- Reuse exports or APIs for external distribution

## MVP Definition

The MVP is successful when EZ Vibes can demonstrate this end-to-end:

1. A flyer or poster is uploaded.
2. Ingestion creates a draft event with structured metadata.
3. An admin reviews and approves it.
4. The approved event appears in a public discovery feed.
5. Users can interact with that feed through simple engagement signals.
6. The same approved event can be exported or delivered through an external channel.

## In Scope Now

- Image upload to Google Cloud Storage
- OCR and parsing for basic event fields
- Human review queue
- Canonical approved event catalog
- Consumer discovery feed by city/date
- Event upvotes and "Trending this week"
- 90-day "Top Picks" export
- Input validation and normalization for ingestion payloads

## Out of Scope For This Phase

- Fully automated publishing with no review
- Complex recommendation models
- Ticketing integrations
- Full social graph features
- Full self-serve venue analytics
- Multi-state expansion
- Beehiiv automation before exports are stable
- LLM enrichment features before ingestion quality is measured

## Operating Rules

### Data Quality Rule

No event should become public without either:

- clear approval logic, or
- admin review

For this phase, prefer manual review over risky automation.

### Source-of-Truth Rule

- Raw assets live in GCS
- OCR text and parsing artifacts belong to ingestion jobs
- Canonical public records live in normalized catalog tables
- Feed interactions like upvotes should be stored separately from source records

### Domain Boundary Rule

- The existing `concerts` module is still a user-scoped experience layer
- Canonical discovery should move toward `events`, not expand `concerts` forever
- Near-term UX wins can ship on top of current surfaces, but schema decisions should not block the future canonical catalog

### Recommendation Rule

For the current phase, ranking should stay deterministic and explainable:

- city match
- nearby region boost
- upcoming-soon boost
- editorial/featured boost
- recent engagement boost

## Near-Term Build Order

### Phase 1: Clean input + publish reliably

1. Standardize ingestion input values
2. Tighten normalized event schema and approval flow
3. Improve duplicate handling and provenance

### Phase 2: Increase discovery engagement

1. Add event upvotes
2. Add "Trending this week" sort
3. Audit and tighten the highest-traffic feed interactions

### Phase 3: Reuse the catalog externally

1. Build 90-day "Top Picks" export
2. Define city-based alert pipeline
3. Add partner/distribution endpoints on top of approved catalog data

### Phase 4: Add selective enrichment

1. Admin review for YouTube media
2. OCR evaluation dataset and scorecard
3. LLM genre tagging only after measurement criteria are defined

## Decision Filters

Before building a feature, confirm:

- Does it improve event data quality?
- Does it improve discovery usefulness or engagement?
- Does it create reusable distribution value?
- Can it be demonstrated in the end-to-end workflow?
- Does it fit the current phase, or is it premature?
