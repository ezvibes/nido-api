---
name: gcp-deployment-manager
description: Adapter for Nido deployment and GCP/Firebase operations. Use the canonical repo skill at .agents/skills/nido-deployment-manager/SKILL.md.
---

# GCP Deployment Manager Adapter

Use `.agents/skills/nido-deployment-manager/SKILL.md` as the canonical Nido
deployment and GCP/Firebase operations skill.

This Antigravity skill exists only for compatibility with existing routing. Do
not duplicate deployment commands, Terraform proposals, secret names, or rollout
rules here. Update the canonical skill instead.
# 2. Inspect active Cloud Scheduler triggers
gcloud scheduler jobs list --location us-east1

# 3. Check Secret Manager secret versions
gcloud secrets versions list nido-beehiiv-api-key
gcloud secrets versions list nido-scheduler-secret
```
