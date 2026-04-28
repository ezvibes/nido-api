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
    ```

#### **Installation & Execution**

```bash
# Install backend dependencies
$ npm install

# Run the API in development mode
$ npm run start:dev
```

The API will be running at `http://localhost:3001`.

### 1b. Start the OCR worker

The ingestion worker runs as a separate process from the NestJS API. It polls for queued ingestion jobs, reads the uploaded image from Cloud Storage, runs Google Vision OCR, and persists job state back to Postgres.

```bash
# in another terminal
$ npm run start:worker:dev
```

For a one-shot local run (useful in tests or when debugging one job):

```bash
$ npm run start:worker:once
```

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

### CORS

The backend is configured to accept cross-origin requests only from the frontend client. This is defined in `src/main.ts`. Any changes to the client's address (`http://localhost:5173`) must be reflected there.

### Ingestion / OCR worker

The ingestion flow now works in two phases:

1. `POST /ingestion/uploads` stores the flyer image in GCS and creates a queued ingestion job.
2. `POST /ingestion/jobs` can queue another OCR job for an existing uploaded asset owned by the current user.
3. The worker process claims queued jobs, runs Google Vision OCR, parses draft event candidates, and transitions jobs through `queued -> processing -> needs_review` or `failed`.
4. `GET /ingestion/jobs/:id` returns job state plus any generated candidate IDs/titles.
5. `GET /ingestion/candidates/:id` returns the draft candidate detail for moderation/review tooling.

Relevant env vars:

```bash
GCS_INGESTION_BUCKET=
GCP_PROJECT_ID=
GCP_CLIENT_EMAIL=
GCP_PRIVATE_KEY=
INGESTION_WORKER_POLL_INTERVAL_MS=5000
INGESTION_WORKER_ONCE=false
```

Production note: keep credentials in Secret Manager or runtime env injection rather than committed files.

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
