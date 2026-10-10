# Nido Terraform transition

This directory stages the dev Cloud Run API transition for [issue #121](https://github.com/ezvibes/nido-api/issues/121). The dev service is imported and a controlled same-image apply and rollback drill have succeeded. **Terraform is not yet the automated deployment path:** `TF_API_DEPLOY_ENABLED` remains unset, so GitHub Actions still uses `gcloud run deploy`. Do not run an unreviewed apply or enable the workflow flag without the maintainer's cutover approval. Production is untouched.

## Dev rehearsal evidence (2026-10-09)

- State bucket: `nido-api-9ed65-tfstate-dev` in `us-east1`, with uniform bucket-level access, public access prevention, object versioning, and seven-day soft delete. Bucket IAM has the GitHub deployer as Storage Object Admin and retains project-owner access. The default project-viewer and project-editor legacy bindings were removed before import.
- Imported `projects/nido-api-9ed65/locations/us-east1/services/nido-api` into the `dev/nido-api` GCS state prefix. The initial plan exposed a missing explicit CPU-idle setting and service-level minimum-instance setting; both were reconciled in `main.tf`. Informational `gcloud` client labels are not managed.
- The reviewed apply changed only the image reference from the deployed commit tag to its **identical digest**. It created ready revision `nido-api-00061-46d`; `/health` and `/concerts/meta/genres` returned HTTP 200.
- Rollback drill: traffic moved 100% to previous ready revision `nido-api-00060-9dj` (same digest), `/health` returned 200, then traffic returned 100% to latest (`00061`), with `/health` again returning 200. After refreshing the revision output, `terraform plan -detailed-exitcode` returned 0.
- The dev GitHub environment has `TF_STATE_BUCKET` set. `TF_API_DEPLOY_ENABLED` is unset and defaults to `false`. No production state, import, or deployment was changed.

## What runs today

GitHub Actions (`.github/workflows/deploy-dev.yml`) builds and pushes an image tagged for the commit being released. When enabled, it deploys and executes the Cloud Run migration job with that image **before** updating the API service. The API does not run migrations at startup. The same workflow deploys the Vue client to Firebase Hosting and performs smoke checks. GitHub Actions is the sole release writer for Cloud Run today.

The agent session and memory tables added in [#122](https://github.com/ezvibes/nido-api/pull/122) make this order important: the new API revision must not start before its required database migration has succeeded. A migration is a database change, not something that automatically rolls back with an API revision.

## Proposed ownership, not a cutover

The target is for Terraform to own **Cloud Run API service configuration and the release image**, while GitHub Actions continues to build the SHA-pinned image, run the migration job first, call the approved Terraform release path, verify the API, and deploy Firebase Hosting through its existing path. The migration job, database, network, and Firebase Hosting are not being transferred to Terraform by this starter. GitHub Actions and Terraform must never be independent writers of the API revision.

The cutover is staged:

1. **Bootstrap protected state (dev complete).** Create a dedicated GCS bucket outside this root configuration, then enable object versioning, uniform bucket-level access, public access prevention, and least-privilege access for the Terraform identity. Inspect and remove broad default legacy bucket IAM bindings before storing state. Configure the GCS backend only after the bucket exists. GCS state locking prevents concurrent writes; versioning helps recover a damaged state. State and saved plans may contain sensitive values: do not commit them, paste them into issues, or expose them as unrestricted CI artifacts. Keep separate state prefixes and approvals per environment.
2. **Validate without changing infrastructure.** Pin Terraform and provider versions, commit the provider lockfile, and run `terraform init -backend=false`, `terraform fmt -check`, and `terraform validate`. Inventory the real service before adding an applyable definition or generating a shared plan. Syntax checks are not evidence of live parity.
3. **Import and reconcile manually (dev complete).** After the backend and access controls are reviewed, import the existing API service into remote state. Compare every live setting (image, env vars, secrets, Cloud SQL attachment, scaling, ingress, and IAM) with the HCL. Obtain a reviewed, no-surprise plan; `terraform import` changes state, not the service, but a later apply can change it. Resolve or explicitly defer any planned difference before approval.
4. **Approve a guarded release path (pending).** The deploy workflow has a Terraform path controlled by `TF_API_DEPLOY_ENABLED`; it defaults to `false`. A maintainer reviews permissions, migration order, the exact digest-pinned image, plan, rollback target, and the dev rehearsal above before changing that GitHub environment variable to `true`. The workflow checks that the service is imported and permits only a no-op or an image-only update; a change to ingress, secrets, Cloud SQL, scaling, or traffic fails closed and needs separate review. Never run both `gcloud run deploy` and Terraform apply for the same release. Production requires a separate approval and parity exercise.

The dev backend, import, parity review, and rollback rehearsal are complete; the automated workflow cutover is not. [#119](https://github.com/ezvibes/nido-api/issues/119) must establish and verify private database connectivity separately; this transition does not authorize network changes.

## Drift and rollback

Before cutover, the existing workflow remains authoritative and Terraform must not apply. After cutover, a manual Cloud Run edit or legacy `gcloud run deploy` would create drift; the workflow stops on non-image drift rather than silently reconciling it. Investigate that drift with a reviewed plan. Release plans use the exact image digest built for that commit, not a moving `:latest` tag.

For an API failure, redeploy the last known-good **digest-pinned image and reviewed service configuration** through the designated single writer, then verify health and behavior. Keep the previous Cloud Run revision as an emergency rollback reference. If an operator shifts traffic to that revision as an emergency measure, pause Terraform releases until the approved configuration and state reflect the intended traffic; the current HCL otherwise directs 100% of traffic to the latest revision. Do not automatically reverse database migrations: assess compatibility and use an approved forward fix or a separately rehearsed data recovery plan. If Terraform itself caused the fault, stop further applies, preserve state, and review the recovery plan before changing state or service configuration.

See [Deployment Pipeline](../developer-docs/deployment-pipeline.md) for the end-to-end release sequence. No Terraform command in this guide authorizes an apply.
