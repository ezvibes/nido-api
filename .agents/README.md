# Nido Project Agents

This directory stores repository-owned instructions and reusable skills for Nido.
The [root operating contract](../AGENTS.md) is canonical; files here provide
focused workflow guidance. Skills describe how an agent works on a task. They do
not create continuously running agents or provision cloud services.

## Start Here

1. Read [AGENTS.md](../AGENTS.md) for scope, authority, and completion requirements.
2. Use the [context map](../developer-docs/catalog-operating-system/agent-context-map.md)
   to find relevant implementation, decisions, and evidence.
3. Read the appropriate skill below and inspect the current branch before editing.

The [detailed setup](../developer-docs/catalog-operating-system/agent-setup.md)
explains roles, instruction structure, tools, and the delivery cycle. The
[learning guide](../developer-docs/catalog-operating-system/agent-learning-guide.md)
explains how useful findings become tests, runbooks, and better instructions.

## Core Skills

- [nido-feature-flywheel](skills/nido-feature-flywheel/SKILL.md): scoped feature delivery, tests, PR evidence, and
  handoff.
- [nido-deployment-manager](skills/nido-deployment-manager/SKILL.md): deployment readiness, GCP/Firebase operations,
  rollback, cost, and production hardening.
- [agent-infrastructure-maintainer](skills/agent-infrastructure-maintainer/SKILL.md): keeps Codex, Claude, Antigravity, and skill
  instructions aligned.
- [tps2-curator](skills/tps2-curator/SKILL.md): Weekly Top Picks newsletter curation and prompt refinement.
- [gear-agent-flywheel](skills/gear-agent-flywheel/SKILL.md): GEAR/ADK/Jules agent architecture work.

## Frontend Work

No standalone frontend specialist brief is tracked here. Follow existing Vue 3
patterns and use a session-provided specialist when available and appropriate.

## Adapter Pattern

Tool-specific files such as [CLAUDE.md](../CLAUDE.md),
[.antigravity/rules.md](../.antigravity/rules.md), and the
[agent-directory adapter](AGENTS.md) should stay thin. They point back to the root
contract and these skills. Change the canonical source when shared guidance
changes, then check references rather than copying the workflow into each tool.
