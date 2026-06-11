# Nido API & Client

This repository contains the full-stack application for Nido, which includes a NestJS backend API and a Vue.js frontend client.

## Project Structure

The project is organized into two main parts:

- `src/`: The NestJS backend API. This handles business logic, database interactions, and authentication.
- `client/`: The Vue.js frontend application. This is the user-facing interface that consumes the Nido API.

---

## Getting Started

Follow these steps to get the complete development environment up and running.

### 1. Start the Backend API

First, set up and run the NestJS server.

#### **Prerequisites**

- A PostgreSQL database. You can run one easily using Docker:
  ```bash
  docker-compose up -d
  ```
- A `.env` file in the project root. Create it if it doesn't exist:
  ```
  DB_HOST=localhost
  DB_PORT=5432
  DB_USER=user
  DB_PASSWORD=password
  DB_NAME=nido
  DB_SYNCHRONIZE=true
  ```

#### **Installation & Execution**

```bash
# Install backend dependencies
$ npm install

# Run the API in development mode
$ npm run start:dev
```

The API will be running at `http://localhost:3001`.

### 2. Start the Frontend Client

In a separate terminal, set up and run the Vue.js client.

```bash
# Navigate to the client directory
$ cd client

# Install frontend dependencies
$ npm install

# Run the client in development mode
$ npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## Configuration

### Swagger API Docs

Interactive API documentation is available after the API starts:

- Swagger UI: `http://localhost:3001/api-docs`
- OpenAPI JSON: `http://localhost:3001/api-docs-json`

Use the Swagger Authorize button with a Firebase bearer token to test protected endpoints.

### CORS

The backend is configured to accept cross-origin requests only from the frontend client. This is defined in `src/main.ts`. Any changes to the client's address (`http://localhost:5173`) must be reflected there.

### Image Ingestion (GCS)

`POST /ingestion/uploads` accepts a multipart upload and stores it in Google Cloud Storage (GCS).

Required env:

- `GCS_INGESTION_BUCKET` (bucket name)
- Credentials (choose one):
  - Application Default Credentials (recommended): set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
  - Or set `GCP_SERVICE_ACCOUNT_PATH=/path/to/service-account.json`
  - Or set `GCP_SERVICE_ACCOUNT_JSON='{"project_id":"...","client_email":"...","private_key":"..."}'`
  - Or set `GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY` (single-line key with `\n`)

### Admin Review

Admin-only endpoints are under `/admin/ingestion/*` (list uploads, preview images, and set review status/notes).

- Backend allowlist: set `ADMIN_EMAILS` (comma-separated emails) in `.env`
- Client menu allowlist: set `VITE_ADMIN_EMAILS` (comma-separated emails) in `client/.env`
- Admin onboarding and validation guide: `src/docs/ADMIN_INGESTION_REVIEW_ONBOARDING.md`

### Concert Calendar Sync Agent

The API now includes a sync agent under `/concert-sync/*` that can:

- Pull Google Calendar events for a user and date range
- Use Gemini to normalize event metadata into clean concert records
- Upsert concert data with event-level fingerprinting for idempotent sync runs
- Refresh Top Picks rankings after sync jobs
- Preserve low-confidence extraction warnings for review
- Keep Top Picks limited to admin-approved concerts only

Required env for AI enrichment:

- `GEMINI_API_KEY`
- Optional `GEMINI_MODEL` (defaults to `gemini-2.0-flash`)
- Optional `CONCERT_SYNC_GEMINI_ENABLED=false` disables paid Gemini calls and uses deterministic fallback extraction.
- Optional extraction policy controls:
  - `CONCERT_SYNC_ALLOWED_GENRES`
  - `CONCERT_SYNC_MIN_CONFIDENCE`
  - `CONCERT_SYNC_REQUIRE_VENUE`
  - `CONCERT_SYNC_REQUIRE_ARTIST`
  - `CONCERT_SYNC_MAX_DESCRIPTION_LENGTH`
  - `CONCERT_SYNC_MAX_EVENTS_PER_JOB` (defaults to 25, max 100)

Required env for live Google Calendar sync:

- Recommended deployed setup: create a Google service account, share the source calendar with the service account email, and grant `See all event details`.
- Then configure one of:
  - `GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}'`
  - Or `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY` (single-line key with `\n`)
- Local/manual fallback: `GOOGLE_CALENDAR_ACCESS_TOKEN` or request-level `googleAccessToken`, but these are short-lived and not recommended for deployed demos.

Important security behavior:

- Service-account credentials stay server-side; the Sync Doctor UI does not collect or transmit Google credentials.
- `googleAccessToken` is still accepted for Swagger/manual testing and is not persisted to the database.

---

## Deploy on Merge to Main

This repo includes a GitHub Actions workflow at `.github/workflows/firebase-deploy.yml`.

On every push to `main`, including a merged PR, the workflow:

1. Installs API and client dependencies.
2. Runs the concert sync test suite.
3. Builds the Nest API.
4. Builds and pushes an API Docker image to Artifact Registry.
5. Deploys the API image to Cloud Run.
6. Builds the Vue client with the deployed API URL.
7. Deploys `client/dist` to Firebase Hosting.

### Required GitHub Secret

Create this repository secret:

- `FIREBASE_SERVICE_ACCOUNT_NIDO_API_9ED65`

The value should be the full JSON key for a Google service account that can deploy both Firebase Hosting and Cloud Run.

Recommended IAM roles for the deploy service account:

- Firebase Hosting Admin
- Cloud Run Admin
- Artifact Registry Admin, or Artifact Registry Writer if the `nido` repository already exists
- Service Account User on the Cloud Run runtime service account

### Required/Recommended GitHub Variables

Client build variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_ADMIN_EMAILS`

Optional:

- `VITE_API_BASE_URL`
  - If omitted, the workflow uses the Cloud Run service URL after deploying the API.
- `CORS_ORIGINS`
  - Defaults to `https://nido-api-9ed65.web.app,https://nido-api-9ed65.firebaseapp.com`.

### Cloud Run Runtime Configuration

The workflow deploys a new API container image and updates only:

- `NODE_ENV=production`
- `CORS_ORIGINS`

Database credentials, Firebase Admin credentials, Google Calendar service account credentials, Gemini keys, and ingestion bucket config should be configured on the Cloud Run service as environment variables or Secret Manager references. The deploy intentionally does not overwrite those runtime settings.
- Sync job records store operational metadata only (counts/status/extraction warnings).
- Gemini prompt payload is sanitized before transmission (attendees/organizer omitted, emails/phones/URLs redacted).
- Sync jobs record whether extraction used Gemini or fallback heuristics, including quota/billing fallback reasons.
- `POST /concert-sync/jobs` supports `dryRun=true` to load and sanitize source events without calling Gemini or writing concerts.

Core endpoints:

- `POST /concert-sync/jobs` starts a sync job
- `GET /concert-sync/jobs` lists sync jobs
- `GET /concert-sync/jobs/:id` gets a sync job with recent mapped events

Concert approval gate:

- Only concerts with `isAdminApproved=true` are eligible for Top Picks scoring.
- Admin approval endpoint: `PUT /admin/concerts/:id/approval` with body `{ "approved": true | false }`.
- Doctor S workflow and QA scenarios: `src/docs/DOCTOR_S_INGESTION_SYNC_PIPELINE.md`

Sample-job mode:

- `POST /concert-sync/jobs` can accept `sampleEvents` for local/test runs without live Google API calls.
- Production source of truth remains Google Calendar for now, but the sync service already isolates event-source loading (`loadSourceEvents`) so a future ingestion-pipeline source can be added without rewriting extraction/upsert logic.

## User Signup Flow

The user authentication and data synchronization are handled via Firebase and a dedicated endpoint in this API.

### Flow:

1.  **Client-Side Authentication**: A user signs up or logs in on the client application using Firebase Authentication.
2.  **ID Token**: Upon successful authentication, the client receives a Firebase ID token.
3.  **API Sync**: The client sends a `POST` request to the `/users/sync` endpoint of this API.

### `POST /users/sync`

This endpoint is responsible for creating a new user in the database or retrieving an existing one.

It requires a valid Firebase ID Token in the `Authorization` header:
`Authorization: Bearer <FIREBASE_ID_TOKEN>`

The user details (uid, email, picture) are extracted directly from the token.

## License

This project is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
