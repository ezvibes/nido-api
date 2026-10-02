import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const require = createRequire(import.meta.url);
const { runCLI } = require('jest');
const fixtureDirectory = path.join(
  root,
  'test/agent-harness/fixtures/newsletter',
);
const fixtureFiles = readdirSync(fixtureDirectory)
  .filter((name) => name.endsWith('.json'))
  .sort();
const fixtures = fixtureFiles
  .filter((name) => name !== 'catalog.json')
  .map((name) =>
    JSON.parse(readFileSync(path.join(fixtureDirectory, name), 'utf8')),
  );
const hash = (content) => createHash('sha256').update(content).digest('hex');
const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const { results } = await runCLI(
  {
    config: path.join(root, 'test/agent-harness/jest.config.json'),
    runInBand: true,
    silent: true,
    _: [],
    $0: 'newsletter-harness',
  },
  [root],
);
const assertions = results.testResults.flatMap((suite) => suite.testResults);
const scenarios = fixtures.map((fixture) => {
  const checks = assertions.filter((test) =>
    test.title.startsWith(`[${fixture.id}]`),
  );
  return {
    id: fixture.id,
    description: fixture.description,
    status:
      checks.length === 1 && checks[0].status === 'passed'
        ? 'passed'
        : 'failed',
    expectedConcertIds: fixture.expectedConcertIds,
    knownLinkStatuses: fixture.knownLinkStatuses || [],
  };
});
const success =
  results.success &&
  results.numTotalTests > 0 &&
  scenarios.every((scenario) => scenario.status === 'passed');
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  mode: 'offline-fixture-replay',
  success,
  revision: git(['rev-parse', 'HEAD']),
  workingTreeDirty: Boolean(git(['status', '--porcelain'])),
  nodeVersion: process.version,
  mockModel: 'mock-gemini',
  promptSha256: hash(
    readFileSync(path.join(root, '.gemini/prompts/weekly_top_picks.md')),
  ),
  fixturesSha256: hash(
    fixtureFiles
      .map(
        (name) =>
          `${name}\n${readFileSync(path.join(fixtureDirectory, name), 'utf8')}`,
      )
      .join('\n'),
  ),
  tests: {
    total: results.numTotalTests,
    passed: results.numPassedTests,
    failed: results.numFailedTests,
    pending: results.numPendingTests,
  },
  boundaries: {
    provider: 'mocked SDK; no live model evaluation',
    catalog: 'in-memory repository; no database integration',
    beehiiv: 'in-memory HTTP transport; draft-only payload verified',
    links: 'fixture metadata only; live URL verification not implemented',
    brandVoice: 'provisional rubric; pending human assessment',
    network:
      'fetch explicitly mocked; HTTP/HTTPS/socket calls forbidden by tests',
  },
  scenarios,
  checks: assertions.map((test) => ({
    name: test.fullName,
    status: test.status,
    failures: test.failureMessages,
  })),
};
const markdown = [
  '# Newsletter Offline Harness Report',
  '',
  `Result: **${success ? 'PASS' : 'FAIL'}**. ${report.tests.passed}/${report.tests.total} checks passed.`,
  `Generated: ${report.generatedAt}. Node: ${report.nodeVersion}.`,
  `Revision: ${report.revision}; working tree ${report.workingTreeDirty ? 'dirty (uncommitted changes included)' : 'clean'}.`,
  '',
  '| Scenario | Result | Expected sources |',
  '| --- | --- | --- |',
  ...scenarios.map(
    (scenario) =>
      `| ${scenario.id} | ${scenario.status} | ${scenario.expectedConcertIds.length} |`,
  ),
  '',
  '## Evidence Boundaries',
  ...Object.entries(report.boundaries).map(
    ([key, value]) => `- ${key}: ${value}.`,
  ),
  '- No model or Beehiiv API charges are incurred by a successful offline run.',
  '- The broken-link fixture is a known editorial warning, not proof of automatic rejection.',
  '- Passing canned output is not proof against hallucinations in live generated drafts.',
  '',
  '## Reproducibility',
  `- Prompt SHA-256: ${report.promptSha256}`,
  `- Fixtures SHA-256: ${report.fixturesSha256}`,
  '- Command: `npm run test:newsletter:harness`',
  '- Brand rubric: `test/agent-harness/brand-voice.md`',
  '',
  '## Checks',
  ...report.checks.map(
    (check) =>
      `- ${check.status}: ${check.name}${check.failures.length ? `\n\n${check.failures.join('\n')}` : ''}`,
  ),
  '',
].join('\n');
const reportDirectory = path.join(root, 'test/agent-harness/reports');
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(
  path.join(reportDirectory, 'latest.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
writeFileSync(path.join(reportDirectory, 'latest.md'), markdown);
console.log(
  `Newsletter offline harness: ${success ? 'PASS' : 'FAIL'} (${report.tests.passed}/${report.tests.total}).`,
);
console.log('Reports: test/agent-harness/reports/latest.json and latest.md');
if (process.env.GITHUB_STEP_SUMMARY)
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown, { flag: 'a' });
process.exitCode = success ? 0 : 1;
