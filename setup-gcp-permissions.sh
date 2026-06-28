#!/bin/bash
set -e

PROJECT_ID="nido-api-9ed65"
PROJECT_NUMBER="81555493719"
REPO="ezvibes/nido-api"
RUNTIME_SA="nido-api-runtime@nido-api-9ed65.iam.gserviceaccount.com"
DEPLOYER_SA="github-deployer@nido-api-9ed65.iam.gserviceaccount.com"

echo "=== 1. Enabling required Google Cloud APIs ==="
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  --project="$PROJECT_ID"

echo "=== 2. Setting up Runtime Service Account Permissions ==="
# Secret Manager access
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/secretmanager.secretAccessor"

# Cloud SQL connection access
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/cloudsql.client"

# GCS Bucket access (Object Admin)
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" \
  --role="roles/storage.objectAdmin"

echo "=== 3. Creating/Setting up Deployer Service Account ==="
# Check if deployer SA exists, if not create it
if ! gcloud iam service-accounts describe "$DEPLOYER_SA" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating deployer service account..."
  gcloud iam service-accounts create github-deployer \
    --display-name="GitHub Actions Deployer" \
    --project="$PROJECT_ID"
else
  echo "Deployer service account already exists."
fi

# Grant deployer SA required roles
echo "Granting Artifact Registry Writer role..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/artifactregistry.writer"

echo "Granting Cloud Run Admin role..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/run.admin"

echo "Granting Firebase Admin role..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/firebase.admin"

echo "Allowing deployer SA to act as the runtime service account..."
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --project="$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/iam.serviceAccountUser"

echo "=== 4. Setting up Workload Identity Federation (WIF) ==="
# Create Workload Identity Pool if not exists
if ! gcloud iam workload-identity-pools describe "github-pool" --project="$PROJECT_ID" --location="global" >/dev/null 2>&1; then
  echo "Creating Workload Identity Pool..."
  gcloud iam workload-identity-pools create "github-pool" \
    --project="$PROJECT_ID" \
    --location="global" \
    --display-name="GitHub Actions Pool"
else
  echo "Workload Identity Pool 'github-pool' already exists."
fi

# Create OIDC Provider if not exists
if ! gcloud iam workload-identity-pools providers describe "github-provider" --project="$PROJECT_ID" --location="global" --workload-identity-pool="github-pool" >/dev/null 2>&1; then
  echo "Creating OIDC Provider..."
  gcloud iam workload-identity-pools providers create-oidc "github-provider" \
    --project="$PROJECT_ID" \
    --location="global" \
    --workload-identity-pool="github-pool" \
    --display-name="GitHub Actions Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository == 'ezvibes/nido-api'"
else
  echo "OIDC Provider 'github-provider' already exists."
fi

# Authorize GitHub Repo to act as deployer SA
echo "Binding GitHub repository to Deployer Service Account..."
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${REPO}"

echo "=== Setup complete! ==="
echo "Workload Identity Provider resource path:"
echo "projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
echo "Deploy Service Account email:"
echo "$DEPLOYER_SA"
