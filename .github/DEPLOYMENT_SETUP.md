# Nido Dev Deployment Reference

This guide documents the Nido dev deployment pipeline for `ezvibes/nido-api`.
It is written as both an operating runbook and a reusable reference for deploying a
Node API to Cloud Run and a Vite frontend to Firebase Hosting from GitHub Actions
without long-lived Google Cloud keys.

Workflow file:

```text
.github/workflows/deploy-dev.yml
```

Environment config:

```text
.github/deploy/environments/dev.env
.github/deploy/environments/prod.env.example
```

Pull request validation workflow:

```text
.github/workflows/validate-deployment.yml
```

Hosting REST deploy helper:

```text
.github/scripts/deploy-firebase-hosting.mjs
```

## Executive Summary

The pipeline uses GitHub Actions as the deployment orchestrator, Google Cloud
Workload Identity Federation as the trust boundary, Cloud Run for the Nest API,
Cloud SQL for PostgreSQL, Secret Manager for runtime secrets, Artifact Registry
for container images, and Firebase Hosting for the Vue/Vite frontend.

Important design choices:

- GitHub Actions authenticates to Google Cloud with OIDC and Workload Identity Federation.
- No long-lived deploy service account JSON is stored in GitHub.
- API runtime secrets stay in Google Cloud Secret Manager.
- Vite variables are treated as public browser configuration.
- The API and frontend builds both pass before any deployment mutates dev infrastructure.
- The API deploy is verified before Firebase Hosting is released.
- Firebase Hosting is deployed through the Firebase Hosting REST API, not the Firebase CLI.
- The frontend deploy reads `firebase.json` so Hosting config stays reviewable and versioned.

Initial validation snapshot for this approach:

```text
Run: 28413924740
Branch: codex/firebase-hosting-wif-experiment
Commit: 02c6b98a573e01abde1ab27ee274395b5650ac5a
Result: success
Duration: 1m26s
```

## Architecture

```text
GitHub Actions
  |
  | OIDC token
  v
Google Workload Identity Federation
  |
  | impersonates
  v
github-deployer@nido-api-9ed65.iam.gserviceaccount.com
  |
  | pushes image, deploys service, gets short-lived OAuth token
  v
Artifact Registry + Cloud Run + Firebase Hosting REST API

Cloud Run runtime:
  nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com
  |
  | reads runtime secrets and connects to Cloud SQL
  v
Secret Manager + Cloud SQL
```

## Live Dev Resources

Project:

```text
nido-api-9ed65
```

Region:

```text
us-east1
```

Live URLs:

- Frontend: https://nido-api-9ed65.web.app
- Alternate frontend domain: https://nido-api-9ed65.firebaseapp.com
- API: https://nido-api-81555493719.us-east1.run.app
- Swagger UI: https://nido-api-81555493719.us-east1.run.app/api-docs
- OpenAPI JSON: https://nido-api-81555493719.us-east1.run.app/api-docs-json

Core resources:

```text
Cloud Run service: nido-api
Cloud SQL instance: nido-postgres-dev
Cloud SQL database: nido
Cloud SQL user: nido_api
Cloud SQL connection: nido-api-9ed65:us-east1:nido-postgres-dev
Artifact Registry repo: us-east1/nido
Firebase Hosting site: nido-api-9ed65
Runtime service account: nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com
Deploy service account: github-deployer@nido-api-9ed65.iam.gserviceaccount.com
```

Current dev runtime posture:

```text
DB_SYNCHRONIZE=false
RUN_MIGRATIONS=true
DB_MIGRATIONS_RUN=false
DB_MIGRATION_TRANSACTION_MODE=all
GEMINI_MODEL=gemini-2.5-flash
CONCERT_SYNC_GEMINI_ENABLED=false
CONCERT_SYNC_MAX_EVENTS_PER_JOB=25
```

Gemini extraction is intentionally disabled in the main dev deployment for now.
Sync Doctor and ingestion approval should use deterministic fallback behavior unless
`CONCERT_SYNC_GEMINI_ENABLED` is explicitly enabled for a targeted test. Keep the
`nido-gemini-api-key` secret available so Gemini can be tested without changing the
Secret Manager shape, but do not enable paid Gemini calls as the default dev deploy
behavior.

Admin ingestion approval currently publishes approved, future-dated flyer uploads
into the shared `/events` discovery feed. The frontend events page requests
`/concerts` with `startsAfter=<current time>`, so approved uploads whose event date
is in the past will not appear in the public events list.

## Pipeline Sequence

The `Deploy Dev` workflow runs on:

- pushes to `main`
- manual `workflow_dispatch`

The `Validate Deployment` workflow runs on:

- pull requests that touch deployment, API, or client build inputs
- manual `workflow_dispatch`

The job sequence is intentionally ordered to fail fast before expensive deploy work:

1. Check out the repository.
2. Load deployment settings from `.github/deploy/environments/<env>.env`.
3. Derive deployment values such as the Cloud SQL connection name and image tag.
4. Validate required GitHub repository variables and environment config.
5. Set up Node with npm cache for API and client lockfiles.
6. Install API dependencies with `npm ci`.
7. Install client dependencies with `npm ci --prefix client`.
8. Run focused API tests.
9. Build the API as a fast pre-Docker validation gate.
10. Authenticate to Google Cloud through Workload Identity Federation.
11. Install/configure `gcloud`.
12. Resolve the client API base URL if `VITE_API_BASE_URL` is not configured.
13. Build the client before mutating Cloud Run or Firebase Hosting.
14. Configure Docker for Artifact Registry.
15. Set up Docker Buildx.
16. Build and push a `linux/amd64` API container to Artifact Registry.
17. Run database migrations through a one-task Cloud Run Job when `RUN_MIGRATIONS=true`.
18. Deploy the API image to Cloud Run with app startup migrations disabled.
19. Resolve the deployed Cloud Run URL for health checks.
20. Verify `/health`, `/health/deep`, and `/api-docs-json`.
21. Deploy Firebase Hosting through the REST API.
22. Verify Firebase Hosting responds.

Why the frontend build happens before API deployment:

- A broken frontend build should stop the release before Cloud Run changes.
- If `VITE_API_BASE_URL` is not set, the workflow resolves the current Cloud Run service URL and injects it before building.
- The API deploy is still health-checked before Firebase Hosting is released, preventing a new UI from being published against an unhealthy API revision.

Why the Docker build happens after local API build/tests:

- Docker build/push is one of the slower stages.
- Local tests and API build catch common issues before pushing an image.
- The Dockerfile still builds the API independently, preserving image reproducibility.

## GitHub Actions Configuration

### Permissions

The job uses minimum required GitHub token permissions:

```yaml
permissions:
  contents: read
  id-token: write
```

`id-token: write` is required for GitHub OIDC. `contents: read` is enough for checkout.

### Concurrency

The workflow uses branch-aware concurrency:

```yaml
concurrency:
  group: deploy-dev-${{ github.ref }}
  cancel-in-progress: true
```

This cancels stale deploys for the same ref without letting an experiment branch cancel a
`main` deploy.

### Action Versions

The workflow should stay on current major versions of core actions to avoid runtime
deprecation warnings and receive maintained defaults:

```yaml
actions/checkout@v7
actions/setup-node@v6
google-github-actions/auth@v3
google-github-actions/setup-gcloud@v3
docker/setup-buildx-action@v4
docker/build-push-action@v7
```

### Docker Build Cache

Docker Buildx uses GitHub Actions cache:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

The first run may not be faster because it seeds the cache. Later runs can reuse
unchanged Docker layers.

## Authentication Model

### Workload Identity Federation

The workflow authenticates through Google Cloud Workload Identity Federation:

```yaml
- name: Authenticate to Google Cloud
  uses: google-github-actions/auth@v3
  with:
    workload_identity_provider: projects/81555493719/locations/global/workloadIdentityPools/github-pool/providers/github-provider
    service_account: github-deployer@nido-api-9ed65.iam.gserviceaccount.com
```

This lets GitHub Actions impersonate the deploy service account with short-lived
credentials. It avoids storing long-lived service account JSON in GitHub.

Do not add a `GCP_DEPLOY_SERVICE_ACCOUNT_JSON` secret unless the project intentionally
abandons WIF.

### Deploy Service Account

Deploy identity:

```text
github-deployer@nido-api-9ed65.iam.gserviceaccount.com
```

Required capabilities:

- Push Docker images to Artifact Registry.
- Deploy/update Cloud Run service `nido-api`.
- Act as the runtime service account for Cloud Run deploys.
- Deploy Firebase Hosting through the Firebase Hosting REST API.

Current role shape:

- `roles/artifactregistry.writer`
- `roles/run.admin`
- `roles/firebase.admin`
- `roles/iam.serviceAccountUser` on `nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com`

Hardening target:

- Replace broad project-level roles with resource-level grants where practical.
- Keep `roles/iam.serviceAccountUser` scoped to the runtime service account.
- Consider custom Firebase Hosting deploy permissions after the REST deploy path is stable.

### Runtime Service Account

Runtime identity:

```text
nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com
```

Required capabilities:

- Connect to Cloud SQL.
- Read required runtime secrets.
- Write ingestion objects to the dev GCS bucket.

Current role shape:

- `roles/cloudsql.client`
- `roles/secretmanager.secretAccessor`
- `roles/storage.objectAdmin` on `gs://nido-concert-image-ingestion-dev`

Hardening target:

- Scope Secret Manager access to specific secrets instead of project-wide access.
- Consider narrower storage permissions if ingestion only needs a subset of object operations.

## API Deployment

The API image tag is tied to the Git commit:

```text
us-east1-docker.pkg.dev/nido-api-9ed65/nido/nido-api:${GITHUB_SHA}
```

The workflow builds for Cloud Run's expected platform:

```yaml
platforms: linux/amd64
```

Cloud Run environment uses delimiter-based `--set-env-vars` syntax because several
values contain commas:

```bash
RUN_ENVS="^|^NODE_ENV=production|DB_HOST=/cloudsql/${SQL_CONNECTION}|..."
```

Cloud Run runtime secrets are mapped from Secret Manager:

```text
DB_PASSWORD=nido-db-password:latest
FIREBASE_PRIVATE_KEY=nido-firebase-private-key:latest
GEMINI_API_KEY=nido-gemini-api-key:latest
GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY=nido-google-calendar-private-key:latest
```

Runtime database posture:

```text
DB_SYNCHRONIZE=false
RUN_MIGRATIONS=true
DB_MIGRATIONS_RUN=false
DB_MIGRATION_TRANSACTION_MODE=all
```

Current API runtime env set by `.github/workflows/deploy-dev.yml`:

```text
NODE_ENV=production
DB_HOST=/cloudsql/nido-api-9ed65:us-east1:nido-postgres-dev
DB_PORT=5432
DB_USER=nido_api
DB_NAME=nido
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=false
DB_MIGRATION_TRANSACTION_MODE=all
FIREBASE_PROJECT_ID=nido-api-9ed65
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@nido-api-9ed65.iam.gserviceaccount.com
ADMIN_EMAILS=ezvibesinc@gmail.com
GCS_INGESTION_BUCKET=nido-concert-image-ingestion-dev
GEMINI_MODEL=gemini-2.5-flash
CONCERT_SYNC_GEMINI_ENABLED=false
CONCERT_SYNC_MAX_EVENTS_PER_JOB=25
GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL=sync-doctor-calendar@nido-api.iam.gserviceaccount.com
CORS_ORIGINS=https://nido-api-9ed65.web.app,https://nido-api-9ed65.firebaseapp.com,http://localhost:5173
```

Production hardening:

- Keep `DB_SYNCHRONIZE=false`.
- Prefer explicit migrations.
- Run migrations before service deployment through the migration job instead of
  letting every Cloud Run instance run migrations on startup.
- Keep `DB_MIGRATIONS_RUN=false` on the long-running API service.
- Verify migrations are idempotent, transactional, and logged.
- Keep Gemini disabled by default until extraction quality, cost, and quota behavior
  are ready for normal deploys.

## Environment Configuration

Deployment-specific runtime settings live in environment files under:

```text
.github/deploy/environments/
```

Current active environment:

```text
dev.env
```

Future production template:

```text
prod.env.example
```

The workflow loads the environment file selected by `DEPLOY_ENV`. Pushes to `main`
use `dev`; manual dispatch currently allows `dev`. When production infrastructure is
ready, add `prod.env`, add `prod` to the workflow dispatch options, and protect the
GitHub environment with required reviewers.

Environment files control:

- Project, region, Cloud Run service, migration job, Artifact Registry repo.
- Cloud SQL instance, database name, database user.
- Runtime service account.
- Cloud Run CPU, memory, concurrency, timeout, and scaling.
- Whether migrations run during deploy with `RUN_MIGRATIONS`.
- Whether the app may run migrations on startup with `DB_MIGRATIONS_RUN`.
- Secret Manager secret references.
- CORS, admin allowlist, ingestion bucket, Gemini, and calendar settings.

Migration policy:

```text
RUN_MIGRATIONS=true
DB_MIGRATIONS_RUN=false
```

`RUN_MIGRATIONS=true` means GitHub Actions executes a one-task Cloud Run Job from the
new image before deploying the API service. `DB_MIGRATIONS_RUN=false` keeps the API
service from racing migrations across multiple Cloud Run instances or revisions.

Use `DB_MIGRATION_TRANSACTION_MODE=all` by default. Use `each` only when a migration
set contains statements that cannot share one transaction. Use `none` only after a
specific migration has been reviewed for non-transactional DDL.

### Migration Job Deployment Mechanics

The deploy workflow now treats migrations as a deployment phase, not an API startup
side effect.

The flow is:

1. Build and push the new API image.
2. If `RUN_MIGRATIONS=true`, deploy and execute the Cloud Run Job named by
   `MIGRATION_JOB`.
3. The job uses the same image, Cloud SQL instance, runtime service account,
   non-secret env, and Secret Manager bindings as the API service.
4. The job runs:

   ```bash
   node dist/scripts/run-migrations.js
   ```

5. The job runs with:

   ```text
   tasks=1
   parallelism=1
   max-retries=0
   task-timeout=10m
   ```

6. If the migration job fails, the workflow stops before deploying the long-running
   API service.
7. The API service is then deployed with `DB_MIGRATIONS_RUN=false`.

Why this matters:

- Only one migration process touches the database during deployment.
- Cloud Run service cold starts do not race each other to run migrations.
- Migration logs are isolated in the Cloud Run Job execution.
- Future production approval can review `RUN_MIGRATIONS`, transaction mode, and
  target database independently from application runtime settings.

Operational checks after a migration-job deploy:

```bash
gcloud run jobs executions list \
  --job nido-api-migrations \
  --project nido-api-9ed65 \
  --region us-east1

gcloud run services describe nido-api \
  --project nido-api-9ed65 \
  --region us-east1 \
  --format 'value(spec.template.spec.containers[0].env)'
```

Expected API service posture after this enhancement:

```text
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=false
```

If a migration deploy fails:

- Do not manually deploy the API service unless the migration failure is understood.
- Review the Cloud Run Job execution logs.
- If the failed migration partially changed data or schema, use the database rollback
  decision tree before rerunning.
- Prefer a forward-fix migration over an ad hoc manual database edit.

## Firebase Hosting REST Deployment

The CI path intentionally does not use:

- Firebase CLI
- `FIREBASE_TOKEN`
- `firebase login:ci`
- service account JSON secrets

Reason:

- Firebase CLI auth failed in GitHub Actions with WIF-generated external credentials.
- `FIREBASE_TOKEN` is deprecated by Firebase CLI.
- REST deployment can use the same short-lived OAuth access token that already works for GCP calls.

The workflow gets a token after WIF authentication:

```bash
FIREBASE_ACCESS_TOKEN="$(gcloud auth print-access-token)" \
  node .github/scripts/deploy-firebase-hosting.mjs
```

The REST deploy script performs the Firebase Hosting API sequence:

1. Read `firebase.json`.
2. Resolve the Hosting public directory.
3. Convert supported Hosting config into REST API config.
4. Apply `firebase.json` Hosting ignore patterns to the public directory.
5. Gzip every static file and compute SHA-256 hashes.
6. Create a Hosting version.
7. Call `:populateFiles` with the file manifest in bounded batches.
8. Upload only hashes Firebase reports as missing for each returned upload URL.
9. Finalize the Hosting version with config.
10. Release the version to the `live` channel.

Current supported Hosting config:

- `public`
- `ignore`
- destination `rewrites`
- `redirects`
- `headers`
- `source`, `glob`, or `regex` patterns

Current project config:

```json
{
  "hosting": {
    "public": "client/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Dry-run validation:

```bash
FIREBASE_HOSTING_DRY_RUN=true node .github/scripts/deploy-firebase-hosting.mjs
```

Expected output shape:

```text
Preparing Firebase Hosting deploy for site nido-api-9ed65.
Found 4 file(s) in client/dist.
Applied 3 firebase.json ignore pattern(s).
Prepared 4 Hosting manifest entrie(s).
Dry run complete. No Firebase Hosting version was created.
```

## GitHub Repository Variables

Use GitHub repository variables for browser-visible build configuration.

Required:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_ADMIN_EMAILS
```

Recommended optional:

```text
VITE_API_BASE_URL
CORS_ORIGINS
```

If `VITE_API_BASE_URL` is omitted, the workflow resolves the deployed Cloud Run URL and
sets it before the client build.

Default CORS origins:

```text
https://nido-api-9ed65.web.app,https://nido-api-9ed65.firebaseapp.com,http://localhost:5173
```

Set variables with GitHub CLI:

```bash
gh variable set VITE_API_BASE_URL --body "https://nido-api-81555493719.us-east1.run.app"
gh variable set CORS_ORIGINS --body "https://nido-api-9ed65.web.app,https://nido-api-9ed65.firebaseapp.com,http://localhost:5173"
gh variable set VITE_ADMIN_EMAILS --body "ezvibesinc@gmail.com"
gh variable set VITE_FIREBASE_AUTH_DOMAIN --body "nido-api-9ed65.firebaseapp.com"
gh variable set VITE_FIREBASE_PROJECT_ID --body "nido-api-9ed65"
gh variable set VITE_FIREBASE_STORAGE_BUCKET --body "nido-api-9ed65.appspot.com"
```

Set these from the Firebase Web App config:

```bash
gh variable set VITE_FIREBASE_API_KEY --body "<firebase-web-api-key>"
gh variable set VITE_FIREBASE_MESSAGING_SENDER_ID --body "<firebase-messaging-sender-id>"
gh variable set VITE_FIREBASE_APP_ID --body "<firebase-web-app-id>"
```

GitHub UI path:

```text
Settings -> Secrets and variables -> Actions -> Variables
```

Do not put private keys, database passwords, Firebase Admin credentials, or Gemini keys
in GitHub variables. Vite variables are browser-visible after build.

## Secret Manager

Sensitive backend values remain in Google Cloud Secret Manager:

```text
nido-db-password
nido-firebase-private-key
nido-gemini-api-key
nido-google-calendar-private-key
```

Do not store these in GitHub Actions secrets unless there is a clear, reviewed reason.
The deployed Cloud Run service reads them at runtime through Secret Manager bindings.
The Gemini secret can stay configured while `CONCERT_SYNC_GEMINI_ENABLED=false`; the
service will use fallback extraction and report `fallbackReason=gemini_disabled`.

## First-Time Setup Checklist

1. Confirm required Google APIs are enabled:
   - Cloud Run API
   - Artifact Registry API
   - Cloud SQL Admin API
   - Secret Manager API
   - Firebase Hosting API
2. Confirm Artifact Registry repo exists:
   - `us-east1/nido`
3. Confirm Cloud SQL instance and database exist:
   - `nido-postgres-dev`
   - `nido`
4. Confirm runtime service account exists.
5. Confirm deploy service account exists.
6. Confirm Workload Identity Pool and provider are configured for `ezvibes/nido-api`.
7. Confirm deploy service account IAM roles.
8. Confirm runtime service account IAM roles.
9. Confirm required Secret Manager secrets and versions.
10. Confirm GitHub repository variables.
11. Confirm `Validate Deployment` is green on the pull request.
12. Run `Deploy Dev` manually from the experiment branch when validating deployment changes.
13. Merge only after validation and any required manual deploy run are green.

## Routine Deploy Checklist

Before merge:

```bash
npm test -- user.service health.service concert-sync
npm run build
npm run build --prefix client
FIREBASE_HOSTING_DRY_RUN=true node .github/scripts/deploy-firebase-hosting.mjs
```

After merge or manual dispatch, confirm these GitHub Actions steps pass:

- Validate deploy configuration
- Run focused API tests
- Build API
- Authenticate to Google Cloud
- Resolve client API base URL
- Build client
- Build and push API container
- Deploy API to Cloud Run
- Resolve deployed Cloud Run API URL
- Verify API health
- Deploy Firebase Hosting
- Verify Firebase Hosting

Live smoke checks:

```bash
curl -fsS https://nido-api-81555493719.us-east1.run.app/health
curl -fsS https://nido-api-81555493719.us-east1.run.app/health/deep
curl -fsS https://nido-api-81555493719.us-east1.run.app/api-docs-json >/dev/null
curl -fsSI https://nido-api-9ed65.web.app >/dev/null
```

Admin approval smoke test:

1. Sign in to `https://nido-api-9ed65.web.app` as an email listed in both
   `ADMIN_EMAILS` and `VITE_ADMIN_EMAILS`.
2. Upload a flyer through the public Events intake.
3. Open `/admin/ingestion/uploads`.
4. Select the uploaded flyer, choose `Approve`, and fill a future date/time.
5. Click `Approve and publish`.
6. Confirm the modal closes and the row reloads with approved status.
7. Open `/events` and confirm the approved future show appears in the public list.
8. If the show does not appear, verify the event date is future-dated because the
   Events page filters with `startsAfter=<current time>`.

## Troubleshooting

### GitHub Actions Fails Before Google Auth

Likely causes:

- Missing repository variables.
- Invalid workflow syntax.
- npm install failure.
- focused test failure.

The `Validate deploy configuration` step should catch missing frontend variables before
Docker/GCP work begins.

### WIF Authentication Fails

Check:

- `permissions.id-token` is set to `write`.
- Repository owner/name matches the WIF provider attribute condition.
- The deploy service account allows impersonation from the GitHub principal set.
- `workload_identity_provider` points at the correct project number, pool, and provider.

### Docker Push Fails

Check:

- `gcloud auth configure-docker "${REGION}-docker.pkg.dev"` ran successfully.
- Deploy service account can write to the Artifact Registry repo.
- Image path uses the correct project, region, repo, and service name.

### Cloud Run Deploy Fails

Check:

- Deploy service account has Cloud Run deploy permissions.
- Deploy service account has `iam.serviceAccountUser` on the runtime service account.
- Runtime service account exists.
- Secret names referenced by `--set-secrets` exist.
- Cloud SQL connection name is correct.

### API Health Fails After Deploy

Check:

- Cloud Run logs for Nest startup errors.
- TypeORM migration output.
- Cloud SQL connectivity.
- Secret Manager access denials.
- Migration job failures when `RUN_MIGRATIONS=true`, or app-startup migration
  failures if an environment intentionally sets `DB_MIGRATIONS_RUN=true`.

### Firebase Hosting REST Deploy Fails

Check:

- `gcloud auth print-access-token` succeeds after WIF auth.
- Deploy service account has Firebase Hosting deployment permissions.
- Firebase Hosting API is enabled.
- `firebase.json` only uses Hosting config supported by `.github/scripts/deploy-firebase-hosting.mjs`.
- `client/dist` exists and contains built files.

If the API returns a JSON error, the REST deploy script prints the HTTP status and response
body. That is the primary diagnostic artifact.

### Firebase Hosting Verifies But UI Looks Stale

Check:

- The client build ran after `VITE_API_BASE_URL` was resolved.
- Browser cache or service worker is not serving an old asset.
- The Hosting release in Firebase console points at the latest version.
- `client/dist/index.html` includes the build timestamp comment appended by the workflow.

## Audit Findings And Current Posture

What is strong:

- WIF avoids long-lived deploy keys.
- Runtime secrets are in Secret Manager, not GitHub.
- API and client builds gate deployment before infrastructure changes.
- API deploy is health-checked before Firebase Hosting release.
- Docker images are commit-addressable by SHA.
- Branch-aware concurrency prevents experiment runs from canceling `main`.
- REST Hosting deploy avoids deprecated Firebase token flows.
- Pull request validation covers API tests, API build, client build, and Hosting REST dry-run.
- Local dry-run covers Hosting config parsing, ignore handling, and manifest generation.

What should be hardened next:

- Scope Secret Manager access to specific secrets.
- Replace broad Firebase Admin deploy permission with narrower custom permissions if practical.
- Add a full smoke-test script that checks authenticated flows when a test token is available.
- Add Artifact Registry cleanup policy for old SHA images.
- Add Cloud Run revision retention/cost review to the monthly runbook.

## Source References

- Firebase Hosting REST API deployment guide: https://firebase.google.com/docs/hosting/api-deploy
- Firebase CLI reference and CI auth context: https://firebase.google.com/docs/cli
- Google GitHub Actions auth action: https://github.com/google-github-actions/auth
- Google GitHub Actions setup-gcloud action: https://github.com/google-github-actions/setup-gcloud
- GitHub Actions OIDC security hardening: https://docs.github.com/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect
- GitHub Actions workflow syntax and permissions: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions
- Docker Buildx GitHub Actions cache: https://docs.docker.com/build/ci/github-actions/cache/
- Cloud Run deploy with gcloud: https://cloud.google.com/run/docs/deploying
- Cloud Run service identity: https://cloud.google.com/run/docs/securing/service-identity
