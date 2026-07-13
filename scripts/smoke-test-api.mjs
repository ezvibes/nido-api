const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:3001';
const DEFAULT_DEV_BASE_URL = 'https://nido-api-81555493719.us-east1.run.app';

const mode = process.env.SMOKE_MODE ?? 'local';
const baseUrl = normalizeBaseUrl(
  process.env.API_BASE_URL ?? (mode === 'dev' ? DEFAULT_DEV_BASE_URL : DEFAULT_LOCAL_BASE_URL),
);
const deepEnabled = parseBoolean(process.env.SMOKE_DEEP, mode === 'dev');
const concertsEnabled = parseBoolean(process.env.SMOKE_CONCERTS, false);
const retries = Number(process.env.SMOKE_RETRIES ?? (mode === 'dev' ? 5 : 1));
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS ?? 3000);
const requestTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10000);

const checks = [
  {
    name: 'basic health',
    path: '/health',
    validate: async (response) => {
      const body = await response.json();
      assertEqual(body.status, 'ok', 'health status');
    },
  },
  {
    name: 'OpenAPI document',
    path: '/api-docs-json',
    validate: async (response) => {
      const body = await response.json();
      assertEqual(body.openapi, '3.0.0', 'OpenAPI version');
      if (!body.paths || typeof body.paths !== 'object') {
        throw new Error('OpenAPI paths object is missing');
      }
    },
  },
];

if (deepEnabled) {
  checks.push({
    name: 'deep health',
    path: '/health/deep',
    validate: async (response) => {
      const body = await response.json();
      assertEqual(body.status, 'ok', 'deep health status');
      assertEqual(body.checks?.database?.status, 'ok', 'database status');
    },
  });
}

if (concertsEnabled) {
  checks.push({
    name: 'public concerts feed',
    path: `/concerts?pageSize=1&startsAfter=${encodeURIComponent(new Date().toISOString())}`,
    validate: async (response) => {
      const body = await response.json();
      if (!Array.isArray(body.items)) {
        throw new Error('concerts response does not include an items array');
      }
    },
  });
}

console.log(`Smoke testing ${baseUrl} (${mode})`);

let failures = 0;
for (const check of checks) {
  try {
    await runWithRetries(check);
    console.log(`ok - ${check.name}`);
  } catch (error) {
    failures += 1;
    console.error(`fail - ${check.name}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`${failures} smoke check(s) failed`);
  process.exit(1);
}

console.log('Smoke checks passed');

async function runWithRetries(check) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      const response = await fetch(`${baseUrl}${check.path}`, {
        headers: requestHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${body.slice(0, 200)}`);
      }

      await check.validate(response);
      return;
    } catch (error) {
      lastError = normalizeError(error);
      if (attempt < retries) {
        await delay(retryDelayMs);
      }
    }
  }

  throw lastError;
}

function normalizeError(error) {
  if (error.name === 'AbortError') {
    return new Error(`request timed out after ${requestTimeoutMs}ms`);
  }

  if (error.cause?.message) {
    return new Error(`${error.message}: ${error.cause.message}`);
  }

  return error;
}

function requestHeaders() {
  const headers = { accept: 'application/json' };
  if (process.env.API_BEARER_TOKEN) {
    headers.authorization = `Bearer ${process.env.API_BEARER_TOKEN}`;
  }
  return headers;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, got ${actual}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
