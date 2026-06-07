# Admin Guide: Ingestion Uploads and Review

This guide explains what the ingestion and review workflow does today, how an admin uses it, and how to validate that it is working.

## What Has Been Built

The current ingestion pipeline is a Phase 1 upload-and-review workflow.

Users can upload a concert flyer image from the client app. The API stores the image in Google Cloud Storage and stores upload metadata in the database. Admins can then open an admin review page, preview the uploaded image, and mark it as submitted, approved, rejected, or past.

Important limitation: this is not yet a full OCR-to-concert automation pipeline. The ingestion job currently runs a skeleton worker that moves from queued to processing to needs_review with placeholder OCR output. Once an admin approves, rejects, or marks the upload as past, related needs_review jobs are closed as completed with an admin review stage. The system does not yet extract flyer text, create a concert from the flyer, or publish an approved upload into the events list automatically.

## Admin Permissions

Admin access is controlled by email allowlists.

The backend checks `ADMIN_EMAILS` in the root `.env` file. The frontend checks `VITE_ADMIN_EMAILS` in `client/.env`. Both values are comma-separated email lists.

Example:

```env
ADMIN_EMAILS=admin@example.com,ops@example.com
VITE_ADMIN_EMAILS=admin@example.com,ops@example.com
```

The signed-in Firebase user email must be present in both places. If the frontend allowlist is missing, the admin page may be hidden or redirect away. If the backend allowlist is missing, the API returns `403 Forbidden`.

## User Upload Flow

1. A signed-in user goes to the upload panel in the client app.
2. The user chooses or drags in an image file.
3. The user can add optional city and state hints.
4. The client sends the image to `POST /ingestion/uploads`.
5. The backend validates that the file is an image and is not empty.
6. The backend stores the image in the configured GCS bucket.
7. The backend creates a `concert_uploads` database record with review status `submitted`.
8. The client starts a Phase 1 job with `POST /ingestion/jobs`.
9. The job record moves through `queued`, `processing`, then `needs_review`.

Supported upload fields:

- `file` or `image`: the image file
- `city`: optional city hint
- `state`: optional state hint
- `source`: optional source, usually `flyer_upload`

The client limits uploads to common image types and 50 MB. The backend also enforces the 50 MB multipart limit and rejects non-image MIME types.

## Admin Review Flow

1. Sign in with an admin Firebase account.
2. Open `/admin/ingestion/uploads` in the client app.
3. Use the status filter to view all uploads or only a specific status.
4. Click an upload row to open the preview modal.
5. Review the flyer image and metadata:
   - upload date
   - original filename
   - city and state hints
   - uploader email or Firebase UID
   - storage path
   - current review status
6. Choose one of the review decisions:
   - `submitted`: keep in the queue
   - `approved`: accepted by an admin
   - `rejected`: not accepted
   - `past`: valid-looking upload, but the event has already passed
7. Add optional internal notes.
8. Click Save review.

The saved review updates the upload record with the review status, notes, reviewer user id, and review timestamp.

## Review Status Meaning

`submitted` means the upload is waiting for admin review or should remain in the queue.

`approved` means an admin accepted the upload as valid. This updates the upload review record and closes related Phase 1 needs_review ingestion jobs as completed with stage `admin_approved`. It does not automatically create or approve a concert.

`rejected` means the upload should not move forward. Typical reasons include unreadable image, non-concert content, duplicate, spam, or missing required event details.

`past` means the uploaded flyer appears to be for a real event, but the event date has already passed.

When an admin saves a terminal review decision, the related Phase 1 ingestion job is closed:

- `approved` -> job `status: completed`, job `stage: admin_approved`
- `rejected` -> job `status: completed`, job `stage: admin_rejected`
- `past` -> job `status: completed`, job `stage: admin_marked_past`

Moving an upload back to `submitted` does not complete the job.

## Related Concert Approval

There is a separate admin approval gate for concerts:

```http
PUT /admin/concerts/:id/approval
```

That endpoint sets whether an existing concert is eligible for Top Picks scoring. It is separate from ingestion upload review. Approving a flyer upload does not currently set `isAdminApproved` on a concert because the flyer upload is not yet connected to automatic concert creation.

## Required Configuration

Backend `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=nido
DB_SYNCHRONIZE=true

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

GCS_INGESTION_BUCKET=
ADMIN_EMAILS=admin@example.com
```

GCS credentials can be provided with one of these options:

- `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
- `GCP_SERVICE_ACCOUNT_PATH=/path/to/service-account.json`
- `GCP_SERVICE_ACCOUNT_JSON='{"project_id":"...","client_email":"...","private_key":"..."}'`
- `GCP_PROJECT_ID`, `GCP_CLIENT_EMAIL`, and `GCP_PRIVATE_KEY`

Frontend `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_ADMIN_EMAILS=admin@example.com
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Safe Key Handling

Do not paste long-lived secrets into chat, commit them to git, or put them in docs.

For local validation, place secrets in `.env` and `client/.env`, which are intended for local configuration. If a key must be shared, prefer a short-lived test key, a restricted service account, or a screen share where the value is not persisted in the repository.

The GCS service account needs permission to create objects for upload validation and read objects for admin image preview.

## Manual Validation Checklist

Use this checklist when validating a local or staging environment.

1. Start Postgres.

```bash
docker-compose up -d
```

2. Start the backend.

```bash
npm run start:dev
```

3. Start the frontend.

```bash
npm run dev --prefix client
```

4. Sign in to the client with an admin-allowlisted Firebase account.
5. Upload a real image through the upload panel.
6. Confirm the upload response includes a `concertUploadId`, `storageUri`, filename, size, and uploaded timestamp.
7. Confirm the client creates an ingestion job and the job reaches `needs_review`.
8. Open `/admin/ingestion/uploads`.
9. Confirm the uploaded image appears in the list with status `submitted`.
10. Open the upload row and confirm the image preview loads.
11. Set status to `approved`, add a note, and save.
12. Refresh the list and confirm the status, note, reviewer, and review timestamp persist.
13. Fetch the related ingestion job and confirm it moved from `needs_review` to `completed` with stage `admin_approved`.
14. Repeat one negative case with a non-admin user and confirm admin routes are blocked.
15. Repeat one negative case with a non-image file and confirm upload is rejected.

## API Validation Reference

Protected user endpoints require:

```http
Authorization: Bearer <Firebase ID token>
```

Admin endpoints require the same token plus an allowlisted email.

Upload a flyer:

```http
POST /ingestion/uploads
Content-Type: multipart/form-data
```

Create a Phase 1 ingestion job:

```http
POST /ingestion/jobs
Content-Type: application/json

{
  "concertUploadId": "upload-uuid"
}
```

Get a job:

```http
GET /ingestion/jobs/job-uuid
```

List admin uploads:

```http
GET /admin/ingestion/uploads?reviewStatus=submitted&limit=25&offset=0
```

Preview an upload image:

```http
GET /admin/ingestion/uploads/upload-uuid/image
```

Save an upload review:

```http
PUT /admin/ingestion/uploads/upload-uuid/review
Content-Type: application/json

{
  "status": "approved",
  "notes": "Valid flyer."
}
```

## Current Gaps and Follow-Up Work

- OCR is not implemented for flyer uploads.
- Parsed concert candidate generation is not implemented for flyer uploads.
- Admin approval of an upload does not automatically create or approve a concert.
- There is no dedicated pagination UI beyond the current fixed limit and offset plumbing.
- Production deployments with `DB_SYNCHRONIZE=false` should run migrations before validation so the `concert_uploads` and `ingestion_jobs` tables exist.
