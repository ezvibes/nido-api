# Agent Directory Adapter

Root `AGENTS.md` is the canonical Nido operating contract. Follow it first.

Use `.agents/skills/` for reusable project workflows:

- `nido-feature-flywheel`: feature implementation and PR handoff.
- `nido-deployment-manager`: deployment, GCP/Firebase operations, rollback, and
  production readiness.
- `agent-infrastructure-maintainer`: agent instruction and adapter maintenance.
- `tps2-curator`: Weekly Top Picks curation and prompt quality.
- `gear-agent-flywheel`: GEAR/ADK/Jules agent work.

Do not merge pull requests, trigger production deployments, mutate IAM/secrets,
or run destructive GCP/Firebase/database operations without explicit maintainer
approval.
