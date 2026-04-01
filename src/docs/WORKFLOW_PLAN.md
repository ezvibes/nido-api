# EZ Vibes Workflow Plan

## Product Loop

EZ Vibes should be built around one core loop:

1. Event content is uploaded or submitted.
2. The ingestion engine extracts structured signals from posters, flyers, and form submissions.
3. The system normalizes that data into canonical event, venue, and artist records.
4. Admins review low-confidence or duplicate-prone records.
5. Approved events are published into the discovery catalog.
6. Fans discover events through city-, region-, and preference-aware feeds.
7. Partners consume visibility, leads, and event intelligence through APIs and dashboards.

If a feature does not strengthen this loop, it should not be in the MVP.

## Pillars

### 1. AI Ingestion Engine

- Accept image uploads, PDFs, and structured event submissions
- Store raw assets in Google Cloud Storage
- Run OCR with Google Vision
- Parse dates, times, venue names, artists, cities, and genres
- Assign confidence scores and flag records for review

### 2. Structured Event Catalog

- Normalize events into relational entities
- Prevent obvious duplicates across repeated flyers and submissions
- Preserve source provenance and ingestion history
- Support approval states before records become public

### 3. Personalized Recommendation Engine

- Start with rules, not ML
- Rank by city, region, saved preferences, timing, and recency
- Return useful feeds for Raleigh/Triangle, Wilmington, Charlotte, Asheville, and Greensboro/Triad

### 4. Partner Platform Layer

- Expose approved event data via partner-friendly APIs
- Support partner-specific submissions and visibility workflows
- Make venue/promoter value legible through speed, accuracy, and reach

## User Groups

### Consumers

- Discover upcoming live music by city and date
- Save preferences and favorite events
- View reliable event details sourced from real local signals

### Venues

- Submit events quickly
- Ensure listings are accurate and timely
- Increase discovery in local feeds

### Festival and Promoter Partners

- Submit batches or partner-managed events
- Access structured event records through APIs
- Use EZ Vibes as a regional event intelligence layer

### Internal Admins and Curators

- Review OCR output and parser decisions
- Resolve duplicates
- Approve, reject, or edit normalized records
- Monitor ingestion job quality

## MVP Definition

The MVP is successful when EZ Vibes can demonstrate this live:

- A flyer or poster is uploaded
- OCR and parsing produce a draft event
- An admin reviews and approves it
- The approved event appears in a fan-facing discovery feed
- A partner can retrieve that event through an API

### In Scope

- Image upload to Google Cloud Storage
- OCR via Google Vision
- Parsing pipeline for basic event fields
- Human review queue
- Approved event catalog
- Consumer discovery feed by city/date
- Simple personalization using city, region, genre, and timing
- Partner API for approved events

### Out of Scope

- Fully automated publishing with no review
- Complex recommendation models
- Ticketing integrations
- Social graph features
- Full self-serve venue analytics portal
- Multi-state expansion

## Operating Rules

### Data Quality Rule

No OCR result should become publicly visible without either:

- high-confidence auto-approval rules, or
- admin review

For MVP, prefer manual review over risky automation.

### Source-of-Truth Rule

- Raw assets live in GCS
- Extracted text and parsing artifacts belong to ingestion jobs
- Canonical public records live in normalized relational tables

### Domain Boundary Rule

- `events`, `venues`, and `artists` are the canonical catalog domains
- The existing `concerts` module is a user-scoped experience layer for "My Concerts", not the long-term catalog source of truth
- New ingestion, moderation, partner, and discovery work should publish into canonical `events` rather than extending owner-scoped `concerts`
- `concerts` can continue to support the logged-in user experience until the canonical catalog is ready to power that view directly

### Recommendation Rule

For MVP, recommendations are deterministic and explainable:

- city match
- nearby region boost
- genre match
- upcoming-soon boost
- partner/featured boost if needed

## Immediate Build Order

1. Ingestion pipeline skeleton
2. Normalized schema
3. Admin moderation workflow
4. Public event catalog API
5. Consumer discovery feed
6. Partner API access
7. Rules-based personalization

## Decision Filters

Before implementing new work, confirm:

- Does it improve ingestion accuracy?
- Does it improve event normalization quality?
- Does it improve discovery usefulness?
- Does it improve partner value?
- Can it be demonstrated in the MVP story?
