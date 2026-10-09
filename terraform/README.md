# Nido Terraform starter

This directory is the learning scaffold for [issue #121](https://github.com/ezvibes/nido-api/issues/121), not an active deployment path.

> Do not run `terraform plan` or `terraform apply` against the Nido dev project from this directory yet. The GCS backend is not configured, the existing Cloud Run service has not been imported, and `main.tf` does not match its live configuration. An apply could attempt to create an existing service or change a working revision.

## Current ownership

| Area | Current owner |
| --- | --- |
| API image, Cloud Run service, migration job, smoke tests | `.github/workflows/deploy-dev.yml` |
| Deployment values | `.github/deploy/environments/dev.env` |
| Firebase Hosting | Existing deploy workflow |
| Terraform state and live resources | None yet |

PR #120 is merged, but its concert publication changes are not a Terraform prerequisite. This branch predates that merge and should be refreshed from `main` before a PR. [Issue #119](https://github.com/ezvibes/nido-api/issues/119) is still required before claiming that the database uses private IP through Direct VPC egress. The `vpc_access` block in `main.tf` is a proposal, not the current network configuration.

## Safe first exercise

The first deliverable is a protected state backend and a validation-only workflow. It must not take ownership of the live service or change its revisions.

1. With maintainer approval, choose a dedicated GCS state bucket and dev state prefix. Bootstrap the bucket separately, enable object versioning, uniform bucket-level access, public access prevention, and least-privilege access for the Terraform identity. Restrict access to state because state and plan files can contain sensitive values. Record the bucket name in backend configuration only after it exists.
2. Pin the Terraform CLI version in CI, initialize the provider without a backend for syntax checks, and commit the generated `.terraform.lock.hcl`. Locally, after Terraform is installed, run `terraform init -backend=false`, `terraform fmt -check`, and `terraform validate`. These commands do not authorize an infrastructure change.
3. Replace the active Cloud Run resource proposal with read-only inventory or otherwise remove it from the root configuration before the first dev plan. Activate the GCS backend and inspect a plan that proposes no live resource changes. Do not publish a raw plan or state file in a PR comment.
4. Document the observed Cloud Run service, migration job, Cloud SQL configuration, secret references, and release image strategy. Keep the existing deploy workflow as the sole writer while the ownership decision is open.

The bucket is a one-time bootstrap prerequisite: a GCS backend cannot create its own bucket. The GCS backend provides state locking; bucket versioning supports recovery. Do not use local state for shared infrastructure.

## Later decisions

- Decide which stable resources Terraform should own and which release-time values GitHub Actions should own. In particular, the deploy workflow currently publishes a commit-specific image and runs the migration job before updating the API. Avoid two independent writers for the same Cloud Run service.
- If Cloud Run moves to Terraform, import the existing service and any IAM resources into remote state, reconcile the configuration with the live service, and require a reviewed plan with no unexpected changes before the first apply. `terraform import` changes state, not the remote service; a later apply can still change it.
- Complete #119 and verify Cloud SQL private connectivity before declaring Direct VPC egress production-ready. Handle Cloud SQL and networking ownership separately from this first exercise.
- Add a protected, explicit apply path only after imports, ownership, rollback, and CI permissions are reviewed. Merging an ordinary application PR must not automatically apply infrastructure changes.

No GCP resources, IAM bindings, or deployment workflows are changed by this starter branch. Terraform CLI validation remains pending until the CLI is available locally or in CI.
