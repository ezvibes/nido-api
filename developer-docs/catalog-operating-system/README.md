# Catalog Operating System

This guide describes how Nido plans and reviews catalog work across product, architecture, implementation, and deployment.

It is intentionally public-safe. It does not include private cloud resource names, credentials, internal URLs, or environment-specific runbooks.

## Product Thesis

The catalog exists to turn event ingestion into trustworthy public discovery.

The system should support:

- trusted calendar sync
- flyer or poster ingestion
- admin review
- public event discovery
- future partner submissions
- newsletter and curation workflows

The key product promise is that event data should be reusable, explainable, and safe to automate.

## Architecture Principles

### One Canonical Catalog

Public discovery should read from a canonical event catalog rather than directly from source-specific records.

Source systems can include:

- calendar sync
- iCal feeds
- uploaded flyers
- manual admin entry
- partner submissions

Those sources should publish into one event model through controlled service boundaries.

### Provenance Is Required

Every automated or admin-assisted catalog write should preserve source context.

Useful provenance includes:

- source type
- external source identity
- raw imported title or venue text when appropriate
- extraction method
- confidence or warning metadata
- admin decision context

Public users may only need a simple source badge. Admins and operators may need deeper provenance details.

### Dedupe Before Scale

Automation creates value only if it does not pollute the feed.

Duplicate prevention should prefer:

- exact source identity when available
- conservative fuzzy matching when source identity is missing
- reviewable ambiguity over silent overwrite
- deterministic, testable match rules

### API Contracts Are Product Contracts

The public event feed should not force the client to parse raw source text.

API responses should provide normalized display data:

- event title
- event time
- venue name
- city and region
- artist summaries
- ticket URL
- source badges
- image metadata when available

## Issue Dossier Workflow

Large work should be split into issue dossiers.

Each dossier should include:

- executive summary
- product outcome
- architectural intent
- current state
- target state
- scope
- non-goals
- ADR notes
- data model impact
- API contract impact
- UX/admin impact
- operational impact
- risks and mitigations
- acceptance criteria
- test plan
- agent handoff instructions
- completion outcome

## Naming Convention

Use GitHub issue numbers when available:

```text
GH-039_issue-1.4_catalog-publishing-architecture-gate.md
GH-040_issue-1.5_relational-publishing-integration.md
GH-041_issue-1.6_duplicate-resolution-policy.md
GH-042_issue-1.7_normalized-events-api-client-migration.md
```

Rules:

- Prefix with GitHub issue number as `GH-###`.
- Include sprint issue number as `issue-X.Y`.
- Use lowercase kebab-case.
- Keep one file per issue.
- Do not mix unrelated scopes in the same dossier.

## Agent Handoff Standard

An implementation agent should be able to answer these questions before coding:

- What user or business outcome is this issue protecting?
- What architecture decisions are already settled?
- What code areas are likely involved?
- What is explicitly out of scope?
- What tests are expected?
- What deployment risks exist?
- How will completion be verified?

If the answer is not in the issue, the issue is not ready for autonomous implementation.

