---
name: agent-infrastructure-maintainer
description: Use when updating Nido agent instructions, skills, adapter files for Codex/Claude/Antigravity, or reviewing the repo's agent workflow for drift, duplication, and reliability.
---

# Agent Infrastructure Maintainer

Keep Nido's agent operating system understandable, current, and low-drift across
Codex, Claude, Antigravity, GitHub, and local developer workflows.

## Canonical Source Order

1. Root `AGENTS.md` is the canonical operating contract.
2. `.agents/skills/*/SKILL.md` contains reusable workflow-specific guidance.
3. Tool-specific files such as `CLAUDE.md` and `.antigravity/rules.md` are thin
   adapters that point back to the canonical contract and add only tool-specific
   notes.
4. Durable project strategy belongs in `developer-docs/`, not in model-specific
   prompt files.

## Responsibilities

- Use `developer-docs/catalog-operating-system/agent-context-map.md` to locate
  current routes and capability boundaries; recheck the cited implementation.
- Use `developer-docs/catalog-operating-system/agent-learning-guide.md` to retain
  useful findings without duplicating instructions or overstating verification.
- Reduce duplicate or conflicting agent instructions.
- Keep skill descriptions discriminating enough for correct routing.
- Keep deployment, feature, curation, and infrastructure skills clearly separated.
- Update adapter files when root `AGENTS.md` or skill names change.
- Check that agent instructions preserve maintainer approval boundaries.
- Recommend improvements that increase reliability without making the workflow
  harder for a two-developer team.

## Review Checklist

When editing or reviewing agent files, verify:

- There is one obvious source of truth for each decision.
- Tool-specific adapter files do not duplicate the full operating contract.
- Skill names and folder names match.
- References point to files that exist.
- Dangerous actions still require explicit maintainer approval.
- The workflow still ends with evidence: tests, gate output, deployment checks,
  rollback target, or a clear reason a check was skipped.
- Instructions avoid stale dates, hardcoded future commitments, or speculative
  services unless documented as proposed direction.

## Handoff

Summarize:

- Which agent surfaces changed.
- Which redundancy or conflict was removed.
- How Codex, Claude, and Antigravity should route future Nido work.
- Three concrete follow-up improvements if the repo would benefit from further
  cleanup.
