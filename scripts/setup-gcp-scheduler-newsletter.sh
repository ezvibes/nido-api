#!/usr/bin/env bash

# setup-gcp-scheduler-newsletter.sh
# Provision GCP Cloud Scheduler Job for Weekly Top Picks Newsletter Generation

set -euo pipefail

JOB_NAME="nido-weekly-newsletter-generator"
LOCATION="us-east1"
SCHEDULE="0 9 * * 2" # Every Tuesday at 9:00 AM EST
TIME_ZONE="America/New_York"
TARGET_URI="https://nido-api-81555493719.us-east1.run.app/api/newsletter/generate-weekly"
SECRET_HEADER_NAME="X-Scheduler-Secret"
SECRET_HEADER_VALUE="${INTERNAL_SCHEDULER_SECRET:-default-scheduler-secret-change-me}"

echo "Creating GCP Cloud Scheduler job '${JOB_NAME}' in ${LOCATION}..."

gcloud scheduler jobs create http "${JOB_NAME}" \
  --location="${LOCATION}" \
  --schedule="${SCHEDULE}" \
  --time-zone="${TIME_ZONE}" \
  --uri="${TARGET_URI}" \
  --http-method="POST" \
  --headers="Content-Type=application/json,${SECRET_HEADER_NAME}=${SECRET_HEADER_VALUE}" \
  --message-body='{"editionType":"weekly","autoPushToBeehiiv":true}' \
  --description="Automated weekly newsletter generation & Beehiiv draft push" || \
gcloud scheduler jobs update http "${JOB_NAME}" \
  --location="${LOCATION}" \
  --schedule="${SCHEDULE}" \
  --time-zone="${TIME_ZONE}" \
  --uri="${TARGET_URI}" \
  --http-method="POST" \
  --headers="Content-Type=application/json,${SECRET_HEADER_NAME}=${SECRET_HEADER_VALUE}" \
  --message-body='{"editionType":"weekly","autoPushToBeehiiv":true}' \
  --description="Automated weekly newsletter generation & Beehiiv draft push"

echo "Cloud Scheduler job successfully provisioned!"
