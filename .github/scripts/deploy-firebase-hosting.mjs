import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const {
  FIREBASE_ACCESS_TOKEN,
  FIREBASE_PROJECT_ID = 'nido-api-9ed65',
  FIREBASE_HOSTING_SITE = FIREBASE_PROJECT_ID,
  FIREBASE_HOSTING_CHANNEL = 'live',
  FIREBASE_HOSTING_PUBLIC_DIR,
  FIREBASE_HOSTING_DRY_RUN,
  GITHUB_SHA = 'local',
} = process.env;

const dryRun = FIREBASE_HOSTING_DRY_RUN === 'true';

if (!FIREBASE_ACCESS_TOKEN && !dryRun) {
  throw new Error('FIREBASE_ACCESS_TOKEN is required.');
}

const apiBase = 'https://firebasehosting.googleapis.com/v1beta1';
const populateBatchSize = 1000;
const uploadConcurrency = 20;

async function firebaseRequest(url, options = {}) {
  if (!FIREBASE_ACCESS_TOKEN) {
    throw new Error('FIREBASE_ACCESS_TOKEN is required.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${FIREBASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? 'GET'} ${url} failed with ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined;
  }

  return response.json();
}

async function readHostingConfig() {
  const firebaseConfig = JSON.parse(await readFile('firebase.json', 'utf8'));
  const hosting = Array.isArray(firebaseConfig.hosting)
    ? firebaseConfig.hosting.find((config) => config.site === FIREBASE_HOSTING_SITE) ?? firebaseConfig.hosting[0]
    : firebaseConfig.hosting;

  if (!hosting) {
    throw new Error('firebase.json does not contain a hosting config.');
  }

  return {
    publicDir: path.resolve(FIREBASE_HOSTING_PUBLIC_DIR ?? hosting.public ?? 'public'),
    ignore: hosting.ignore ?? [],
    config: convertHostingConfig(hosting),
  };
}

function convertHostingConfig(hosting) {
  const config = {};

  if (hosting.rewrites) {
    config.rewrites = hosting.rewrites.map((rewrite) => {
      if (!rewrite.destination) {
        throw new Error('REST deploy script currently supports destination rewrites only.');
      }

      return {
        ...convertPattern(rewrite),
        path: rewrite.destination,
      };
    });
  }

  if (hosting.redirects) {
    config.redirects = hosting.redirects.map((redirect) => ({
      ...convertPattern(redirect),
      location: redirect.destination,
      ...(redirect.type ? { statusCode: redirect.type } : {}),
    }));
  }

  if (hosting.headers) {
    config.headers = hosting.headers.map((header) => ({
      ...convertPattern(header),
      headers: Object.fromEntries((header.headers ?? []).map(({ key, value }) => [key, value])),
    }));
  }

  return config;
}

function convertPattern(entry) {
  if (entry.source) {
    return { glob: entry.source };
  }
  if (entry.glob) {
    return { glob: entry.glob };
  }
  if (entry.regex) {
    return { regex: entry.regex };
  }
  throw new Error('Hosting config entry is missing source, glob, or regex.');
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(pattern) {
  let source = '^';

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === '*') {
      if (next === '*') {
        const afterGlobstar = pattern[index + 2];
        if (afterGlobstar === '/') {
          source += '(?:.*\\/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else {
      source += escapeRegExp(char);
    }
  }

  source += '$';
  return new RegExp(source);
}

function createIgnoreMatcher(ignorePatterns) {
  const matchers = ignorePatterns.map((pattern) => globToRegExp(pattern));

  return (filePath) => matchers.some((matcher) => matcher.test(filePath));
}

async function walk(dir, root = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath, root));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).split(path.sep).join('/'));
    }
  }

  return files.sort();
}

function filterIgnoredFiles(files, ignorePatterns) {
  if (ignorePatterns.length === 0) {
    return files;
  }

  const isIgnored = createIgnoreMatcher(ignorePatterns);
  return files.filter((filePath) => !isIgnored(filePath));
}

function hostingPath(filePath) {
  return `/${filePath}`;
}

async function buildManifest(files, publicDir) {
  const manifest = {};
  const uploads = new Map();

  for (const filePath of files) {
    const absolutePath = path.join(publicDir, filePath);
    const source = await readFile(absolutePath);
    const gzipped = gzipSync(source, { level: 9 });
    const hash = createHash('sha256').update(gzipped).digest('hex');

    manifest[hostingPath(filePath)] = hash;
    uploads.set(hash, { filePath, gzipped });
  }

  return { manifest, uploads };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function uploadRequiredFiles(versionName, manifest, uploads) {
  const populateUrl = `${apiBase}/${versionName}:populateFiles`;
  let requiredCount = 0;

  for (const entries of chunk(Object.entries(manifest), populateBatchSize)) {
    const populate = await firebaseRequest(populateUrl, {
      method: 'POST',
      body: JSON.stringify({ files: Object.fromEntries(entries) }),
    });

    const requiredHashes = populate.uploadRequiredHashes ?? [];
    requiredCount += requiredHashes.length;

    if (!populate.uploadUrl && requiredHashes.length > 0) {
      throw new Error('Firebase did not return an upload URL.');
    }

    await uploadHashes(populate.uploadUrl, requiredHashes, uploads);
  }

  console.log(`Firebase Hosting requires ${requiredCount} file upload(s).`);
}

async function uploadHashes(uploadUrl, requiredHashes, uploads) {
  const uploadOne = async (hash) => {
    const upload = uploads.get(hash);
    if (!upload) {
      throw new Error(`Firebase requested unknown file hash ${hash}.`);
    }

    const response = await fetch(`${uploadUrl}/${hash}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIREBASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: upload.gzipped,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Upload failed for ${upload.filePath} (${hash}) with ${response.status}: ${body}`);
    }
  };

  const pending = [...requiredHashes];
  const workers = Array.from({ length: Math.min(uploadConcurrency, pending.length) }, async () => {
    while (pending.length > 0) {
      const hash = pending.shift();
      await uploadOne(hash);
    }
  });

  await Promise.all(workers);
}

async function main() {
  const { publicDir, ignore, config } = await readHostingConfig();
  const files = filterIgnoredFiles(await walk(publicDir), ignore);
  if (files.length === 0) {
    throw new Error(`No files found in ${path.relative(process.cwd(), publicDir)}.`);
  }

  const publicDirLabel = path.relative(process.cwd(), publicDir) || publicDir;

  console.log(`Preparing Firebase Hosting deploy for site ${FIREBASE_HOSTING_SITE}.`);
  console.log(`Found ${files.length} file(s) in ${publicDirLabel}.`);
  if (ignore.length > 0) {
    console.log(`Applied ${ignore.length} firebase.json ignore pattern(s).`);
  }

  const { manifest, uploads } = await buildManifest(files, publicDir);
  console.log(`Prepared ${Object.keys(manifest).length} Hosting manifest entrie(s).`);

  if (dryRun) {
    console.log('Dry run complete. No Firebase Hosting version was created.');
    return;
  }

  const version = await firebaseRequest(
    `${apiBase}/projects/-/sites/${FIREBASE_HOSTING_SITE}/versions`,
    {
      method: 'POST',
      body: JSON.stringify({
        status: 'CREATED',
        labels: {
          'deployment-tool': 'github-actions-rest',
          'github-sha': GITHUB_SHA.slice(0, 40),
        },
      }),
    },
  );

  const versionName = version.name;
  const versionId = versionName.split('/').at(-1);
  console.log(`Created Hosting version ${versionName}.`);

  await uploadRequiredFiles(versionName, manifest, uploads);

  await firebaseRequest(
    `${apiBase}/projects/-/sites/${FIREBASE_HOSTING_SITE}/versions/${versionId}?updateMask=status,config`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'FINALIZED',
        config,
      }),
    },
  );
  console.log(`Finalized Hosting version ${versionName}.`);

  const release = await firebaseRequest(
    `${apiBase}/projects/-/sites/${FIREBASE_HOSTING_SITE}/channels/${FIREBASE_HOSTING_CHANNEL}/releases?versionName=${encodeURIComponent(versionName)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: `GitHub Actions deploy ${GITHUB_SHA.slice(0, 12)}`,
      }),
    },
  );

  console.log(`Released Firebase Hosting version: ${release.name}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
