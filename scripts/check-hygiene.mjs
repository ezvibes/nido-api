import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isFixMode =
  process.argv.includes('--fix') ||
  process.argv.includes('--auto-fix') ||
  process.env.HYGIENE_FIX === 'true' ||
  process.env.HYGIENE_AUTO_FIX === 'true';

console.log(
  `Running local repository and PR hygiene checks${isFixMode ? ' (auto-fix enabled)' : ''}...`,
);

// 1. Check for tracked secret/env files (unfixable security hygiene violation)
try {
  const trackedFiles = execSync('git ls-files', { encoding: 'utf8' });
  const forbiddenPattern =
    /(^|\/)\.env($|\.(local|development|production|test|staging|dev|prod)(\.local)?$)|firebase-creds\.json$|nido-api-.*\.json$/m;
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

// 2. Self-healing mode: auto-format, strip trailing whitespace, and fix lint on working-tree changes
if (isFixMode) {
  try {
    const statusOutput = execSync('git status --porcelain', {
      encoding: 'utf8',
    }).trim();

    if (statusOutput) {
      const statusLines = statusOutput.split('\n');
      const modifiedFiles = [];
      const stagedFiles = new Set();

      for (const line of statusLines) {
        if (!line.trim()) continue;
        const indexStatus = line[0];
        let filePath = line.slice(3).trim();
        if (filePath.includes('->')) {
          filePath = filePath.split('->').pop().trim();
        }
        filePath = filePath.replace(/^"(.*)"$/, '$1');

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          modifiedFiles.push(filePath);
          if (indexStatus !== ' ' && indexStatus !== '?') {
            stagedFiles.add(filePath);
          }
        }
      }

      // 2a. Auto-strip trailing whitespace & ensure clean EOF newline
      const textExtensions = new Set([
        '.ts',
        '.js',
        '.mjs',
        '.json',
        '.md',
        '.vue',
        '.yml',
        '.yaml',
        '.css',
        '.scss',
        '.html',
        '.sql',
        '.sh',
        '.txt',
      ]);

      let whitespaceFixedCount = 0;
      for (const file of modifiedFiles) {
        const ext = path.extname(file).toLowerCase();
        if (textExtensions.has(ext) || ext === '') {
          try {
            const raw = fs.readFileSync(file, 'utf8');
            let cleaned = raw.replace(/[ \t]+$/gm, '');
            if (cleaned.length > 0) {
              cleaned = cleaned.trimEnd() + '\n';
            }
            if (cleaned !== raw) {
              fs.writeFileSync(file, cleaned, 'utf8');
              whitespaceFixedCount++;
              if (stagedFiles.has(file)) {
                execSync(`git add "${file}"`);
              }
            }
          } catch {
            // Ignore non-utf8 or inaccessible files
          }
        }
      }
      if (whitespaceFixedCount > 0) {
        console.log(
          `Self-healing hygiene: auto-stripped trailing whitespace in ${whitespaceFixedCount} file(s).`,
        );
      }

      // 2b. Run prettier on modified files
      const prettierExtensions = new Set([
        '.ts',
        '.js',
        '.mjs',
        '.json',
        '.md',
        '.vue',
        '.yml',
        '.yaml',
      ]);
      const prettierTargets = modifiedFiles.filter((f) =>
        prettierExtensions.has(path.extname(f).toLowerCase()),
      );
      if (prettierTargets.length > 0) {
        try {
          const filesArg = prettierTargets.map((f) => `"${f}"`).join(' ');
          execSync(`npx prettier --write ${filesArg}`, { stdio: 'pipe' });
          console.log(
            `Self-healing hygiene: auto-formatted ${prettierTargets.length} file(s) with Prettier.`,
          );
          for (const file of prettierTargets) {
            if (stagedFiles.has(file)) {
              execSync(`git add "${file}"`);
            }
          }
        } catch (e) {
          console.warn('Prettier auto-formatting warning:', e.message);
        }
      }

      // 2c. Run eslint --fix on modified ts/js/vue files
      const eslintTargets = modifiedFiles.filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return (
          (ext === '.ts' || ext === '.js' || ext === '.vue') &&
          (f.startsWith('src/') || f.startsWith('test/'))
        );
      });
      if (eslintTargets.length > 0) {
        try {
          const filesArg = eslintTargets.map((f) => `"${f}"`).join(' ');
          execSync(`npx eslint --fix ${filesArg}`, { stdio: 'pipe' });
          console.log(
            `Self-healing hygiene: auto-fixed ESLint on ${eslintTargets.length} file(s).`,
          );
          for (const file of eslintTargets) {
            if (stagedFiles.has(file)) {
              execSync(`git add "${file}"`);
            }
          }
        } catch (e) {
          console.warn(
            'ESLint auto-fix warning (some rules may require manual review):',
            e.message,
          );
        }
      }
    }
  } catch (err) {
    console.warn('Self-healing auto-fix error:', err.message);
  }
}

// 3. Check whitespace across working tree and diff
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
  console.error(
    'Whitespace hygiene check failed. Fix trailing whitespace or extra blank lines at EOF.',
  );
  if (!isFixMode) {
    console.error(
      'Self-healing tip: Run "npm run hygiene:fix" (or "node scripts/check-hygiene.mjs --fix") to automatically format code and clean trailing whitespace.',
    );
  }
  process.exit(1);
}

console.log('Public repo and PR hygiene checks passed cleanly.');
