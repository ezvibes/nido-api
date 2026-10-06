# Nido Agent Setup

Nido uses repository-owned instructions to help a small team plan, implement,
review, and release changes consistently across coding environments. The setup
adds no standing cloud service. Agents use the tools available in their current
session, while ordinary application code, tests, Git, and GitHub Actions provide
the delivery system.

Use the [context map](agent-context-map.md) to find current implementation and
evidence. Use the [learning guide](agent-learning-guide.md) to turn useful findings
into lasting improvements.

## Roles And Authority

| Role | Responsibility | How it operates |
| --- | --- | --- |
| Maintainer | Product priority, architecture decisions, merge and production approval, sensitive operations | Human owner of the project |
| Coordinator | Scope, context gathering, implementation ownership, synthesis, release recommendation | The lead coding agent for the active task |
| Implementation owner | Changes within the agreed file and behavior boundaries | Usually the coordinator; a delegated agent when authorized |
| Verifier | Independent review of substantial changes and raw evidence | A separate reviewer when available and justified by risk |
| Domain specialist | Feature, deployment, instruction maintenance, or curation guidance | A skill loaded for the relevant task |
| GitHub Actions | Repeatable checks and configured deployment steps | Workflows triggered by repository events |

These roles do not imply that separate agents are installed or continuously
running. A skill is a reusable instruction package. Delegation requires the
authorization and ownership boundaries in the [operating contract](../../AGENTS.md).
If independent verification is unavailable, report the gap explicitly.

## Instruction Structure

| Layer | Source | Purpose |
| --- | --- | --- |
| Operating contract | [AGENTS.md](../../AGENTS.md) | Authority, routing, engineering rules, and completion evidence |
| Agent directory | [.agents/README.md](../../.agents/README.md) | Entry point for contributors and available skills |
| Reusable workflows | [.agents/skills](../../.agents/skills/) | Task-specific instructions and supporting resources |
| Claude adapter | [CLAUDE.md](../../CLAUDE.md) | Points Claude sessions to the shared contract |
| Antigravity adapter | [.antigravity/rules.md](../../.antigravity/rules.md) | Shared routing plus environment-specific reminders |
| Durable context | [Catalog Operating System](README.md) | Architecture, decisions, guides, and reusable lessons |

The root contract remains the canonical repository policy. This summary explains
the setup; it does not introduce another policy layer. Tool adapters should point
to shared instructions, with only their own environment-specific notes.

## Available Repository Skills

| Skill | Use it for | Main output |
| --- | --- | --- |
| [nido-feature-flywheel](../../.agents/skills/nido-feature-flywheel/SKILL.md) | NestJS, Vue, migrations, admin and public behavior | Scoped implementation, tests, review evidence, and dev handoff |
| [nido-deployment-manager](../../.agents/skills/nido-deployment-manager/SKILL.md) | GitHub Actions, GCP, Firebase, rollback, cost, and release readiness | Deployment assessment, smoke evidence, operational risks, and rollback target |
| [agent-infrastructure-maintainer](../../.agents/skills/agent-infrastructure-maintainer/SKILL.md) | Instruction, skill, and adapter maintenance | Consistent routing, valid references, and less duplicated guidance |
| [tps2-curator](../../.agents/skills/tps2-curator/SKILL.md) | Newsletter curation and prompt quality | Editorial criteria, draft review, and proposed prompt refinements |
| [gear-agent-flywheel](../../.agents/skills/gear-agent-flywheel/SKILL.md) | ADK experiments and agent architecture work | Bounded agent implementation or review and learning evidence |

Choose the workflow for the actual task. Load another skill when a real boundary,
such as deployment impact or editorial requirements, makes it useful. Skill
availability and automatic discovery vary by tool; verify support in the current
environment and read the repository files directly when needed.

The consolidated deployment manager is the repository route. A developer may
still have older personal skills outside the checkout; those are local setup and
are not part of this portable repository contract.

## Tools And Connections

| Capability | Repository entry point | Session prerequisite |
| --- | --- | --- |
| Local edits and Git history | Current checkout and Git | File access; inspect branch and working tree first |
| API/client tests and builds | [package.json](../../package.json), [client/package.json](../../client/package.json) | Installed dependencies and compatible Node runtime |
| Issues, PRs, and CI inspection | GitHub connector or `gh` | Available connection and authenticated repository access |
| Cloud inspection and smoke tests | Deployment skill and [smoke script](../../scripts/smoke-test-api.mjs) | Appropriate GCP identity, network access, and test credentials when required |
| Browser verification | Vue client and browser/Playwright tooling | Running application and available browser tools |
| Live model experiments | Newsletter service or [ADK scout script](../../src/scripts/test-adk-venue-scout.ts) | Configured provider, available model, and agreed compute budget |

Repository files do not establish an external connection or grant permissions.
Check access when the task requires it. Keep tokens, credential contents, private
inputs, and environment-specific logs out of tracked evidence.

## Delivery And Learning

1. Read the contract and relevant entries in the context map.
2. Inspect the issue, code, branch, and working tree; establish scope and ownership.
3. Implement and run focused checks, then the required shared gate.
4. Review substantial changes independently and record any missing evidence.
5. Prepare the PR and obtain maintainer approval for merge and production actions.
6. For a release task, verify the deployed revision and relevant user behavior.
7. Capture a reusable lesson when a finding warrants a test, runbook, or instruction change.

The [delivery flywheel](agent-delivery-flywheel.md) and
[execution contract](../../.agents/skills/nido-feature-flywheel/references/execution-contract.md)
provide the detailed handoff format. The shared gate is `npm run agent:gate`;
passing it does not establish live provider availability or deployment success.

## Growing The Setup

Add a specialist when recurring work has distinct expertise or permissions. Add
automation when a repeated manual check has a stable, testable contract. Measure
whether a change reduces escaped defects, review rework, time to a verified
handoff, or unnecessary model calls.

The [harness guide](agent-development-harness-guide.md) describes proposed runtime
evaluation tooling. Its fixture runner and benchmark workflow are not implemented
in this snapshot. Coding-agent coordination and application AI evaluation are
related but separate workflows; each needs evidence for its own claims.
