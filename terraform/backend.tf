# ==============================================================================
# Terraform Remote State Configuration (Google Cloud Storage)
# ==============================================================================
# PCA Architecture Concept:
# The GCS backend supports state locking. Bucket object versioning provides a
# recovery path; access to state must be restricted because state is sensitive.
#
# Do not enable this backend until the maintainer has approved and bootstrapped
# a dedicated bucket with versioning and least-privilege access. See README.md.
# ==============================================================================

# terraform {
#   backend "gcs" {
#     bucket = "<approved-state-bucket>"
#     prefix = "dev/nido-api"
#   }
# }
