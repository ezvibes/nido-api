# GitHub MCP + GitHub CLI + Codex Workflow

This document describes a public-safe workflow for coordinating GitHub issues, implementation agents, pull requests, and CI.

The preferred model is connector-first:

1. Use GitHub MCP or a structured GitHub connector for issue and PR metadata.
2. Use `gh` CLI for local branch context, Actions, logs, workflow dispatch, and repository operations not exposed by the connector.
3. Use Codex or another implementation agent for repo inspection, code changes, tests, builds, and handoff summaries.

## Tool Roles

### GitHub MCP / Connector

Use GitHub MCP first for structured GitHub work:

- create issues
- update issue bodies
- update issue state
- inspect PR metadata
- update PR metadata when supported
- keep issue content synchronized with architecture decisions

This keeps planning and review records in GitHub instead of private chat history.

### GitHub Issues

Use GitHub issues as the durable collaboration record.

Issues should contain:

- product outcome
- architectural intent
- scope and non-goals
- ADR notes
- acceptance criteria
- test plan
- agent handoff instructions

### Codex Or Other Implementation Agents

Use agents for:

- repository inspection
- code implementation
- tests and builds
- documentation updates
- PR preparation

Agents should not start major implementation work until the issue is clear enough to execute without private chat context.

For infrastructure and production-readiness work, use:

```text
developer-docs/catalog-operating-system/nido-infrastructure-agent.md
```

In VS Code, run `Tasks: Run Task` -> `Nido: Agent Brief` to print the brief and
`Nido: Local Infra Gate` or `Nido: Smoke Dev API` for quick validation.

### GitHub CLI

Use `gh` for operational repository tasks:

- PR discovery
- workflow run inspection
- CI log inspection
- workflow dispatch
- secrets and variables when explicitly approved
- PR creation when the connector does not expose the required operation

### GitHub Actions

Use Actions to keep quality gates repeatable:

- validate builds
- run tests
- deploy approved merges
- surface failures in PR checks

## Branching Standard

Use scoped branches:

```text
codex/issue-040-relational-publishing
codex/issue-041-duplicate-resolution
codex/issue-042-normalized-events-api
```

## PR Standard

PRs should include:

- linked issue
- implementation summary
- tests run
- migration/deployment impact
- screenshots or API examples when relevant
- known limitations
- follow-up issues

## Architecture Gate Rule

If an issue depends on an architecture decision, do not implement around the ambiguity.

Instead:

1. update the architecture issue
2. capture the decision
3. update downstream scope
4. then implement

## Connector Fallback Rule

Prefer GitHub MCP/connector operations for GitHub issue and PR metadata. Fall back to `gh` CLI when:

- the connector does not expose the operation
- local branch state is required
- GitHub Actions logs are required
- secrets or variables must be configured with explicit approval
- workflow runs must be inspected or dispatched

## Completion Rule

An issue is complete only when:

- code is merged or intentionally deferred
- tests/builds are documented
- deployment impact is understood
- completion outcome is recorded
- follow-up issues are linked
