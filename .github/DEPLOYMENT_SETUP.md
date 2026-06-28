# Dev Deployment GitHub Configuration

This file documents the GitHub repository secret and variables required by:

```text
.github/workflows/deploy-dev.yml
```

The workflow deploys the API to Cloud Run and the frontend to Firebase Hosting after a merge to `main`, or manually through `workflow_dispatch`.

## GitHub Authentication (Workload Identity Federation)

We use **Workload Identity Federation (WIF)** to securely authenticate the GitHub Actions pipeline with Google Cloud without using long-lived JSON key secrets.

The pipeline automatically connects using the OIDC provider:
* **Workload Identity Provider**: `projects/81555493719/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
* **Deploy Service Account**: `github-deployer@nido-api-9ed65.iam.gserviceaccount.com`

This setup allows the repository `ezvibes/nido-api` to assume the `github-deployer` service account to run the build and deploy.

### Required Deploy-Time Permissions

The `github-deployer` service account is already configured with the following roles in project `nido-api-9ed65`:

- **Artifact Registry Writer** (`roles/artifactregistry.writer`) - to push Docker containers.
- **Cloud Run Admin** (`roles/run.admin`) - to deploy/update the API service.
- **Firebase Admin** (`roles/firebase.admin`) - to deploy resources to Firebase Hosting.
- **Service Account User** (`roles/iam.serviceAccountUser`) on `nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com` - to deploy Cloud Run using that identity.

### Secret Manager Config

Sensitive credentials remain stored in GCP Secret Manager. Do not store these in GitHub:

- `nido-db-password`
- `nido-firebase-private-key`
- `nido-gemini-api-key`
- `nido-google-calendar-private-key`

If you ever need to create or regenerate the WIF pool or provider, you can run the automated script in the repository:
```bash
./setup-gcp-permissions.sh
```

---

## Required GitHub Variables

Use `.github/deploy-dev.env.example` as the source of truth for variable names.

Required variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_ADMIN_EMAILS
```

Recommended optional variables:

```text
VITE_API_BASE_URL
CORS_ORIGINS
```

If `VITE_API_BASE_URL` is omitted, the workflow resolves the Cloud Run URL after the API deploy and uses that URL for the frontend build.

If `CORS_ORIGINS` is omitted, the workflow defaults to:

```text
https://nido-api-9ed65.web.app,https://nido-api-9ed65.firebaseapp.com,http://localhost:5173
```

### Set Variables With GitHub CLI

```bash
gh variable set VITE_API_BASE_URL --body "https://nido-api-81555493719.us-east1.run.app"
gh variable set CORS_ORIGINS --body "https://nido-api-9ed65.web.app,https://nido-api-9ed65.firebaseapp.com,http://localhost:5173"
gh variable set VITE_ADMIN_EMAILS --body "ezvibesinc@gmail.com"
gh variable set VITE_FIREBASE_AUTH_DOMAIN --body "nido-api-9ed65.firebaseapp.com"
gh variable set VITE_FIREBASE_PROJECT_ID --body "nido-api-9ed65"
gh variable set VITE_FIREBASE_STORAGE_BUCKET --body "nido-api-9ed65.firebasestorage.app"
```

Set these from the Firebase Web App config:

```bash
gh variable set VITE_FIREBASE_API_KEY --body "<firebase-web-api-key>"
gh variable set VITE_FIREBASE_MESSAGING_SENDER_ID --body "<firebase-messaging-sender-id>"
gh variable set VITE_FIREBASE_APP_ID --body "<firebase-web-app-id>"
```

## GitHub UI Path

Repository:

```text
Settings -> Secrets and variables -> Actions
```

Use:

- `Secrets` tab for `GCP_DEPLOY_SERVICE_ACCOUNT_JSON`
- `Variables` tab for all `VITE_*` values and `CORS_ORIGINS`

## First Run

After the PR is merged and config is set:

1. Open GitHub Actions.
2. Select `Deploy Dev`.
3. Run manually once with `workflow_dispatch`, or push/merge to `main`.
4. Confirm these steps pass:
   - API tests
   - API build
   - Docker build/push
   - Cloud Run deploy
   - `/health`
   - `/health/deep`
   - `/api-docs-json`
   - client build
   - Firebase Hosting deploy

## Live Dev URLs

- Frontend: https://nido-api-9ed65.web.app
- API: https://nido-api-81555493719.us-east1.run.app
- Swagger: https://nido-api-81555493719.us-east1.run.app/api-docs
