import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTerraformVars } from './render-terraform-vars.mjs';

const deploymentEnv = {
  PROJECT_ID: 'project-dev',
  REGION: 'us-east1',
  SERVICE: 'nido-api',
  TERRAFORM_API_IMAGE: `us-east1-docker.pkg.dev/project-dev/nido/nido-api@sha256:${'a'.repeat(64)}`,
  RUNTIME_SERVICE_ACCOUNT: 'runtime@project-dev.iam.gserviceaccount.com',
  SQL_CONNECTION: 'project-dev:us-east1:nido-postgres-dev',
  CLOUD_RUN_MEMORY: '512Mi',
  CLOUD_RUN_CPU: '1',
  CLOUD_RUN_CONCURRENCY: '80',
  CLOUD_RUN_TIMEOUT: '300',
  CLOUD_RUN_MIN_INSTANCES: '0',
  CLOUD_RUN_MAX_INSTANCES: '20',
  DB_USER: 'nido_api',
  DB_NAME: 'nido',
  DB_MIGRATIONS_RUN: 'false',
  DB_MIGRATION_TRANSACTION_MODE: 'each',
  ADMIN_EMAILS: 'admin@example.com',
  GCS_INGESTION_BUCKET: 'ingestion-dev',
  GEMINI_MODEL: 'gemini-model',
  CONCERT_GENRE_OPTIONS: 'Jazz,Rock',
  CONCERT_SYNC_GEMINI_ENABLED: 'false',
  CONCERT_SYNC_MAX_EVENTS_PER_JOB: '25',
  GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL: 'calendar@project-dev.iam.gserviceaccount.com',
  CORS_ORIGINS: 'https://example.com',
  DB_PASSWORD_SECRET: 'db-password:latest',
  FIREBASE_PRIVATE_KEY_SECRET: 'firebase-key:3',
  GEMINI_API_KEY_SECRET: 'gemini-key:4',
  GOOGLE_CALENDAR_PRIVATE_KEY_SECRET: 'calendar-key:5',
};

test('uses the existing deployment config without embedding secret values', () => {
  const vars = renderTerraformVars(deploymentEnv);
  assert.equal(vars.container_image, deploymentEnv.TERRAFORM_API_IMAGE);
  assert.equal(vars.runtime_env.DB_HOST, '/cloudsql/project-dev:us-east1:nido-postgres-dev');
  assert.equal(vars.runtime_env.DB_MIGRATIONS_RUN, 'false');
  assert.deepEqual(vars.secret_refs.DB_PASSWORD, { secret: 'db-password', version: 'latest' });
  assert.equal(vars.cloud_run_max_instances, 20);
});

test('rejects startup migrations, placeholders, and malformed secret refs', () => {
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, DB_MIGRATIONS_RUN: 'true' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, ADMIN_EMAILS: '__FROM_GITHUB_VAR__' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, DB_PASSWORD_SECRET: 'db-password' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, TERRAFORM_API_IMAGE: 'image:latest' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, CLOUD_RUN_MIN_INSTANCES: '21' }));
});
