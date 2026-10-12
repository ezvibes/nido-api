# Terraform Infrastructure Review & Architectural Roadmap

## Executive Summary

This document provides an engineering review of the Nido Terraform infrastructure configuration, CI/CD deployment mechanics, and architectural roadmap.

The initial implementation manages the **dev Cloud Run API service** (`nido-api`) using Terraform 1.5+ and the `hashicorp/google` v6 provider. The architecture establishes a **guarded single-writer deployment pipeline** where GitHub Actions builds SHA-pinned immutable container images, executes database migrations in an isolated Cloud Run job, validates that the Terraform execution plan alters *only* the container image digest (or remains a no-op), applies the Terraform update, and verifies API health before deploying the web frontend to Firebase Hosting.

Overall, the current setup is **exceptionally robust, disciplined, and security-minded**. It avoids common Infrastructure-as-Code (IaC) pitfalls by enforcing strict plan validation, preventing accidental resource deletion, and isolating database schema migrations from API runtime startup.

---

## Current Architecture & Effectiveness Assessment

```
                      +-------------------------------------------------+
                      |              GitHub Actions Pipeline            |
                      +-------------------------------------------------+
                                               |
                     1. Build & Push SHA-256   v
                     +--------------------------------------------------+
                     | Artifact Registry (us-east1-docker.pkg.dev/...)  |
                     +--------------------------------------------------+
                                               |
                     2. Execute Schema         v
                     +--------------------------------------------------+
                     | Cloud Run Migration Job (npm run migrate)       |
                     +--------------------------------------------------+
                                               |
                     3. Render & Validate      v
                     +--------------------------------------------------+
                     | Terraform Plan Guard (validate-terraform-plan)  |
                     +--------------------------------------------------+
                                               |
                     4. Apply Digest Update    v
                     +--------------------------------------------------+
                     | Cloud Run v2 API Service (nido-api)              |
                     +--------------------------------------------------+
```

### Key Strengths

1. **Guarded Single-Writer Release Pipeline (`validate-terraform-plan.mjs`)**:
   - The workflow executes `terraform plan -out=tfplan` and inspects the JSON output using a custom Node.js script.
   - It asserts that the plan contains **exactly one** resource modification on `google_cloud_run_v2_service.nido_api` and that all non-image attributes (CPU, memory, env vars, secrets, Cloud SQL attachments) remain strictly unchanged.
   - This prevents silent configuration drift or accidental infrastructure mutation during routine code deployments.

2. **Decoupled Database Schema Migrations**:
   - Schema migrations are executed via a dedicated Cloud Run Job *before* the new API container revision is deployed.
   - The API service operates with `DB_SYNCHRONIZE=false` and `DB_MIGRATIONS_RUN=false`, eliminating migration race conditions across auto-scaling instances.

3. **Multi-Layered Deletion Protection**:
   - Terraform resource block enforces `prevent_destroy = true` within HCL lifecycle meta-arguments.
   - Cloud Run service specifies `deletion_protection = true` at the provider level.

4. **Immutable Artifact Pinned by SHA-256 Digest**:
   - Deployments do not use moving image tags like `:latest` or git branch tags. Every release targets an explicit `@sha256:...` content hash, guaranteeing deterministic execution and auditability.

5. **Hardened Remote State Backend (`GCS`)**:
   - Remote state is stored in a dedicated GCS bucket (`nido-api-9ed65-tfstate-dev`) with uniform bucket-level access, public access prevention, object versioning, and state locking.

---

## Architectural Concerns & Identified Risks

| Area | Issue / Risk | Severity | Mitigating Recommendation |
| :--- | :--- | :--- | :--- |
| **Networking** | Cloud SQL connectivity currently relies on public Cloud SQL instance IP and Cloud SQL Auth Proxy socket mounts (`/cloudsql/...`). | **High** | Transition to private IP connectivity via Serverless VPC Access Connector or Direct VPC Egress (Issue #119). |
| **IAM & Secrets** | Secret Manager IAM bindings are managed manually out-of-band rather than declaratively in Terraform under least-privilege principles. | **Medium** | Declare `google_secret_manager_secret_iam_member` resources binding the runtime service account to required secrets. |
| **Environment Scaling** | Single root configuration (`terraform/`) with static variables file rendering works for `dev`, but lacks a clear pattern for `staging` and `prod`. | **Medium** | Structure infrastructure into reusable HCL modules with directory-based environment separation. |
| **Input Validation** | Terraform variables historically lacked regex constraint rules, relying solely on upstream CI script validation. | **Low** *(Addressed)* | Added HCL `validation` blocks in `variables.tf` for project IDs, regions, CPU/memory units, and image digests. |

---

## 3 Strategic Suggestions for Architectural Enhancement

### 1. Hardened Variable Validations & Standard Resource Labeling
**Status:** *HCL Enhancements Applied to Repo*

* **HCL Input Constraints:** Added comprehensive validation blocks in `terraform/variables.tf` enforcing:
  - Project ID format (`^[a-z][a-z0-9-]{4,29}$`)
  - GCP Region naming (`^[a-z]+-[a-z]+[0-9]$`)
  - Immutable Container Image Digests (`@sha256:[a-f0-9]{64}$`)
  - Cloud Run Memory (`Mi`/`Gi` units) and CPU limits
  - Cloud SQL Connection string schema (`project:region:instance`)
* **Resource Labeling & FinOps Metadata:** Attached standard metadata labels (`managed-by = "terraform"`, `component = "api"`, `app = "nido"`, `environment = "dev"`) to `google_cloud_run_v2_service` for precise cost allocation, with `ignore_changes` handling operational labels.

---

### 2. Multi-Environment & Modular Infrastructure Architecture
To scale safely from `dev` to `staging` and `prod`, avoid Terraform Workspaces for separate environment lifecycles. Instead, adopt **Directory/Folder Isolation with Reusable Infrastructure Modules**.

#### Directory Structure Strategy

```text
terraform/
├── modules/
│   ├── cloud_run_api/          # Encapsulates Cloud Run v2 service, IAM, and health probes
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── vpc_networking/         # Manages VPC, Subnets, and Serverless VPC Connector
│   └── secret_iam/             # Least-privilege Secret Manager accessor bindings
│
└── environments/
    ├── dev/
    │   ├── main.tf             # Instantiates modules with dev settings
    │   ├── backend.tf          # prefix = "dev/nido-api"
    │   └── terraform.tfvars
    ├── staging/
    │   ├── main.tf             # Instantiates modules with staging settings
    │   ├── backend.tf          # prefix = "staging/nido-api"
    │   └── terraform.tfvars
    └── prod/
        ├── main.tf             # Instantiates modules with prod settings
        ├── backend.tf          # prefix = "prod/nido-api"
        └── terraform.tfvars
```

#### Why Folder Isolation beats Workspaces for GCP Environments
- **State Isolation:** Prevents a blast radius where a state bug or accidental `terraform destroy` in dev affects production.
- **Provider & Credentials Separation:** Allows staging and production to run under separate GCP Projects and distinct Workload Identity Service Accounts.
- **Independent Versioning:** Allows testing module refactors in `dev` before upgrading `prod`.

---

### 3. Issue #119 Roadmap: Private Cloud SQL Connectivity & Secret IAM

#### A. Private Cloud SQL via Serverless VPC Access / Direct VPC Egress
To satisfy Priority 2 (Security & Least Privilege), eliminate public IP connectivity to Cloud SQL by establishing a private network path.

##### HCL Module Blueprint (`modules/vpc_networking`)

```hcl
# Private VPC Network
resource "google_compute_network" "vpc" {
  name                    = "${var.environment}-nido-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.environment}-nido-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id
}

# Serverless VPC Access Connector for Cloud Run
resource "google_vpc_access_connector" "connector" {
  name          = "${var.environment}-cr-vpc-conn"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 3
  machine_type  = "e2-micro"
}

# Cloud Run Direct VPC / VPC Access Connector Attachment
# In Cloud Run v2 resource:
# template {
#   vpc_access {
#     connector = google_vpc_access_connector.connector.id
#     egress    = "PRIVATE_RANGES_ONLY"
#   }
# }
```

#### B. Declarative Secret Manager IAM Access
Replace manual Secret Manager role assignments with declarative, least-privilege Terraform bindings targeting only the specific secrets used by the runtime service account:

```hcl
resource "google_secret_manager_secret_iam_member" "api_db_password" {
  project   = var.project_id
  secret_id = "DB_PASSWORD"
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.runtime_service_account}"
}
```

---

## Game-Changer Feature: PR Ephemeral Preview Environments with FinOps Downscaling

### Concept Overview
When developers open a Pull Request affecting API routes or AI agents (ADK venue scout, newsletter agents, etc.), CI automatically provisions a **dedicated, lightweight Cloud Run Revision or Ephemeral Service** with a unique preview URL (e.g., `https://pr-142---nido-api-dev.a.run.app`).

This allows full integration testing and visual frontend testing against live agent endpoints before code hits `main`.

```
                  +----------------------------------------------+
                  |              Pull Request Opened             |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  | GitHub Actions: Build & Deploy PR Revision   |
                  | gcloud run deploy nido-api-pr-142 --no-traffic|
                  | or Tagged Revision: pr-142---nido-api        |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |  Ephemeral URL Generated & Commented on PR    |
                  |  "Preview API: https://pr-142.nido.dev"      |
                  +----------------------------------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
        +----------------------------+       +----------------------------+
        | Idle State (FinOps)        |       | PR Merged / Closed         |
        | Min-Instances = 0          |       | Automated Cleanup          |
        | Cold Storage Cost: $0.00   |       | Delete PR Revision / Tag   |
        +----------------------------+       +----------------------------+
```

### Key Technical Architecture

1. **Tag-Based Revision URLs (Zero Extra Service Overhead)**:
   - Cloud Run natively supports revision traffic tags. Instead of creating new Cloud Run services for every PR, CI deploys a new revision to `nido-api` with a traffic tag `pr-142` and `0%` global traffic allocation.
   - GCP automatically provisions a dedicated URL: `https://pr-142---nido-api-9ed65-uc.a.run.app`.

2. **Automated FinOps Idle Safeguard ($0 Standby Cost)**:
   - PR preview revisions inherit `min_instances = 0` and `cpu_idle = true`.
   - When no HTTP requests are hitting the PR preview, zero container instances run, incurring **$0/hour compute cost**.

3. **Lifecycle Cleanup via GitHub Actions**:
   - On PR close or merge event (`pull_request: [closed]`), a lightweight cleanup job executes:
     `gcloud run services update nido-api --remove-tags=pr-${{ github.event.number }}`

4. **PR Preview Comment Automation**:
   - CI posts a sticky comment on the PR containing:
     - Ephemeral API Health Link (`/health`)
     - Interactive Swagger UI / OpenAPI Spec URL
     - Client preview URL pointed to the ephemeral backend.

---

## Summary Recommendation Matrix

| Roadmap Item | Implementation Effort | Value / Impact | Recommended Phase |
| :--- | :--- | :--- | :--- |
| **HCL Input Validations & Labels** | Low (Completed) | High | Immediate |
| **Directory-Based Multi-Env Refactor** | Medium | High | Phase 1 (Pre-Production) |
| **Issue #119: Private VPC Cloud SQL** | Medium | Critical | Phase 1 (Pre-Production) |
| **Least-Privilege Secret Manager IAM** | Low | High | Phase 1 (Pre-Production) |
| **PR Ephemeral Preview Environments** | Medium-High | Game Changer | Phase 2 (Developer Velocity) |
