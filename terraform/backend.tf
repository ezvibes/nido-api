# ==============================================================================
# Terraform Remote State Configuration (Google Cloud Storage)
# ==============================================================================
# PCA Architecture Concept:
# The GCS backend supports state locking. Bucket object versioning provides a
# recovery path; access to state must be restricted because state is sensitive.
#
# The bucket must be bootstrapped with versioning and least-privilege access
# before terraform init. GitHub Actions supplies bucket and prefix after cutover.
# ==============================================================================

terraform {
  backend "gcs" {}
}
