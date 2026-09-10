#!/usr/bin/env bash
# ==============================================================================
# GCP Cloud Scheduler Setup Script for EZ Vibes Newsletter Automation
# ==============================================================================
# Project: nido-api (GCP Project ID / Number: 81555493719)
# Region: us-east1
# Schedule: Every Tuesday at 9:00 AM EST (America/New_York)
# ==============================================================================

set -euo pipefail

JOB_NAME="nido-weekly-newsletter-job"
REGION="us-east1"
TARGET_URI="https://nido-api-81555493719.us-east1.run.app/api/newsletter/generate-weekly"
SCHEDULE="0 9 * * 2"
TIMEZONE="America/New_York"

INTERNAL_SECRET="${INTERNAL_SCHEDULER_SECRET:-ezvibes_nido_scheduler_secret_2026}"

echo "🚀 Setting up GCP Cloud Scheduler Job: ${JOB_NAME}..."

# Check if job already exists
if gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" >/dev/null 2>&1; then
  echo "🔄 Updating existing Cloud Scheduler job: ${JOB_NAME}..."
  gcloud scheduler jobs update http "${JOB_NAME}" \
    --location="${REGION}" \
    --schedule="${SCHEDULE}" \
    --time-zone="${TIMEZONE}" \
    --uri="${TARGET_URI}" \
    --http-method="POST" \
    --headers="Content-Type=application/json,X-Scheduler-Secret=${INTERNAL_SECRET}" \
    --message-body='{
      "editionType": "weekly",
      "useDatabase": true,
      "autoPushToBeehiiv": true
    }'
else
  echo "✨ Creating new Cloud Scheduler job: ${JOB_NAME}..."
  gcloud scheduler jobs create http "${JOB_NAME}" \
    --location="${REGION}" \
    --schedule="${SCHEDULE}" \
    --time-zone="${TIMEZONE}" \
    --uri="${TARGET_URI}" \
    --http-method="POST" \
    --headers="Content-Type=application/json,X-Scheduler-Secret=${INTERNAL_SECRET}" \
    --message-body='{
      "editionType": "weekly",
      "useDatabase": true,
      "autoPushToBeehiiv": true
    }'
fi

echo "✅ GCP Cloud Scheduler job configured successfully!"
echo "📋 Job Details:"
echo "   - Name: ${JOB_NAME}"
echo "   - Schedule: ${SCHEDULE} (${TIMEZONE})"
echo "   - Target URI: ${TARGET_URI}"
echo "   - Auto-Push to Beehiiv: true"
