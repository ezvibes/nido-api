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
  BEEHIIV_PUBLICATION_ID: 'pub_83e3968e-2648-46bd-b71b-ac9a35e4bab4',
  DB_PASSWORD_SECRET: 'db-password:latest',
  FIREBASE_PRIVATE_KEY_SECRET: 'firebase-key:3',
  GEMINI_API_KEY_SECRET: 'gemini-key:4',
  GOOGLE_CALENDAR_PRIVATE_KEY_SECRET: 'calendar-key:5',
  BEEHIIV_API_KEY_SECRET: 'nido-beehiiv-api-key:latest',
  INTERNAL_SCHEDULER_SECRET_NAME: 'nido-scheduler-secret:latest',
};

test('uses the existing deployment config without embedding secret values', () => {
  const vars = renderTerraformVars(deploymentEnv);
  assert.equal(vars.container_image, deploymentEnv.TERRAFORM_API_IMAGE);
  assert.equal(vars.runtime_env.DB_HOST, '/cloudsql/project-dev:us-east1:nido-postgres-dev');
  assert.equal(vars.runtime_env.DB_MIGRATIONS_RUN, 'false');
  assert.equal(vars.runtime_env.BEEHIIV_PUBLICATION_ID, 'pub_83e3968e-2648-46bd-b71b-ac9a35e4bab4');
  assert.deepEqual(vars.secret_refs.DB_PASSWORD, { secret: 'db-password', version: 'latest' });
  assert.deepEqual(vars.secret_refs.BEEHIIV_API_KEY, { secret: 'nido-beehiiv-api-key', version: 'latest' });
  assert.deepEqual(vars.secret_refs.INTERNAL_SCHEDULER_SECRET, {
    secret: 'nido-scheduler-secret',
    version: 'latest',
  });
  assert.equal(vars.cloud_run_max_instances, 20);
  assert.equal(vars.vpc_network, null);
  assert.equal(vars.vpc_subnet, null);
  assert.equal(vars.vpc_egress, null);
});

test('renders Direct VPC Egress variables when configured', () => {
  const vars = renderTerraformVars({
    ...deploymentEnv,
    VPC_NETWORK: 'default',
    VPC_SUBNET: 'default',
    VPC_EGRESS: 'private-ranges-only',
  });
  assert.equal(vars.vpc_network, 'default');
  assert.equal(vars.vpc_subnet, 'default');
  assert.equal(vars.vpc_egress, 'PRIVATE_RANGES_ONLY');

  const allTrafficVars = renderTerraformVars({
    ...deploymentEnv,
    VPC_NETWORK: 'my-vpc',
    VPC_SUBNET: 'my-subnet',
    VPC_EGRESS: 'all-traffic',
  });
  assert.equal(allTrafficVars.vpc_network, 'my-vpc');
  assert.equal(allTrafficVars.vpc_subnet, 'my-subnet');
  assert.equal(allTrafficVars.vpc_egress, 'ALL_TRAFFIC');
});

test('rejects startup migrations, placeholders, and malformed secret refs', () => {
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, DB_MIGRATIONS_RUN: 'true' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, ADMIN_EMAILS: '__FROM_GITHUB_VAR__' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, DB_PASSWORD_SECRET: 'db-password' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, TERRAFORM_API_IMAGE: 'image:latest' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, CLOUD_RUN_MIN_INSTANCES: '21' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, VPC_NETWORK: 'Invalid_Network', VPC_SUBNET: 'default' }));
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, VPC_NETWORK: 'default', VPC_SUBNET: 'Invalid_Subnet' }));
  assert.throws(() =>
    renderTerraformVars({
      ...deploymentEnv,
      VPC_NETWORK: 'default',
      VPC_SUBNET: 'default',
      VPC_EGRESS: 'invalid-egress',
    }),
  );
  assert.throws(() => renderTerraformVars({ ...deploymentEnv, VPC_NETWORK: 'default' }));
});
