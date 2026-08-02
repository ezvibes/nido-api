# Admin Concert Catalog Testing And Deployment Guide

This guide moves the admin concert catalog from local verification through dev
deployment and post-deploy validation. Use it with the canonical runbooks:

- [Admin Concert Catalog Contract](admin-concert-catalog.md)
- [Nido Testing Workflow](../../.github/TESTING_WORKFLOW.md)
- [Nido Dev Deployment Reference](../../.github/DEPLOYMENT_SETUP.md)

Do not place Firebase tokens, secret values, private account details, or database
credentials in test evidence, pull requests, screenshots, or workflow logs.

## Success Criteria

The feature is ready for dev when all of the following are true:

- admin list, detail, and PATCH responses share one complete response contract;
- title and genre inputs are trimmed and rejected before reaching PostgreSQL when
  blank, too long, incorrectly typed, or explicitly null;
- admin writes use the latest `version` and stale writes return `409 Conflict`;
- owner and automation writes cannot overwrite an admin-controlled record;
- hidden and archived records are absent from public discovery and engagement
  mutation responses;
- the admin UI can navigate beyond the first page and reloads authoritative totals
  after mutations;
- the migration runs once in the Cloud Run migration job before the API deploy;
- Cloud Run, public API smoke tests, Firebase Hosting, and authenticated admin smoke
  tests pass;
- the prior Cloud Run revision and Firebase release are known before deployment.

## Why This Design Is Durable

The catalog schema is additive and keeps one canonical `concerts` table. Four fields
provide the control plane:

- `catalog_status` expresses the mutually exclusive active, hidden, or archived
  lifecycle;
- `is_featured` records a manual editorial choice and is constrained to active
  concerts;
- `editorial_locked_at` pauses source-managed content overwrites after an admin edit;
- `version` enables atomic compare-and-swap updates without explicit row locks.

This keeps admin authority broad while keeping concurrency policy small. PostgreSQL
conditional updates decide which writer wins. Stale users, sync jobs, and ingestion
reviews back off instead of silently merging over newer work. Top Picks updates only
ranking fields, writes each current candidate once, and separately clears stale
ranking state.

The design scales with Cloud Run because instances do not coordinate through process
memory, Redis, or long-held row locks. It is also cost-conscious: PostgreSQL remains
the atomic boundary and no always-on coordination service is introduced.

## Phase 1: Fast Local Verification

### Automated checklist

- [ ] Install API and client dependencies from their lockfiles.
- [ ] Run the focused backend contract and concurrency tests.
- [ ] Run the focused Vue admin catalog tests.
- [ ] Run the shared agent gate before review handoff.
- [ ] Confirm the branch diff passes whitespace hygiene.
- [ ] Confirm production code contains no explicit row-lock calls.

Commands:

```bash
npx jest --runInBand \
  src/apis/concerts/admin-concert.controller.http.spec.ts \
  src/apis/concerts/concert.service.spec.ts \
  src/concert-sync/concert-sync.service.spec.ts \
  src/ingestion/ingestion.service.spec.ts

npm test --prefix client -- AdminConcertsPage.spec.ts
npm run agent:gate
git diff --check origin/main
```

The focused tests cover:

- trimmed title and genre values;
- blank, over-length, and explicit-null rejection;
- stale admin PATCH conflicts;
- owner edit and delete precedence;
- sync and ingestion race behavior;
- hidden and archived upvote deletion;
- complete admin detail metadata;
- pagination and post-mutation total refresh;
- one write per retained Top Picks candidate.

### Running local application smoke

Start the API and client in separate terminals when they are not already running:

```bash
npm run start:dev
npm run dev:client
```

Open the client at `http://localhost:5173`. The default local API CORS policy allows
that exact origin; `http://127.0.0.1:5173` is a different browser origin and will be
rejected unless it is deliberately added to local `CORS_ORIGINS`.

If the seeded concerts have aged out of the upcoming view, refresh the same marked
local records with rolling future dates:

```bash
npm run seed:dev:concerts
```

Then run the non-mutating API smoke:

```bash
npm run smoke:local
```

Use `npm run smoke:local:deep` only when the local API is intentionally connected to
the expected PostgreSQL and supporting services. Do not point a local mutation test
at production.

### Manual local admin edit

Prerequisites:

- the client points to the local API;
- the signed-in Firebase account is in the local admin allowlist;
- the catalog migration exists in the local database;
- `DB_SYNCHRONIZE=false` unless the database is explicitly disposable;
- a non-production concert has been selected as the test record.

Before editing, record the test concert ID, original title, genre, venue, status,
Featured state, editorial lock, and version. Do not use a high-value live listing.

- [ ] Open the admin concert catalog and confirm the active filter loads.
- [ ] Search for the test concert and open its editor.
- [ ] Change the title and genre, save, and confirm the row retains engagement,
      poster, sync, venue, and status data.
- [ ] Confirm leading and trailing whitespace is removed.
- [ ] Confirm an over-length or blank value shows a validation error without a 500.
- [ ] Open the same record in two browser tabs. Save tab A, then save stale tab B.
- [ ] Confirm tab B receives conflict guidance, closes the stale editor, and reloads.
- [ ] Hide the record and confirm it leaves active admin results and public discovery.
- [ ] Restore it and confirm it returns to public discovery.
- [ ] Feature and unfeature it while active.
- [ ] Confirm a hidden or archived record cannot be Featured.
- [ ] Archive and restore the record.
- [ ] If the record has sync provenance, confirm an admin content edit pauses source
      updates and the explicit resume action clears that pause.
- [ ] Restore every original field and confirm the final version is current.

Stop immediately if a mutation returns a 500, a stale update overwrites newer data,
a hidden record remains publicly discoverable, or the response loses metadata.

## Phase 2: Pull Request Readiness

- [ ] Scope and acceptance criteria still match the linked issue.
- [ ] Migration `up` and `down` behavior has been reviewed.
- [ ] Existing rows receive safe defaults: active, unfeatured, version 1.
- [ ] Database constraints prevent invalid lifecycle and Featured combinations.
- [ ] API and client tests pass in GitHub Actions.
- [ ] API and client production builds pass.
- [ ] Public repository hygiene passes.
- [ ] Independent verification has no unresolved P0, P1, or P2 findings.
- [ ] Security, privacy, cost, API, and deployment impacts are documented.
- [ ] The dev smoke plan and rollback target are included in the PR evidence.
- [ ] Maintainer approval is recorded before merge.

Do not merge while the migration path, admin authorization, or rollback target is
unclear.

## Phase 3: Deployment Observation

Merging to `main` starts `.github/workflows/deploy-dev.yml`. Before merge, record:

```text
Branch:
PR:
Candidate commit SHA:
Previous Cloud Run revision:
Previous API image:
Previous Firebase Hosting release/version:
Migration expected: yes
Rollback owner:
```

Observe the workflow in order:

- [ ] Dependencies install from lockfiles.
- [ ] API tests pass.
- [ ] Client tests pass.
- [ ] API build passes.
- [ ] Client build passes before infrastructure mutation.
- [ ] One commit-addressed API image is pushed.
- [ ] `nido-api-migrations` runs one task with zero retries.
- [ ] The migration job completes before Cloud Run service deployment starts.
- [ ] The API service deploys with `DB_MIGRATIONS_RUN=false`.
- [ ] `/health`, `/health/deep`, and `/api-docs-json` pass.
- [ ] Public and configured authenticated concert smoke tests pass.
- [ ] Firebase Hosting deploys only after API verification.
- [ ] Firebase Hosting reachability passes.

Deployment stop conditions:

- migration job failure or partial schema uncertainty;
- API health or database health failure;
- unexpected Cloud Run environment, service account, or image;
- public concert contract regression;
- Firebase build or release failure;
- an unexplained authorization or CORS change.

Do not bypass a failed migration job by manually deploying the API. Inspect the job
logs and prefer a reviewed forward-fix migration over an ad hoc database edit.

## Phase 4: Dev Automated Smoke

After GitHub Actions reports success:

```bash
npm run smoke:dev
npm run smoke:dev:concerts
```

Expected evidence:

- basic health is `ok`;
- deep health reports database status `ok`;
- OpenAPI contains an object of paths;
- the public concert feed returns `{ data, total, page, pageSize }`;
- the first concert, when present, has a lineup array with named bands.

The workflow may also run authenticated concert smoke using the configured refresh
token. Record whether that step passed or was explicitly skipped. Never print the
token.

## Phase 5: Dev Manual Smoke

Use the deployed frontend at `https://nido-api-9ed65.web.app` and the deployed API
target defined in `.github/deploy/environments/dev.env`.

### Access and loading

- [ ] Anonymous users cannot access admin catalog operations.
- [ ] A signed-in non-admin receives `403` from `/admin/concerts`.
- [ ] An allowlisted admin can open the catalog.
- [ ] Active, hidden, archived, and all filters load.
- [ ] Search and Featured-only filtering return coherent totals.
- [ ] Previous and Next navigate correctly when more than 25 records match.
- [ ] Refresh and overlapping filter changes do not show stale results.

### Response and validation

- [ ] Admin detail includes engagement counts, sync source, poster URL, catalog
      status, editorial lock, and version.
- [ ] PATCH returns the same complete response shape.
- [ ] Title and genre are trimmed.
- [ ] Blank, over-length, invalid-type, and disallowed-null inputs return `400`.
- [ ] A stale `expectedVersion` returns `409`, not `500`.

### Authority and visibility

- [ ] An admin content edit updates all supported fields in one operation.
- [ ] The edit pauses automation only for source-managed content.
- [ ] A stale owner, sync, or ingestion write cannot overwrite the admin result.
- [ ] Hiding clears Featured and removes the concert from public discovery.
- [ ] Archiving remains recoverable and removes the concert from public discovery.
- [ ] Upvote creation and deletion reject hidden or archived records.
- [ ] Restoring to active makes the record eligible for public discovery again.
- [ ] Top Picks refresh does not overwrite admin content or lifecycle state.

### Cleanup

- [ ] Restore the test record's original content and active/Featured state.
- [ ] Confirm it appears exactly once in the expected public results.
- [ ] Record the final concert version.
- [ ] Remove screenshots or notes that contain account or token information.

## Phase 6: Release Evidence

Attach this sanitized evidence to the PR or deployment report:

```text
Merged commit:
Deploy workflow run:
Migration job execution and result:
Cloud Run revision:
Container image SHA/tag:
Firebase Hosting release/version:
Automated API smoke result:
Authenticated smoke result or skip reason:
Manual admin account role tested:
Manual scenarios passed:
Known limitations:
Previous Cloud Run revision:
Rollback decision:
Verifier result:
```

## Rollback Order

Rollback is a maintainer decision. Preserve evidence before changing traffic.

1. Stop additional deploys and identify the failing layer.
2. If the API revision is faulty, move Cloud Run traffic back to the recorded prior
   healthy revision.
3. If only the frontend is faulty, restore the prior Firebase Hosting release.
4. Re-run health, public concert, and affected authenticated smoke checks.
5. Leave the additive database columns in place unless the migration itself is the
   proven cause of failure.
6. Use migration `down` only after reviewing data loss and compatibility. This
   migration drops catalog state, editorial locks, and version data, so application
   rollback is preferred over immediate schema rollback.
7. Open or update a regression issue and add the failed scenario to automated tests.

Cloud Run rollback pattern:

```bash
gcloud run services update-traffic nido-api \
  --project nido-api-9ed65 \
  --region us-east1 \
  --to-revisions PREVIOUS_HEALTHY_REVISION=100
```

Replace the placeholder only with the revision recorded before deployment. Do not
guess a rollback target.

## Current Local Evidence

Evidence recorded on 2026-08-02 for the feature branch:

- focused API, admin concurrency, sync, and ingestion tests: 62 passed;
- focused Vue admin catalog tests: 8 passed;
- local live API `/health` and `/api-docs-json` smoke: passed;
- shared gate: 127 API tests and 29 client tests passed;
- API and client production builds: passed;
- independent verification: no actionable findings.

Still required after merge: migration-job evidence, authenticated deployed admin
smoke, Cloud Run revision capture, Firebase release capture, and rollback target.
