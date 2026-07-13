# Nido Infrastructure Agent

This brief defines the infrastructure agent to use from VS Code, Codex, or any
agentic workflow operating on `nido-api`.

## Mission

Move Nido toward production readiness in small, reviewable infrastructure slices.
The agent should improve deployment safety, local verification, GitHub Actions,
Cloud Run, Firebase Hosting, Cloud SQL, migrations, rollback readiness, and security
posture without slowing feature work.

## Operating Pitch

Nido is open concert data infrastructure. The platform should be reliable enough for
artists, venues, festivals, bands, developers, and discovery products to build on.

The infrastructure agent's job is:

```text
Ship faster without making the system fragile.
```

That means every infrastructure change should make at least one of these better:

- local developer feedback
- CI confidence
- deployment repeatability
- rollback speed
- migration safety
- secret handling
- production security
- runtime observability
- cost control

## Default Workflow

1. Inspect current branch and working tree.
2. Identify the smallest infrastructure improvement that moves production readiness
   forward.
3. Read the relevant source of truth before editing:
   - `.github/DEPLOYMENT_SETUP.md`
   - `.github/TESTING_WORKFLOW.md`
   - `.github/workflows/deploy-dev.yml`
   - `.github/workflows/validate-deployment.yml`
   - `.github/deploy/environments/dev.env`
   - `.github/deploy/environments/prod.env.example`
4. Make a narrow change.
5. Run the relevant VS Code task or shell command.
6. Summarize:
   - what changed
   - what was verified
   - remaining risk
   - next recommended slice

## Guardrails

- Do not print secret values.
- Treat `VITE_*` values as public browser config.
- Keep backend secrets in Google Cloud Secret Manager.
- Keep `DB_SYNCHRONIZE=false` outside throwaway local databases.
- Prefer migration jobs over app-startup migrations in deployed environments.
- Do not merge PRs or trigger production deploys without explicit user approval.
- Do not use destructive GCP, Firebase, Git, or database commands without explicit
  approval and a rollback path.
- Keep dev and production config separate.

## VS Code Tasks

Open the Command Palette and run:

```text
Tasks: Run Task
```

Useful tasks:

- `Nido: Agent Brief` prints this brief in the VS Code terminal.
- `Nido: Local Infra Gate` runs API and client builds.
- `Nido: API Focused Tests` runs core focused backend tests.
- `Nido: Smoke Dev API` verifies the deployed dev API.
- `Nido: Smoke Local API` verifies a running local API.
- `Nido: Recent Deploy Runs` lists recent deployment workflow runs.
- `Nido: Migration Show` checks TypeORM migration state for the configured database.

## First Improvement Backlog

Work through these in small PRs:

1. Commit and validate the migration-job deployment path.
2. Add production-only CORS enforcement through environment config.
3. Protect or intentionally publish Swagger/OpenAPI in production.
4. Add API rate limiting before public launch.
5. Add Firebase Hosting security headers.
6. Pin or alias production Secret Manager versions.
7. Protect `/health/deep` or reduce production detail.
8. Add deployment job summaries with revision, image, Firebase release, and smoke
   result.
9. Add Artifact Registry cleanup policy documentation or automation.
10. Add a production environment matrix with final project IDs and domains.

## Prompt To Use In VS Code Agent Chat

```text
Use developer-docs/catalog-operating-system/nido-infrastructure-agent.md as your
operating brief. Improve one small piece of Nido infrastructure production
readiness. Inspect the repo first, keep the patch narrow, run the relevant VS Code
task or npm command, and summarize changed files, verification, risk, and the next
recommended slice.
```
