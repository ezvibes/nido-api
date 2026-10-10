import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = (env, name) => {
  const value = env[name]?.trim();
  if (!value || value.startsWith('REPLACE_ME') || value === '__FROM_GITHUB_VAR__') {
    throw new Error(`Missing or placeholder deployment value: ${name}`);
  }
  return value;
};

const positiveInteger = (env, name, minimum = 0) => {
  const value = Number(required(env, name));
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`Invalid integer deployment value: ${name}`);
  }
  return value;
};

const secretRef = (env, name) => {
  const value = required(env, name);
  const separator = value.lastIndexOf(':');
  const secret = value.slice(0, separator);
  const version = value.slice(separator + 1);
  if (separator <= 0 || !/^[a-zA-Z0-9_-]+$/.test(secret) || !/^(latest|[1-9][0-9]*)$/.test(version)) {
    throw new Error(`Invalid Secret Manager reference: ${name}`);
  }
  return { secret, version };
};

export function renderTerraformVars(env) {
  const projectId = required(env, 'PROJECT_ID');
  const sqlConnection = required(env, 'SQL_CONNECTION');
  const containerImage = required(env, 'TERRAFORM_API_IMAGE');
  if (!/@sha256:[a-f0-9]{64}$/.test(containerImage)) {
    throw new Error('TERRAFORM_API_IMAGE must use an immutable SHA-256 digest');
  }
  if (required(env, 'DB_MIGRATIONS_RUN') !== 'false') {
    throw new Error('The API service must not run database migrations on startup');
  }
  const minInstances = positiveInteger(env, 'CLOUD_RUN_MIN_INSTANCES');
  const maxInstances = positiveInteger(env, 'CLOUD_RUN_MAX_INSTANCES', 1);
  if (minInstances > maxInstances) {
    throw new Error('CLOUD_RUN_MIN_INSTANCES cannot exceed CLOUD_RUN_MAX_INSTANCES');
  }

  return {
    project_id: projectId,
    region: required(env, 'REGION'),
    service_name: required(env, 'SERVICE'),
    container_image: containerImage,
    runtime_service_account: required(env, 'RUNTIME_SERVICE_ACCOUNT'),
    sql_instance_connection: sqlConnection,
    cloud_run_memory: required(env, 'CLOUD_RUN_MEMORY'),
    cloud_run_cpu: required(env, 'CLOUD_RUN_CPU'),
    cloud_run_concurrency: positiveInteger(env, 'CLOUD_RUN_CONCURRENCY', 1),
    cloud_run_timeout: positiveInteger(env, 'CLOUD_RUN_TIMEOUT', 1),
    cloud_run_min_instances: minInstances,
    cloud_run_max_instances: maxInstances,
    runtime_env: {
      NODE_ENV: 'production',
      DB_HOST: `/cloudsql/${sqlConnection}`,
      DB_PORT: '5432',
      DB_USER: required(env, 'DB_USER'),
      DB_NAME: required(env, 'DB_NAME'),
      DB_SYNCHRONIZE: 'false',
      DB_MIGRATIONS_RUN: 'false',
      DB_MIGRATION_TRANSACTION_MODE: required(env, 'DB_MIGRATION_TRANSACTION_MODE'),
      FIREBASE_PROJECT_ID: projectId,
      FIREBASE_CLIENT_EMAIL: `firebase-adminsdk-fbsvc@${projectId}.iam.gserviceaccount.com`,
      ADMIN_EMAILS: required(env, 'ADMIN_EMAILS'),
      GCS_INGESTION_BUCKET: required(env, 'GCS_INGESTION_BUCKET'),
      GEMINI_MODEL: required(env, 'GEMINI_MODEL'),
      CONCERT_GENRE_OPTIONS: required(env, 'CONCERT_GENRE_OPTIONS'),
      CONCERT_SYNC_GEMINI_ENABLED: required(env, 'CONCERT_SYNC_GEMINI_ENABLED'),
      CONCERT_SYNC_MAX_EVENTS_PER_JOB: required(env, 'CONCERT_SYNC_MAX_EVENTS_PER_JOB'),
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL: required(env, 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL'),
      CORS_ORIGINS: required(env, 'CORS_ORIGINS'),
    },
    secret_refs: {
      DB_PASSWORD: secretRef(env, 'DB_PASSWORD_SECRET'),
      FIREBASE_PRIVATE_KEY: secretRef(env, 'FIREBASE_PRIVATE_KEY_SECRET'),
      GEMINI_API_KEY: secretRef(env, 'GEMINI_API_KEY_SECRET'),
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY: secretRef(env, 'GOOGLE_CALENDAR_PRIVATE_KEY_SECRET'),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('Expected an output path for the Terraform variable file');
  writeFileSync(outputPath, `${JSON.stringify(renderTerraformVars(process.env), null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
}
