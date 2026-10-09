# Agent Directory Adapter

Root `AGENTS.md` is the canonical Nido operating contract. Follow it first.

Use `.agents/skills/` for reusable project workflows:

- `nido-feature-flywheel`: feature implementation and PR handoff.
- `nido-deployment-manager`: deployment, GCP/Firebase operations, rollback, and
  production readiness.
- `agent-infrastructure-maintainer`: agent instruction and adapter maintenance.
- `firenze-newsletter`: Firenze/TPS2 newsletter curation, editorial quality,
  and draft preparation.
- `gear-agent-flywheel`: GEAR/ADK/Jules agent work.

Do not merge pull requests, trigger production deployments, mutate IAM/secrets,
or run destructive GCP/Firebase/database operations without explicit maintainer
approval.
