---
name: nido-deploy
description: >-
  Expert operational runbook and safety guide for Nido's GitHub Actions and Terraform CI/CD pipeline.
  Activate when modifying terraform/ files, updating .github/workflows/deploy-dev.yml,
  debugging failed deployment runs on Cloud Run, inspecting remote GCS Terraform state,
  running speculative plan validations, diagnosing database migration job failures,
  inspecting GCP/Firebase health, or executing emergency Cloud Run revision rollbacks.
---

# Nido DevOps: GitHub Actions & Terraform Deployment Runbook

## 1. System Architecture: The Division of Labor

Nido enforces a strict operational separation between pipeline orchestration and declarative infrastructure authority:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                GITHUB ACTIONS (The Orchestrator)                       │
│  - Pipeline lifecycle trigger (Push to `main` / `workflow_dispatch`)                   │
│  - Executes pre-flight test suites (Jest API tests, Vitest client tests, harness)      │
│  - Builds & pushes multi-arch Docker container to GCP Artifact Registry                │
│  - Captures immutable image digest (`@sha256:...`)                                     │
│  - Executes database migrations via ephemeral Cloud Run Jobs over VPC                  │
│  - Deploys static SPA to Firebase Hosting with CDN cache invalidation                  │
│  - Runs post-deploy curl probes and live catalog smoke tests                           │
└─────────────────────────────────────────┬──────────────────────────────────────────────┘
                                          │ Passes Immutable Container Digest
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                TERRAFORM (The Infrastructure Authority)                │
│  - Maintains declarative state in remote GCS bucket (`nido-api-9ed65-tfstate-dev`)     │
│  - Authoritative source for Cloud Run service specs (CPU, RAM, concurrency, VPC, env)  │
│  - Strict Pre-Apply Gate: Rejects any plan that modifies anything EXCEPT the image      │
│  - Rolls out zero-downtime Cloud Run revision and atomically shifts 100% traffic       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 9 Deterministic Deployment Stages

Whenever code merges to `main`, `.github/workflows/deploy-dev.yml` executes in this exact sequence:

1. **Pre-Flight Gates:** `npm ci`, API unit tests (`jest --runInBand`), offline newsletter harness (`test:newsletter:harness`), client tests (`npm test --prefix client`), and compilation (`nest build`).
2. **Keyless Cloud Auth (WIF):** Authenticates via Workload Identity Federation (`github-deployer@nido-api-9ed65.iam.gserviceaccount.com`). Zero static keys in GitHub.
3. **Client URL Binding & SPA Build:** Resolves the live Cloud Run URL, injects into `VITE_API_BASE_URL`, and compiles via `vue-tsc -b && vite build`.
4. **Docker Multi-Arch Build & Push:** Builds `linux/amd64` container, pushes to GCP Artifact Registry (`us-east1-docker.pkg.dev/.../nido-api:${GITHUB_SHA}`), and outputs immutable sha256 digest (`IMAGE_DIGEST`).
5. **Terraform Plan & Guardrail Gate:** Renders variables via `render-terraform-vars.mjs`, runs speculative `terraform plan -out=tfplan`, and evaluates plan with `validate-terraform-plan.mjs`. **Aborts if any resource other than the image changes.**
6. **Zero-Downtime Database Migration Job:** Runs Cloud Run Job `nido-api-migrations` over VPC connector directly to Cloud SQL (`nido-postgres-dev`) in single-transaction mode (`--execute-now --wait`).
7. **Terraform Apply (Cloud Run Rollout):** Applies the validated `tfplan` to `google_cloud_run_v2_service.nido_api`. Cloud Run warms instances and shifts 100% traffic with zero downtime.
8. **Live Smoke Verification Gate:** Probes `/health`, `/health/deep` (Postgres, Firebase, GCS, Gemini, Calendar), `/api-docs-json`, and `scripts/smoke-test-api.mjs`.
9. **Firebase Hosting CDN Deploy:** Deploys SPA assets via `deploy-firebase-hosting.mjs` and invalidates global edge caches on `https://${FIREBASE_PROJECT_ID}.web.app`.

---

## 3. Local Pre-Flight & Speculative Plan Testing

Before opening a PR that modifies `terraform/` or deployment workflows, execute these checks locally:

### A. Run Terraform Config Unit Test
```bash
npm run test:terraform-config
```
Verifies `.github/deploy/environments/dev.env` aligns with Terraform module inputs.

### B. Validate Speculative Terraform Plan (Dry-Run Guardrail)
To test how Terraform evaluates an image update without touching production:
```bash
# 1. Render variables to temporary location
node .github/scripts/render-terraform-vars.mjs /tmp/test-vars.json

# 2. Generate speculative plan
terraform -chdir=terraform plan \
  -input=false \
  -var-file=/tmp/test-vars.json \
  -out=/tmp/test.tfplan

# 3. Test through the drift validator
terraform -chdir=terraform show -json /tmp/test.tfplan | \
  node .github/scripts/validate-terraform-plan.mjs "us-east1-docker.pkg.dev/nido-api-9ed65/nido/nido-api:test"
```
*Expected Output:* `Terraform plan changes only the API image or is a no-op.`

---

## 4. Operational Health & Diagnostics

### A. Automated GCP & Deployment Health Check
Run the bundled diagnostic health script to inspect GitHub runs, Cloud Run revisions, Cloud SQL, and live endpoints (`/health`, `/health/deep`, `/concerts/meta/genres`, Firebase Hosting) in one shot:
```bash
# From inside the nido-api repo:
./.agents/skills/nido-deploy/scripts/check_gcp_health.sh

# Or from any workspace (e.g. Nido Agents) via the global skill path:
~/.gemini/config/skills/nido-deploy/scripts/check_gcp_health.sh
```

### B. Pre-Merge & Post-Merge Deployment Tracking Protocol
Whenever an approved PR is merged to `main`, execute this 3-step verification sequence:
```bash
# 1. Capture the pre-deploy Cloud Run revision as your rollback target BEFORE or as the run starts
gcloud run services describe nido-api --project nido-api-9ed65 --region us-east1 --format="value(status.latestReadyRevisionName)"

# 2. Identify and watch the triggered Deploy Dev run to completion
gh run list --repo ezvibes/nido-api --workflow "Deploy Dev" --limit 1 --json databaseId,status,headSha,url
gh run watch <run-id> --repo ezvibes/nido-api --exit-status

# 3. Verify the new Cloud Run revision, Cloud SQL state, and live endpoints
./.agents/skills/nido-deploy/scripts/check_gcp_health.sh
```

### C. Focused Operational Commands
Use these read-only patterns to inspect live state:
```bash
# Check recent GitHub Actions runs
gh run list --repo ezvibes/nido-api --limit 5
gh run view <run-id> --log-failed --repo ezvibes/nido-api

# Inspect Cloud Run service status and recent warnings
gcloud run services describe nido-api --project nido-api-9ed65 --region us-east1
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=nido-api AND severity>=WARNING" --limit 10 --project nido-api-9ed65

# Inspect Cloud SQL status
gcloud sql instances describe nido-postgres-dev --project nido-api-9ed65
```

---

## 5. Triage Runbook: Debugging CI/CD Failures

When a GitHub Actions run fails on `deploy-dev.yml`, use this diagnostic matrix:

### Case 1: `validate-terraform-plan.mjs` Fails with "Unexpected resource change"
* **Symptom:** CI aborts at Stage 5: *"Plan contains unexpected modifications to resource: [ResourceName]"*.
* **Root Cause:** A change in `terraform/` altered infrastructure parameters (e.g. CPU, RAM, environment variables, or VPC network). The continuous delivery pipeline **intentionally blocks** all non-image infrastructure changes.
* **Resolution:** 
  1. Inspect the plan diff output in the GitHub Actions log.
  2. If the infrastructure change is intentional (e.g. scaling Cloud Run memory), it must be applied via a designated infrastructure update workflow or manual peer-reviewed apply, keeping CD strictly scoped to image bumps.

### Case 2: Database Migration Job Fails at Stage 6
* **Symptom:** Cloud Run Job `nido-api-migrations` returns non-zero exit code or times out.
* **Root Cause:** Migration syntax error, lock contention, or schema conflict.
* **Safety Net:** Because migrations run in single-transaction mode (`DB_MIGRATION_TRANSACTION_MODE=all`), the migration automatically rolls back in PostgreSQL. **The Cloud Run service is NOT updated**, leaving the existing stable revision serving traffic.
* **Resolution:**
  1. Run `gcloud run jobs executions logs [EXECUTION_NAME] --project nido-api-9ed65 --region us-east1`.
  2. Fix the failing migration file locally, test with local Postgres, and push a patch.

### Case 3: Live Smoke Gate Fails at Stage 8 (`/health/deep`) or Gemini Extraction Fails (HTTP 404 `NOT_FOUND`)
* **Symptom:** `curl /health/deep` returns 500 or degraded status, or poster OCR fails with `models/gemini-2.5-flash is no longer available to new users`.
* **Resolution:** Inspect the JSON output payload:
  * `checks.database.connected == false`: Cloud SQL connection pool or VPC connector issue.
  * `checks.firebase.initialized == false`: Secret Manager secret `nido-firebase-private-key` inaccessible.
  * `checks.gemini.apiKeyConfigured == false`: Secret Manager secret `nido-gemini-api-key` missing.
  * `checks.gemini.modelRetired == true`: A retired Gemini model (`gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash`) is configured. Always use an active, cost-efficient Flash model (`gemini-3.8-flash` or `gemini-3.6-flash` with `thinkingBudget: 256` so OCR costs stay at ~\$0.0002/poster) and never hardcode retired model strings in adapters.

---

## 6. Emergency Rollback Procedure

If a deployed revision introduces a runtime application regression:

### A. Instant Cloud Run Revision Traffic Rollback (Zero-Downtime)
Cloud Run maintains previous revisions warmed and ready. To rollback traffic immediately without waiting for a CI/CD build:
```bash
# 1. List recent revisions
gcloud run revisions list \
  --service nido-api \
  --project nido-api-9ed65 \
  --region us-east1 \
  --format="table(name,creationTimestamp,active)"

# 2. Shift 100% of traffic to the previous known-healthy revision
gcloud run services update-traffic nido-api \
  --project nido-api-9ed65 \
  --region us-east1 \
  --to-revisions [PREVIOUS_REVISION_NAME]=100
```

### B. Git Revert for Pipeline Synchronization
Immediately revert the commit on `main` and push to trigger a clean, declarative rollout through CI:
```bash
git revert [BAD_COMMIT_SHA] -m 1
git push origin main
```

---

## 7. Cost & Cloud Hygiene Checklist

Regularly inspect:
- **Cloud Run:** Keep min-instances at 0 for dev (`scale-to-zero`); monitor concurrency and prune stopped old revisions.
- **Cloud SQL:** Monitor storage auto-increase and backup retention.
- **Artifact Registry:** Prune untagged intermediate Docker layers and old commit images.
- **Secret Manager:** Clean up disabled secret versions and avoid secret sprawl.

---

## 8. Non-Negotiable Invariants & Guardrails
- 🚫 **NEVER run `terraform apply -auto-approve`** directly against production from a developer terminal. Always use speculative plans and remote state locks.
- 🚫 **NEVER commit secrets or static service account JSON keys.** Workload Identity Federation and GCP Secret Manager are mandatory.
- 🚫 **NEVER bypass single-transaction migration mode.** All database schema mutations must support complete atomic rollback.
