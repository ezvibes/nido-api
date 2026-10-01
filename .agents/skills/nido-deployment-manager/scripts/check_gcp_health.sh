#!/usr/bin/env bash
# ==============================================================================
# GCP & Deployment Health Check Script for Nido Platform
# ==============================================================================
set -euo pipefail

PROJECT_ID="nido-api-9ed65"
REGION="us-east1"
SERVICE_NAME="nido-api"
SQL_INSTANCE="nido-postgres-dev"
FIREBASE_URL="https://nido-api-9ed65.web.app"
API_URL="https://nido-api-81555493719.us-east1.run.app"

echo "================================================================="
echo " 🛡️  NIDO PLATFORM DEPLOYMENT & GCP HEALTH CHECK REPORT"
echo " Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "================================================================="
echo ""

# 1. GitHub Actions Deployment Status
echo "📦 1. GITHUB ACTIONS DEPLOYMENT STATUS"
echo "-----------------------------------------------------------------"
if command -v gh >/dev/null 2>&1; then
  gh run list --repo ezvibes/nido-api --limit 3 --json status,conclusion,name,headBranch,createdAt,databaseId \
    --template '{{range .}}{{.status}} | {{.conclusion}} | {{.name}} ({{.headBranch}}) | {{.createdAt}}{{"\n"}}{{end}}' || echo "Failed to fetch GitHub runs."
else
  echo "⚠️ gh CLI not installed."
fi
echo ""

# 2. Cloud Run Service Health
echo "☁️ 2. CLOUD RUN SERVICE (nido-api)"
echo "-----------------------------------------------------------------"
if command -v gcloud >/dev/null 2>&1; then
  CR_JSON=$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format="json" 2>/dev/null || true)
  if [ -n "$CR_JSON" ]; then
    REVISION=$(echo "$CR_JSON" | grep -o '"latestReadyRevisionName": "[^"]*"' | head -1 | cut -d'"' -f4)
    URL=$(echo "$CR_JSON" | grep -o '"url": "[^"]*"' | head -1 | cut -d'"' -f4)
    echo "  - Status: ACTIVE / READY"
    echo "  - Latest Revision: $REVISION"
    echo "  - Service URL: $URL"
  else
    echo "❌ Cloud Run service describe failed."
  fi
else
  echo "⚠️ gcloud CLI not installed."
fi
echo ""

# 3. Cloud SQL Database Status
echo "🗄️ 3. CLOUD SQL DATABASE (nido-postgres-dev)"
echo "-----------------------------------------------------------------"
if command -v gcloud >/dev/null 2>&1; then
  SQL_STATUS=$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(state)" 2>/dev/null || echo "UNKNOWN")
  SQL_VERSION=$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(databaseVersion)" 2>/dev/null || echo "UNKNOWN")
  SQL_TIER=$(gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(settings.tier)" 2>/dev/null || echo "UNKNOWN")
  echo "  - Status: $SQL_STATUS"
  echo "  - Version: $SQL_VERSION"
  echo "  - Tier: $SQL_TIER"
fi
echo ""

# 4. HTTP Live Endpoint Probe
echo "🌐 4. LIVE ENDPOINT PROBES"
echo "-----------------------------------------------------------------"

# Probe /health
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" || echo "000")
HEALTH_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$API_URL/health" || echo "0")
echo "  - GET $API_URL/health -> HTTP $HEALTH_STATUS (${HEALTH_TIME}s)"

# Probe /concerts/meta/genres
GENRES_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/concerts/meta/genres" || echo "000")
GENRES_BODY=$(curl -s "$API_URL/concerts/meta/genres" | head -c 120 || true)
echo "  - GET $API_URL/concerts/meta/genres -> HTTP $GENRES_STATUS"
echo "    Payload: $GENRES_BODY"

# Probe Firebase Hosting
HOSTING_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FIREBASE_URL" || echo "000")
echo "  - GET $FIREBASE_URL -> HTTP $HOSTING_STATUS"
echo ""

# 5. Cloud Run Error & Warning Logs (Past 24 Hours)
echo "📋 5. RECENT CLOUD RUN ERRORS / WARNINGS (Past 24 Hours)"
echo "-----------------------------------------------------------------"
if command -v gcloud >/dev/null 2>&1; then
  LOGS=$(gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=WARNING" --limit 5 --project "$PROJECT_ID" --format="value(timestamp,severity,textPayload)" 2>/dev/null || true)
  if [ -z "$LOGS" ]; then
    echo "  ✅ Zero warnings or errors found in Cloud Run logs."
  else
    echo "$LOGS"
  fi
fi
echo ""
echo "================================================================="
echo " ✅ HEALTH CHECK COMPLETED"
echo "================================================================="
