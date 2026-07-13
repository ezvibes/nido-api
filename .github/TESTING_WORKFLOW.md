# Nido Testing Workflow

This workflow separates fast local feedback from post-merge dev-environment
verification. It is intended for human developers and Codex agents working on
feature branches.

## Testing Layers

Use the smallest useful check first, then widen before a pull request is merged.

1. Focused unit tests while editing.
2. API build before handoff.
3. Client build when frontend code changes.
4. Local smoke test against a running API.
5. Pull request validation in GitHub Actions.
6. Dev smoke test after merge and deployment.

## Local Development Loop

Start the stack:

```bash
npm run start:dev
npm run dev:client
```

Run focused backend tests while developing:

```bash
npm test -- concert.service
npm test -- concert-sync
npm test -- ingestion
```

Run the API build before handing a branch back:

```bash
npm run build
```

Run the client build when `client/` changes:

```bash
npm run build --prefix client
```

Smoke test a running local API:

```bash
npm run smoke:local
```

If the local API is connected to PostgreSQL, Firebase, GCS, and calendar config,
run the deeper local check:

```bash
npm run smoke:local:deep
```

## Pull Request Gate

Before a feature branch is ready for review, the agent should report:

- Files changed.
- Tests and builds run.
- Smoke checks run.
- Known risks or skipped checks.

For backend-only branches, the minimum expected local gate is:

```bash
npm test -- <focused test names>
npm run build
npm run smoke:local
```

For frontend branches, add:

```bash
npm run build --prefix client
```

For deployment-sensitive branches, inspect:

```text
.github/workflows/validate-deployment.yml
.github/workflows/deploy-dev.yml
.github/DEPLOYMENT_SETUP.md
```

## Dev Environment Verification

After a PR merges to `main`, GitHub Actions runs the dev deploy workflow:

```text
.github/workflows/deploy-dev.yml
```

When the workflow reports success, verify the deployed API:

```bash
npm run smoke:dev
```

This checks:

- `/health`
- `/health/deep`
- `/api-docs-json`

For an authenticated concerts-feed smoke check, provide a Firebase bearer token:

```bash
API_BEARER_TOKEN=<firebase-id-token> npm run smoke:dev:concerts
```

Then verify the deployed Firebase app manually for the feature-specific user
flow. For authenticated admin or Sync Doctor flows, use a real Firebase session
or token and record which account was used without exposing credentials.

## Agent Handoff Template

```text
Goal:
<feature or fix>

Local checks:
- <focused tests>
- <api/client build>
- <smoke check>

PR checks:
- GitHub Actions validation result

Post-merge dev checks:
- npm run smoke:dev
- feature-specific manual/API check

Risks:
- <remaining unknowns>

Recommended next slice:
- <small follow-up>
```

## Current Dev Target

Default API:

```text
https://nido-api-81555493719.us-east1.run.app
```

Override it when needed:

```bash
API_BASE_URL=https://example.run.app npm run smoke:dev
```
