# Deployment Overview

This repository is designed for a lightweight but production-minded deployment path using GitHub Actions, Google Cloud Platform, and Firebase Hosting.

The public goal is simple: every reviewed merge to `main` should be buildable, deployable, and traceable without storing long-lived cloud credentials in the repo.

## High-level Architecture

```text
GitHub Pull Request
  -> validation workflow
  -> reviewed merge to main
  -> dev deployment workflow
  -> Cloud Run API + Firebase Hosting client
```

Runtime platform:

- GitHub Actions orchestrates validation and deployment.
- Google Workload Identity Federation lets GitHub Actions authenticate to GCP without committed service account keys.
- Artifact Registry stores the API container image.
- Cloud Run runs the NestJS API.
- Cloud SQL provides PostgreSQL.
- Secret Manager stores runtime secrets.
- Firebase Hosting serves the Vue/Vite client.
- Google Cloud Storage stores ingestion upload assets.

## Pull Request Validation

Pull requests that touch API, client, deployment, or infrastructure-sensitive files run the deployment validation workflow:

```text
.github/workflows/validate-deployment.yml
```

The validation path installs dependencies, runs focused backend tests, builds the API, builds the client, and dry-runs the Firebase Hosting deploy helper.

All pull requests also run a lightweight public repo hygiene workflow:

```text
.github/workflows/pr-hygiene.yml
```

That workflow checks for accidentally tracked local secret files and whitespace errors.

Contributors should still run focused checks locally before opening a PR. The workflow is a safety net, not a replacement for local validation.

## Main Branch Deployment

Merges to `main` trigger the dev deployment workflow:

```text
.github/workflows/deploy-dev.yml
```

That workflow:

- Loads reviewed environment config from `.github/deploy/environments/dev.env`.
- Builds the API and client.
- Authenticates to GCP through Workload Identity Federation.
- Builds and pushes a Cloud Run container image.
- Runs database migrations through a one-shot Cloud Run job when configured.
- Deploys the API to Cloud Run.
- Verifies API health.
- Deploys the client to Firebase Hosting.

## Secrets And Runtime Config

Secrets should not be committed to the repository.

Use:

- Local `.env` files for local-only development.
- GitHub repository variables for public browser config.
- GitHub repository variables for non-secret environment-specific allowlists such as admin emails.
- GitHub repository secrets only when required by CI.
- Google Secret Manager for Cloud Run runtime secrets.

Vite `VITE_*` values are public browser configuration. Do not place private keys or sensitive service credentials in client env values.

## Required Merge Protection

The intended repo policy is:

- Contributors open pull requests from branches.
- Evan Bonertz reviews product direction and merge readiness.
- Code owner approval is required before merging to `main`.
- CI should pass before merge for code changes.
- Direct pushes to `main` should be restricted.

This repository includes `.github/CODEOWNERS`, but GitHub branch protection or repository rulesets must be enabled in GitHub settings for code-owner review to be enforced.

Recommended GitHub settings for `main`:

- Require a pull request before merging.
- Require at least one approving review.
- Require review from Code Owners.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merging.
- Require the `Public repo hygiene` status check.
- Require deployment validation for code paths once the validation workflow is stable.
- Block force pushes.

## Production Readiness Notes

The current deployment design is appropriate for dev and staged feedback. Before a public production launch, review:

- Cloud SQL tier, backups, and point-in-time recovery.
- API rate limiting or Firebase App Check.
- Production CORS values.
- Swagger/OpenAPI exposure.
- Secret Manager access scope.
- Firebase Hosting security headers.

See `.github/DEPLOYMENT_SETUP.md` for the detailed operational runbook.
