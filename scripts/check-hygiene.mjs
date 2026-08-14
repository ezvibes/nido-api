import { execSync } from 'child_process';

console.log('Running local repository and PR hygiene checks...');

// 1. Check for tracked secret/env files
try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
  const forbiddenPattern = /(^|\/)\.env($|\.(local|development|production|test|staging|dev|prod)(\.local)?$)|firebase-creds\.json$|nido-api-.*\.json$/m;
  const matches = trackedFiles
    .split('\n')
    .filter((file) => forbiddenPattern.test(file.trim()));

  if (matches.length > 0) {
    console.error('Forbidden local secret/config files are tracked in git:');
    matches.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
} catch (err) {
  console.error('Error checking tracked secret files:', err.message);
  process.exit(1);
}

// 2. Check whitespace across working tree and diff
try {
  execSync('git diff --check', { stdio: 'inherit' });
  execSync('git diff --check --staged', { stdio: 'inherit' });
  // Also check against main / origin/main if available
  try {
    execSync('git diff --check origin/main...HEAD', { stdio: 'inherit' });
  } catch {
    try {
      execSync('git diff --check main...HEAD', { stdio: 'inherit' });
    } catch {
      // If detached or no main ref, already validated working tree & staged
    }
  }
} catch (err) {
  console.error('Whitespace hygiene check failed. Fix trailing whitespace or extra blank lines at EOF.');
  process.exit(1);
}

console.log('Public repo and PR hygiene checks passed cleanly.');
