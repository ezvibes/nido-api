# 🌍 Nido Terraform Infrastructure Module

> **PCA Learning & IaC Platform Blueprint**  
> Tracks [Issue #121](https://github.com/ezvibes/nido-api/issues/121): Declarative Terraform IaC Pipeline.

This directory manages Nido's Google Cloud infrastructure declaratively using HashiCorp Configuration Language (HCL).

---

## 📁 Directory Structure

```text
terraform/
├── providers.tf            # Google Cloud provider version constraints
├── backend.tf              # Remote state configuration in Google Cloud Storage (GCS)
├── variables.tf            # Typed input parameters
├── main.tf                 # Declarative Cloud Run v2 service definition
├── outputs.tf              # Service URLs & revision outputs
├── environments/
│   └── dev.tfvars          # Development environment parameter values
└── README.md               # Architecture & learning guide
```

---

## 🎓 The 4-Step Lifecycle Commands

### 1. Initialize (`terraform init`)
Downloads the Google Cloud provider plugin and initializes the backend:
```bash
cd terraform
terraform init
```

### 2. Format & Validate Code
Ensures HCL syntax and type constraints are valid:
```bash
terraform fmt -check
terraform validate
```

### 3. Generate Execution Plan (`terraform plan`)
Performs a safe dry-run comparing code against real-world GCP:
```bash
terraform plan -var-file=environments/dev.tfvars
```
*Review the diff:*
* `+ create` (green): New resources to provision.
* `~ update in-place` (yellow): Configuration changes to existing resources.
* `- destroy` (red): Deprecated resources to remove.

### 4. Apply Changes (`terraform apply`)
Executes the approved plan against Google Cloud:
```bash
terraform apply -var-file=environments/dev.tfvars
```

---

## 🏛️ Key PCA Exam Patterns Used in This Code

1. **Declarative Idempotency:** Running `terraform apply` repeatedly produces the exact same desired state without duplicate resource creation.
2. **Direct VPC Egress (`private-ranges-only`):** Cloud Run connects directly to Cloud SQL over internal RFC 1918 IPs, while Gemini API traffic exits seamlessly via the default internet gateway.
3. **Secret Manager Bindings:** `DB_PASSWORD` and `GEMINI_API_KEY` are mounted via `secret_key_ref`, guaranteeing zero plain-text static secrets in code.
4. **Remote State in GCS:** Storing `terraform.tfstate` in an encrypted, versioned GCS bucket enables automatic state locking and team collaboration.
