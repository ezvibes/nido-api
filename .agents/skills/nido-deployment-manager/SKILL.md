---
name: nido-deployment-manager
description: Use for Nido deployment readiness, GitHub Actions deploy checks, Cloud Run, Firebase Hosting, Cloud SQL, Secret Manager, IAM, rollback, observability, cost control, and production hardening.
---

# Nido Deployment Manager

Own release readiness and cloud operations for the `nido-api` project. This skill
combines the previous Nido deployment brief and GCP deployment manager into one
canonical deployment and operations workflow.

## Scope

Use this skill for:

- GitHub Actions deployment pipeline inspection.
- Cloud Run, Firebase Hosting, Cloud SQL, Secret Manager, GCS, and IAM work.
- Release readiness reviews before merge or deploy.
- Post-deploy smoke tests and log review.
- Rollback planning and incident response.
- Cost and production-hardening recommendations.

Do not merge PRs, trigger production deployments, delete resources, rotate
secrets, change IAM, or run destructive database/GCP/Firebase commands without
explicit maintainer approval and a rollback path.

## Current Architecture

| Component | Current Target | Purpose |
| --- | --- | --- |
| GCP project | `nido-api-9ed65` | Central Google Cloud project |
| Region | `us-east1` | Primary deployment region |
| API service | Cloud Run `nido-api` | Stateless NestJS API |
| API URL | `https://nido-api-81555493719.us-east1.run.app` | Cloud Run ingress |
| Database | Cloud SQL `nido-postgres-dev` | PostgreSQL catalog |
| Web host | Firebase Hosting `nido-api-9ed65` | Vue admin/public SPA host |
| Deploy workflow | `.github/workflows/deploy-dev.yml` | Build, migration, deploy |
| GitHub deploy identity | `github-deployer@nido-api-9ed65.iam.gserviceaccount.com` | OIDC deploy service account |

Treat this table as current-state context, not permission to mutate resources.
Verify live values before making operational recommendations.

## Default Workflow

1. Inspect branch and working tree. Preserve unrelated work.
2. Identify deployment impact: API, client, migration, env, IAM, secrets, cost,
   observability, rollback.
3. Read the relevant source before editing:
   - `.github/workflows/deploy-dev.yml`
   - `.github/deploy/environments/dev.env`
   - `.github/deploy/environments/prod.env.example`
   - `.github/DEPLOYMENT_SETUP.md`
   - `.github/TESTING_WORKFLOW.md`
   - `developer-docs/deployment-pipeline.md`
4. Run focused validation first; run `npm run agent:gate` before handoff unless
   the task is documentation-only and the reason is stated.
5. For live verification, inspect GitHub Actions, Cloud Run revision health,
   Firebase Hosting, Cloud SQL status, and warning/error logs.
6. Report changed files, validation evidence, deployment impact, remaining risk,
   and rollback target.

## Health Check Script

For a broad dev-environment health inspection, run:

```bash
./.agents/skills/nido-deployment-manager/scripts/check_gcp_health.sh
```

The script checks recent GitHub deploy runs, Cloud Run status, Cloud SQL status,
live `/health`, public genre metadata, Firebase Hosting, and recent Cloud Run
warnings/errors.

## Operational Commands

Use these as read-only inspection patterns unless the user explicitly authorizes
mutation.

```bash
gh run list --repo ezvibes/nido-api --limit 5
gh run view <run-id> --repo ezvibes/nido-api
gh run view <run-id> --log-failed --repo ezvibes/nido-api
```

```bash
gcloud run services describe nido-api \
  --project nido-api-9ed65 \
  --region us-east1

gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=nido-api AND severity>=WARNING" \
  --limit 20 \
  --project nido-api-9ed65

gcloud sql instances describe nido-postgres-dev \
  --project nido-api-9ed65

gcloud secrets list --project nido-api-9ed65
```

## Safety Rules

- Do not print secret values.
- Treat `VITE_*` values as public browser config, not backend secrets.
- Keep backend secrets in Secret Manager.
- Keep dev and production configuration separate.
- Keep `DB_SYNCHRONIZE=false` outside throwaway local databases.
- Prefer explicit migration jobs over app-startup migrations in deployed
  environments.
- Prefer `--env-vars-file` or explicit config files over one-off Cloud Run env
  edits that can drop existing variables.
- Do not use `:latest` for production rollback-sensitive secrets unless the
  decision is explicit and documented.
- Verify `gh auth status` before remote GitHub write actions when local auth may
  switch between `ezvibes` and contributor accounts.

## Rollback Playbook

For a bad Cloud Run deploy:

```bash
gcloud run revisions list \
  --service nido-api \
  --project nido-api-9ed65 \
  --region us-east1

gcloud run services update-traffic nido-api \
  --to-revisions=<PREVIOUS_REVISION_NAME>=100 \
  --project nido-api-9ed65 \
  --region us-east1
```

For migration-related incidents, identify the exact migration and data impact
before running `npm run migration:revert`. Do not revert production migrations
without maintainer approval.

After rollback, rerun the health check script and record the revision, symptom,
fix, and follow-up prevention task.

## Cost Checks

Regularly inspect:

- Cloud Run min/max instances, concurrency, CPU, memory, and old revision count.
- Cloud SQL tier, storage growth, backups, and idle usage.
- Artifact Registry image accumulation.
- Secret sprawl and disabled secret versions.
- Whether dev-only resources can stay scale-to-zero.

Prefer the smallest reversible improvement that increases production readiness.
