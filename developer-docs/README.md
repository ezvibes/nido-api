# Nido Developer Docs

This directory contains public-facing developer guidance for the Nido API project.

These docs are safe to commit and share through the GitHub repository. They should explain reusable architecture, workflow, and implementation practices without exposing private operational details.

## Documentation Boundary

The project uses two documentation tiers:

### Private Local Docs

Path: `docs/`

Status: ignored by git.

Use this for:

- environment-specific deployment notes
- cloud project names and resource URLs
- service account names
- secret names
- admin beta runbooks
- internal smoke-test logs
- unreleased business strategy
- private implementation notes

### Public Developer Docs

Path: `developer-docs/`

Status: tracked by git.

Use this for:

- architecture principles
- public ADR summaries
- issue planning templates
- agent workflow guidance
- API design conventions
- API documentation security posture
- sanitized database schema diagrams
- testing strategy
- sanitized implementation handoffs

## Rule Of Thumb

If a doc helps another developer understand the project without revealing private infrastructure, it can live here.

If a doc helps operate a specific private environment, it belongs in `docs/`.

## Current Public Docs

- `catalog-operating-system/`: public guidance for catalog architecture, GitHub issue dossiers, agent handoff structure, and canonical event publishing planning.
- `api-docs-security.md`: guidance for safely publishing API docs, schema references, and diagrams while protecting production systems.
- `deployment-pipeline.md`: public overview of the deployment pipeline pattern, quality gates, and release philosophy.
