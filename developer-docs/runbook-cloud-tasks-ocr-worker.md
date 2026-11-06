# Operational Runbook: Cloud Tasks Dispatcher & Private OCR Extraction Worker

This runbook documents the operational procedures, architecture boundaries, troubleshooting steps, and disaster recovery procedures for Nido's asynchronous OCR flyer extraction pipeline, provisioned under Issue #62.

---

## 1. Architecture & Resource Inventory

The OCR extraction pipeline moves multimodal Gemini extraction and image OCR out of the synchronous HTTP API process into a private, idempotent scale-to-zero Cloud Run worker service invoked by Google Cloud Tasks.

```text
[ User / Contributor ]
         │
         │  POST /ingestion/uploads  (Upload image to GCS)
         │  POST /ingestion/jobs     (Create job & outbox record)
         ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  Nido API Service (Cloud Run: nido-api)                     │
 │  - Commits ConcertUpload, IngestionJob, IngestionOutbox    │
 │  - Returns 201 immediately with Job response               │
 │  - NO in-process post-response void processing             │
 │  - IngestionTasksDispatcherService enqueues Cloud Task     │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                │ Deterministic Task: name = .../tasks/job-${jobId}
                                │ Payload = { "jobId": "..." }
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  Google Cloud Tasks Queue (ingestion-worker-queue)          │
 │  - Environment-specific queue in us-east1                   │
 │  - Rate: 1 dispatch/sec (dev), concurrency: 2 (dev)         │
 │  - Retries: max 5 attempts with exponential backoff         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                │ Private HTTP POST with OIDC Bearer Token
                                │ (Signed by cloud-tasks-invoker SA)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  Private Extraction Worker (Cloud Run: nido-ingestion-worker)│
 │  - Scale-to-zero: min 0, max 2 instances (dev)              │
 │  - Validates OIDC token, audience, and invoker identity    │
 │  - Atomically claims job lease in PostgreSQL               │
 │  - Downloads poster from GCS & executes Gemini extraction   │
 │  - Persists IngestionCandidate records & updates job stage  │
 │  - Returns 200 OK (terminal ACK / duplicate ACK) or 500/503 │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │  PostgreSQL Database (Cloud SQL)                            │
 │  - Authoritative ledger of jobs, outbox, and candidates     │
 └─────────────────────────────────────────────────────────────┘
```

### Provisioned Resources

| Resource                | Terraform Name                                 | Environment Default (Dev)             | Environment Default (Prod)            |
| :---------------------- | :--------------------------------------------- | :------------------------------------ | :------------------------------------ |
| **API Service**         | `google_project_service.cloudtasks`            | Enabled (`cloudtasks.googleapis.com`) | Enabled (`cloudtasks.googleapis.com`) |
| **Cloud Tasks Queue**   | `google_cloud_tasks_queue.ingestion_worker`    | `ingestion-worker-queue` (`us-east1`) | `ingestion-worker-queue` (`us-east1`) |
| **Private Worker**      | `google_cloud_run_v2_service.nido_worker`      | `nido-ingestion-worker`               | `nido-ingestion-worker`               |
| **Queue Dispatch Rate** | `cloud_tasks_dispatch_rate`                    | 1/second                              | 5/second                              |
| **Queue Concurrency**   | `cloud_tasks_max_concurrency`                  | 2                                     | 5                                     |
| **Queue Max Retries**   | `cloud_tasks_max_attempts`                     | 5 attempts (1s – 300s backoff)        | 5 attempts (1s – 300s backoff)        |
| **Worker Scaling**      | `worker_min_instances`, `worker_max_instances` | min: 0 (scale-to-zero), max: 2        | min: 0 (scale-to-zero), max: 5        |
| **Worker Concurrency**  | `worker_concurrency`                           | 2                                     | 5                                     |
| **Worker Timeout**      | `worker_timeout`                               | 600s (10 minutes)                     | 600s (10 minutes)                     |
| **Worker Resources**    | `worker_cpu`, `worker_memory`                  | 1 CPU, 1Gi RAM                        | 2 CPU, 2Gi RAM                        |

### IAM Boundaries & Principle of Least Privilege

1. **API / Dispatcher Identity (`nido-api-runtime@...`)**:
   - Cloud Tasks enqueuer only (`roles/cloudtasks.enqueuer` on `ingestion-worker-queue`).
   - Does NOT have permission to invoke the worker service directly.
2. **Task Caller Identity (`cloud-tasks-invoker@...`)**:
   - Permission to invoke only the private worker (`roles/run.invoker` on `google_cloud_run_v2_service.nido_worker`).
   - Cloud Tasks service agent uses this identity to issue signed OIDC tokens targeting the worker audience.
3. **Worker Runtime Identity (`nido-worker-runtime@...` / `nido-api-runtime@...`)**:
   - Minimum bucket object read on `GCS_INGESTION_BUCKET`.
   - Cloud SQL client (`roles/cloudsql.client`) and Secret Manager secret accessor.
   - Provider access for Gemini multimodal extraction.
4. **Deployer Identity (`github-deployer@...`)**:
   - Completely separate CI/CD Workload Identity service account.
5. **Private Ingress & Request Validation**:
   - Cloud Run service has no public (`allUsers`) invoker binding.
   - `GoogleOidcGuard` strictly enforces that incoming requests provide a valid Google-signed OIDC bearer token, with verified email matching `CLOUD_TASKS_INVOKER_SA` and target audience matching `INGESTION_WORKER_AUDIENCE`.
   - Anonymous requests, wrong audience tokens, or tokens from foreign service accounts are rejected with 401/403.

---

## 2. Operational Scenarios & Playbooks

### Scenario A: Stuck Dispatch (Outbox Records Pending or Failed)

**Symptom**: Flyer uploads succeed, but the job status remains `queued` and no candidates are extracted.

**Diagnosis**:

1. Check the PostgreSQL `ingestion_outbox` table:
   ```sql
   SELECT id, job_id, status, retry_count, last_attempt_at, created_at
   FROM ingestion_outbox
   WHERE status = 'pending' OR status = 'failed'
   ORDER BY created_at DESC
   LIMIT 50;
   ```
2. Inspect API Cloud Logging for `IngestionTasksDispatcherService` errors:
   ```bash
   gcloud logging read 'resource.type="cloud_run_revision" AND textPayload=~"Failed to dispatch task"' \
     --project=nido-api-9ed65 --limit=50
   ```
3. Check if the asynchronous pipeline was temporarily disabled via feature flag:
   - Verify `INGESTION_ASYNC_DISPATCH_ENABLED` in API environment variables.

**Remediation**:

1. Resolve transient network, quota, or permission issues.
2. Trigger the outbox redrive endpoint (using an authenticated admin or Cloud Tasks caller token):
   ```bash
   curl -X POST "https://${API_BASE_URL}/internal/ingestion/redrive-outbox" \
     -H "Authorization: Bearer ${CALLER_OIDC_TOKEN}"
   ```
   Or invoke the dispatcher redrive method via an administrative script or Cloud Run Job.
3. The redrive operation safely queries pending outbox entries (`retry_count < 5`), submits tasks with deterministic names, and updates outbox status to `dispatched`.

---

### Scenario B: Pausing & Resuming the Cloud Tasks Queue

**When to Pause**: Downstream provider outages (e.g. Gemini 429 rate limit spikes), database maintenance, or during emergency worker debugging.

**Pausing the Queue**:

```bash
gcloud tasks queues pause ingestion-worker-queue \
  --location=us-east1 \
  --project=nido-api-9ed65
```

_Effect_:

- The API continues accepting user flyer uploads and creating jobs and outbox entries normally.
- Cloud Tasks holds existing and newly enqueued tasks in the queue without dispatching them to the worker.
- Worker remains idle (scales down to 0 instances).

**Resuming the Queue**:

```bash
gcloud tasks queues resume ingestion-worker-queue \
  --location=us-east1 \
  --project=nido-api-9ed65
```

_Effect_:

- Cloud Tasks immediately resumes dispatching queued tasks at the configured dispatch rate (1 task/second in dev).
- Workers scale up dynamically to process tasks and scale back to zero when finished.

---

### Scenario C: Disabling Asynchronous Dispatch (Feature Flag Rollback)

**When to Disable**:
If Cloud Tasks or the worker service needs to be taken offline without stopping user flyer uploads.

**Procedure**:

1. In the GitHub environment or Cloud Run service configuration, set:
   ```bash
   INGESTION_ASYNC_DISPATCH_ENABLED=false
   ```
2. Deploy or update the environment configuration.
3. _Immediate behavior_:
   - API continues accepting image uploads (`POST /ingestion/uploads`).
   - API commits `IngestionJob` (`stage: queued`) and `IngestionOutbox` (`status: pending`) to PostgreSQL.
   - `IngestionTasksDispatcherService` logs the intent and returns `false` without making any network calls to Cloud Tasks.
   - Zero post-response `void` processing executes in the API process.
   - No jobs or uploads are lost; all records remain safely committed in PostgreSQL.
4. When ready to re-enable:
   - Set `INGESTION_ASYNC_DISPATCH_ENABLED=true`.
   - Run `redrive-outbox` to dispatch all pending records.

---

### Scenario D: Worker Rollback & Deployment Recovery

**When to Rollback Worker**:
If a new release causes extraction errors, parsing crashes, or unexpected provider usage.

**Procedure**:

1. Identify the prior ready Cloud Run worker revision:
   ```bash
   gcloud run revisions list \
     --service=nido-ingestion-worker \
     --region=us-east1 \
     --project=nido-api-9ed65
   ```
2. Direct 100% of worker traffic to the previous known-good revision:
   ```bash
   gcloud run services update-traffic nido-ingestion-worker \
     --to-revisions=PREVIOUS_REVISION_NAME=100 \
     --region=us-east1 \
     --project=nido-api-9ed65
   ```
3. Because tasks in Cloud Tasks only specify `jobId` in their payload and rely on PostgreSQL as the durable state ledger, **no tasks in flight or in the queue are lost or corrupted**.
4. Worker instances of the rollback revision immediately resume claiming jobs and processing extractions.

---

### Scenario E: Safe Replay & Idempotency Guarantees

Nido's architecture enforces strict idempotency at three independent defense lines:

1. **Deterministic Task Naming**:
   - Tasks are named deterministically: `${queuePath}/tasks/job-${jobId}`.
   - If the API or a redrive job attempts to enqueue a task for an already-queued job, Cloud Tasks rejects it with gRPC status `ALREADY_EXISTS` (code 6).
   - The dispatcher treats `ALREADY_EXISTS` as a deduplication success and marks the outbox record as `dispatched`.

2. **Atomic Database Lease Claiming**:
   - When the worker receives a task, it executes `claimJob(jobId, workerId, leaseDurationMs)`:
     ```sql
     UPDATE ingestion_job
     SET lease_owner = :workerId, lease_expires_at = :expiresAt
     WHERE id = :jobId AND (lease_owner IS NULL OR lease_expires_at < :now)
     ```
   - Only ONE worker can claim the lease. If another worker attempts concurrent execution on the same job, it fails to acquire the lease.
   - The second worker inspects the job: if in-flight, it returns HTTP 503 (`ServiceUnavailableException`) so Cloud Tasks backs off; if already completed or terminal, it safely ACKs with 200 `{ success: true, skipped: true }`.

3. **Linear State Machine Validation**:
   - Transitions strictly follow linear progression: `QUEUED` -> `ASSET_VALIDATED` -> `EXTRACTION_COMPLETED` -> `MATCHES_PROPOSED` -> `NEEDS_REVIEW`.
   - If a duplicate delivery arrives after extraction has finished, `processJob` sees `job.stage === NEEDS_REVIEW` and safely returns HTTP 200 `{ success: true, skipped: true }` without re-running Gemini extraction or incurring provider costs.

4. **Batch Replay & Historical Backfills**:
   - Cloud Run Jobs (e.g. `nido-api-reprocess-jobs`) are reserved for explicit batch backfills, re-parsing older flyer uploads with newer Gemini models, or bulk catalog reconciliation.

---

## 3. Resource Decommissioning & Rollback Behavior

If the asynchronous pipeline needs to be decommissioned or recreated:

1. **Graceful Drain**:
   - Set `INGESTION_ASYNC_DISPATCH_ENABLED=false` to stop new task creation.
   - Pause the queue: `gcloud tasks queues pause ingestion-worker-queue ...`
   - Wait for in-flight worker executions to finish.
2. **Terraform Lifecycle**:
   - Set `enable_worker_pipeline = false` in `terraform.tfvars`.
   - `google_cloud_run_v2_service.nido_worker` has `deletion_protection = false` to allow controlled removal when explicitly disabled.
   - `google_project_service.cloudtasks` has `disable_on_destroy = false` so the GCP API is not abruptly disabled for other project services.
3. **Database Ledger Intact**:
   - Removing worker compute does not alter or drop `ingestion_job`, `concert_upload`, `ingestion_outbox`, or `ingestion_candidate` tables. All catalog and upload data remains intact in PostgreSQL.
