# Nido API & Client

This repository contains the full-stack application for Nido, which includes a NestJS backend API and a Vue.js frontend client.

## Project Structure

The project is organized into two main parts:

-   `src/`: The NestJS backend API. This handles business logic, database interactions, and authentication.
-   `client/`: The Vue.js frontend application. This is the user-facing interface that consumes the Nido API.

---

## Getting Started

Follow these steps to get the complete development environment up and running.

### 1. Start the Backend API

First, set up and run the NestJS server.

#### **Prerequisites**

-   A PostgreSQL database. You can run one easily using Docker:
    ```bash
    docker-compose up -d
    ```
-   A `.env` file in the project root. Create it if it doesn't exist:
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

### Concert Calendar Sync Agent

The API now includes a sync agent under `/concert-sync/*` that can:

- Pull Google Calendar events for a user and date range
- Use Gemini to normalize event metadata into clean concert records
- Upsert concert data with event-level fingerprinting for idempotent sync runs
- Refresh Top Picks rankings after sync jobs
- Preserve low-confidence extraction warnings for review
- Run autonomous recurring sync schedules using Google OAuth refresh tokens
- Keep Top Picks limited to admin-approved concerts only

Required env for AI enrichment:

- `GEMINI_API_KEY`
- Optional `GEMINI_MODEL` (defaults to `gemini-2.0-flash`)
- Optional extraction policy controls:
  - `CONCERT_SYNC_ALLOWED_GENRES`
  - `CONCERT_SYNC_MIN_CONFIDENCE`
  - `CONCERT_SYNC_REQUIRE_VENUE`
  - `CONCERT_SYNC_REQUIRE_ARTIST`
  - `CONCERT_SYNC_MAX_DESCRIPTION_LENGTH`

Required env for autonomous schedules:

- `CONCERT_SYNC_TOKEN_ENCRYPTION_KEY` (base64 32-byte key)
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- Optional scheduler toggles:
  - `CONCERT_SYNC_SCHEDULER_ENABLED`
  - `CONCERT_SYNC_SCHEDULER_POLL_MS`

Important security behavior:

- `googleAccessToken` is accepted per sync request and not persisted to the database.
- Sync job records store operational metadata only (counts/status/extraction warnings).
- Gemini prompt payload is sanitized before transmission (attendees/organizer omitted, emails/phones/URLs redacted).
- Refresh tokens for autonomous schedules are encrypted-at-rest before DB persistence.

Core endpoints:

- `POST /concert-sync/jobs` starts a sync job
- `GET /concert-sync/jobs` lists sync jobs
- `GET /concert-sync/jobs/:id` gets a sync job with recent mapped events
- `GET /concert-sync/gemini/prompt-template` returns the default Gemini prompt template and data policy
- `POST /concert-sync/gemini/prompt-preview` previews the exact prompt + sanitized event payload before execution
- `POST /concert-sync/top-picks/refresh` recomputes Top Picks for upcoming events
- `GET /concert-sync/top-picks` returns the current Top Picks list
- `POST /concert-sync/schedules` creates an autonomous sync schedule
- `GET /concert-sync/schedules` lists schedules
- `GET /concert-sync/schedules/:id` retrieves a schedule
- `POST /concert-sync/schedules/:id/update` updates cadence/status/policy/token
- `POST /concert-sync/schedules/:id/run` triggers immediate execution

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
