# Project Agents

This directory stores Nido-specific agent briefs and reusable skills. Root
`AGENTS.md` is the canonical operating contract; files here provide focused
workflow guidance.

## Core Skills

- `nido-feature-flywheel`: scoped feature delivery, tests, PR evidence, and
  handoff.
- `nido-deployment-manager`: deployment readiness, GCP/Firebase operations,
  rollback, cost, and production hardening.
- `agent-infrastructure-maintainer`: keeps Codex, Claude, Antigravity, and skill
  instructions aligned.
- `tps2-curator`: Weekly Top Picks newsletter curation and prompt refinement.
- `gear-agent-flywheel`: GEAR/ADK/Jules agent architecture work.

## Briefs

- `frontend-design-wizard.md`: Vue 3 frontend and UX specialist brief for small,
  practical interface improvements.

## Adapter Pattern

Tool-specific files such as `CLAUDE.md` and `.antigravity/rules.md` should stay
thin. They should point back to root `AGENTS.md` and these skills instead of
duplicating the full project workflow.
