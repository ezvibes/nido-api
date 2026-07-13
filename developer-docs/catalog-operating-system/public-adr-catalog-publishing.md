# ADR: Canonical Catalog Publishing

Status: Proposed

## Context

Event platforms often ingest data from many sources: calendars, uploaded flyers, manual admin entry, partner submissions, and third-party feeds.

If each source writes directly into public-facing records using different assumptions, the feed becomes difficult to trust. Duplicate events, inconsistent venues, missing source context, and unclear admin state all create operational drag.

## Decision

Use a canonical event catalog as the public source of truth.

Source-specific systems should publish through a controlled catalog boundary that:

- resolves or creates event records
- resolves venue and artist records
- records source/provenance metadata
- checks for duplicates
- exposes safe public event responses

## Consequences

Benefits:

- cleaner public event feed
- easier newsletter automation
- better auditability
- reusable partner API foundation
- safer admin workflows

Tradeoffs:

- more up-front schema and service design
- migration complexity from legacy records
- need for explicit duplicate policies
- need to separate public provenance from admin/debug metadata

## Public API Principle

Public event APIs should return normalized display data. Clients should not parse raw source text to discover venue, city, source type, or artist information.

