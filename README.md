# EZ Vibes Nido API & Client

EZ Vibes Nido is a full-stack concert intelligence platform for live music discovery, curation, and admin operations. The app helps EZ Vibes members collect show information, review uploaded flyers, sync concert data, and publish structured concert records for fans and future partner workflows.

This is a public repository. Contributions are welcome through focused GitHub issues and pull requests. Evan Bonertz, creator and founder of EZ Vibes, is the project owner and final reviewer for product direction, roadmap fit, and merge decisions.

## What This App Does

- Provides a shared concert discovery feed backed by the `Concert` domain.
- Supports relational `Venue` and `Band` data for location and lineup context.
- Lets authenticated users create and engage with concerts.
- Lets users upload concert flyers/images for ingestion review.
- Gives EZ Vibes admins a review tool for approving, rejecting, previewing, and publishing uploaded flyers.
- Supports calendar sync workflows that normalize external source data into concert records.
- Uses Firebase Auth for user identity and admin access checks.

The product language may say "events" in the UI, but the active API/domain model is `Concert`, supported by `Venue`, `Band`, ingestion uploads, and sync jobs.

## Tech Stack

- Backend: NestJS, TypeScript, TypeORM, PostgreSQL
- Frontend: Vue 3, TypeScript, Vite
- Auth: Firebase Auth and Firebase Admin SDK
- Storage: Google Cloud Storage for ingestion uploads
- Deployment target: Cloud Run API and Firebase Hosting
- API docs: Swagger/OpenAPI

## Repository Structure

```text
src/                  NestJS API source
client/               Vue/Vite frontend
scripts/              Local smoke and utility scripts
test/                 E2E test setup
.github/              GitHub Actions and deployment docs
docker-compose.yml    Local PostgreSQL development database
DEPLOYMENT.md         Public deployment overview
CONTRIBUTING.md       Contributor workflow and standards
```

Local planning notes under `src/docs/` are intentionally ignored and should not be required for public contributors.

## Getting Started

### Prerequisites

- Node.js compatible with the project lockfiles.
- npm.
- Docker, if using the local PostgreSQL path.
- Firebase project credentials if testing authenticated flows.
- Google Cloud credentials only if testing GCS ingestion, Cloud SQL, calendar sync, or deployed infrastructure.

### 1. Install Dependencies

```bash
npm install
npm install --prefix client
```

### 2. Configure Environment

Create local env files from the examples:

```bash
cp .env.example .env
cp client/.env.example client/.env
```

Do not commit `.env`, service account JSON files, private keys, database passwords, Firebase tokens, or Google access tokens.

For the simplest local backend path, use Docker PostgreSQL:

```bash
docker-compose up -d
```

Then keep the database section of `.env` aligned with `docker-compose.yml`.

### 3. Run Database Migrations Or Local Synchronize

For quick local iteration, `.env.example` defaults to `DB_SYNCHRONIZE=true`.

For migration-backed work, set `DB_SYNCHRONIZE=false` and run:

```bash
npm run migration:run
```

Use migration-backed changes for PRs that alter schema.

### 4. Start The App

Run API and client separately:

```bash
npm run start:dev
npm run dev --prefix client
```

Or run both from the root:

```bash
npm run dev
```

Local URLs:

- API: `http://localhost:3001`
- Client: `http://localhost:5173`
- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs-json`

## Core API Areas

### Concerts

`/concerts` is the current shared discovery feed and primary API surface for displayed shows.

Common endpoints:

- `GET /concerts`
- `GET /concerts/:id`
- `POST /concerts`
- `PATCH /concerts/:id`
- `DELETE /concerts/:id`
- `POST /concerts/:id/upvote`
- `DELETE /concerts/:id/upvote`

### Venues And Bands

Venues and bands provide relational context for concerts.

Common endpoints:

- `GET /venues`
- `GET /venues/:id`
- `GET /bands`
- `GET /bands/:id`
- `GET /bands/:slug/slug`

Admin-only create/update/delete routes exist for venue and band management.

### Ingestion Uploads

`POST /ingestion/uploads` accepts a multipart image upload and stores it in Google Cloud Storage when GCS is configured.

User-scoped ingestion endpoints require Firebase auth. Admin review endpoints require Firebase auth plus an admin email allowlist.

### Admin Review

EZ Vibes admins can review uploaded flyers through `/admin/ingestion/*`.

Current admin capabilities:

- List uploaded concert images.
- Filter by review status.
- Preview uploaded images.
- Approve, reject, resubmit, or mark uploads as past.
- Publish approved uploads into linked `Concert` records when required fields are provided.

Admin allowlist values are controlled by `ADMIN_EMAILS` for the API and `VITE_ADMIN_EMAILS` for the client.

### Concert Sync

`/concert-sync/*` supports calendar sync and concert normalization workflows. Gemini enrichment is optional and disabled by default for local/dev safety unless `CONCERT_SYNC_GEMINI_ENABLED=true` is set.

Core endpoints:

- `POST /concert-sync/jobs`
- `GET /concert-sync/jobs`
- `GET /concert-sync/jobs/:id`

## Development Commands

```bash
npm run start:dev              # API only
npm run dev --prefix client    # Client only
npm run dev                    # API and client together
npm test                       # Backend tests
npm test -- --runInBand concerts
npm test -- --runInBand ingestion
npm run build                  # API build
npm run build --prefix client  # Client build
npm run smoke:local            # Local smoke test against running API
```

## Contributing

This repo is public so other developers can pick up scoped issues and contribute. Start with issues labeled `good first issue` or `Starter`. A clean GitHub issue template is available for focused tasks, improvements, and bug reports.

Basic workflow:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b <type>/<short-issue-slug>
```

Use a clear branch prefix such as `feature/`, `fix/`, `docs/`, or `chore/`. `codex/` is optional for branches created by Codex, but it is not required for human contributors.

Keep PRs focused on one issue. Avoid unrelated refactors, generated noise, or environment-file changes.

Before opening a PR:

- Run focused tests for the area you changed.
- Run `npm run build`.
- Run `npm run build --prefix client` if client code changed.
- Update Swagger DTOs/docs when API contracts change.
- Include a clear PR description with summary, testing, risk, and follow-ups.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the first-draft contributor process.

## Deployment

The project uses GitHub Actions, Google Workload Identity Federation, Cloud Run, Cloud SQL, Secret Manager, Google Cloud Storage, and Firebase Hosting.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the public deployment overview and `.github/DEPLOYMENT_SETUP.md` for the detailed operations runbook.

## Security And Secrets

Never commit:

- `.env` or `.env.*`
- Firebase private keys
- Google service account JSON files
- Database passwords
- Access tokens
- API keys
- Local exported credentials

Use `.env.example` and `client/.env.example` as templates. Real values should live only in local env files, GitHub repository secrets, Google Secret Manager, or another approved secret store.

## Project Ownership

EZ Vibes Nido is owned and led by Evan Bonertz, creator and founder of EZ Vibes. Technical contributions are welcome, but roadmap direction, product positioning, admin access, deployments, and merge decisions remain owner-reviewed.

## License

License terms are not finalized yet. The package currently remains marked as `UNLICENSED`; contributors should assume code is accepted only through reviewed pull requests until a formal license is added.
