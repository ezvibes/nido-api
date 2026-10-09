# ==============================================================================
# Terraform Remote State Configuration (Google Cloud Storage)
# ==============================================================================
# PCA Architecture Concept:
# Storing state in GCS enables team collaboration, state locking via GCS object holds,
# and encrypted, versioned backup of cloud infrastructure state.
#
# To activate remote state:
# 1. Create a GCS bucket: gcloud storage buckets create gs://nido-terraform-state-<PROJECT_ID> --location=us-east1
# 2. Enable object versioning: gcloud storage buckets update gs://nido-terraform-state-<PROJECT_ID> --versioning
# 3. Uncomment the block below and run: terraform init -migrate-state
# ==============================================================================

# terraform {
#   backend "gcs" {
#     bucket = "nido-terraform-state-dev"
#     prefix = "terraform/state/nido-api"
#   }
# }
