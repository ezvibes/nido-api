# API Docs, Schema Docs, And Security Posture

This guide defines how Nido should publish useful developer documentation without weakening the security posture of deployed environments.

## Principle

Developer documentation should make the system easier to understand, contribute to, and integrate with.

It should not expose environment-specific infrastructure, sensitive operational details, private admin workflows, or production attack surfaces.

## Public Documentation Candidates

These are good candidates for open-source documentation:

- high-level API capability overview
- public endpoint categories
- sanitized request and response examples
- public OpenAPI excerpts
- local development setup with placeholder env vars
- data model overview
- ERD diagrams using generic table names and relationships
- sequence diagrams for ingestion, sync, review, and publishing
- architecture decision records
- testing strategy
- contribution workflow

## Private Documentation Candidates

These should remain in ignored local docs or secure internal systems:

- production hostnames
- cloud project IDs
- service account names or emails
- bucket names
- database connection names
- secret names
- admin allowlists
- operational runbooks with real commands
- incident notes
- logs
- screenshots showing infrastructure details
- private roadmap or partner strategy

## Swagger And OpenAPI Policy

Swagger UI and OpenAPI JSON are useful during development, but they can expose sensitive operational detail if published carelessly.

### Local Development

Local Swagger can be enabled by default.

Expected behavior:

- available to developers running the API locally
- includes full development schemas
- can include admin endpoints
- uses local placeholder examples

### Dev / Shared Test Environments

Dev Swagger may be enabled, but should be guarded.

Recommended controls:

- require Firebase/admin authentication, or
- restrict at the platform edge, or
- expose only to known developer/admin users

Dev OpenAPI JSON should avoid real secrets, tokens, private resource names, and production examples.

### Production

Production Swagger should be disabled by default or protected by strong access control.

Recommended production defaults:

```text
SWAGGER_ENABLED=false
PUBLIC_OPENAPI_ENABLED=false
```

If production docs must be available:

- require authenticated admin/developer access
- do not expose internal admin-only endpoints publicly
- do not expose private examples
- do not include infrastructure identifiers
- consider publishing a separate curated public OpenAPI artifact

## Recommended Runtime Flags

The API should support explicit documentation controls:

```text
SWAGGER_ENABLED=true|false
SWAGGER_REQUIRE_AUTH=true|false
PUBLIC_OPENAPI_ENABLED=true|false
```

Suggested behavior:

| Environment | Swagger UI | Full OpenAPI JSON | Public OpenAPI |
| --- | --- | --- | --- |
| local | enabled | enabled | optional |
| dev | enabled with auth or edge restriction | enabled with auth or edge restriction | optional |
| production | disabled by default | disabled by default | curated artifact only |

## Public OpenAPI Strategy

If Nido needs public API docs, prefer a curated public artifact rather than exposing the live internal Swagger surface.

The public artifact can include:

- public read endpoints
- partner-safe endpoints when ready
- sanitized schemas
- placeholder examples
- auth overview without sensitive implementation details
- rate limit and error response documentation

The internal artifact can include:

- admin endpoints
- ingestion review endpoints
- operational metadata
- deeper debugging schemas

## Schema And Diagram Policy

Public schema docs should focus on concepts and relationships.

Safe public examples:

- `Event` has one `Venue`.
- `Event` has many `Artists`.
- `EventSource` records where an event came from.
- `IngestionJob` tracks processing lifecycle.

Avoid exposing:

- real database names
- production connection strings
- live migration state
- private row examples
- operational table contents
- internal-only identifiers copied from production

## Diagram Guidance

Good public diagrams:

- canonical catalog ERD
- ingestion lifecycle sequence
- calendar sync to event publishing sequence
- admin review state machine
- public API read model overview

Avoid diagrams that include:

- real cloud project IDs
- real service account names
- real bucket names
- private network topology
- secret names
- production URLs

## Review Checklist Before Publishing Docs

- [ ] Does this doc contain real infrastructure identifiers?
- [ ] Does this doc contain private emails, service accounts, or project IDs?
- [ ] Does this doc expose a production endpoint that should be guarded?
- [ ] Does this doc reveal admin-only workflows in a way that increases abuse risk?
- [ ] Are examples sanitized?
- [ ] Are secrets, tokens, and private keys absent?
- [ ] Is this better suited for ignored `docs/` instead?

## Implementation Follow-Up

The codebase should eventually enforce this posture:

- add explicit Swagger/OpenAPI runtime flags
- gate production Swagger
- optionally generate curated public OpenAPI docs
- document API auth boundaries
- add a CI check or review checklist for public docs containing sensitive patterns

