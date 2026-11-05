import {
  parseCliOptions,
  formatStaffArchitectReview,
  formatPullRequestBody,
  generateBolognaEntry,
  createFrankfurtAgentTools,
  verifyNonZeroDiff,
  emitMissionTelemetry,
} from './run-frankfurt-mission';
import * as path from 'path';

describe('Frankfurt Mission Runner (Issue #176)', () => {
  describe('CLI Options Parser', () => {
    it('parses --issue flag correctly', () => {
      const opts = parseCliOptions(['--issue', '176', '--dry-run']);
      expect(opts.issueNumber).toBe(176);
      expect(opts.dryRun).toBe(true);
      expect(opts.maxRetries).toBe(3);
    });

    it('parses positional issue number and custom model', () => {
      const opts = parseCliOptions(['176', '--model', 'gemini-3.8-flash', '--thinking-budget', '1024']);
      expect(opts.issueNumber).toBe(176);
      expect(opts.model).toBe('gemini-3.8-flash');
      expect(opts.thinkingBudget).toBe(1024);
      expect(opts.dryRun).toBe(false);
    });

    it('throws error when issue number is missing', () => {
      expect(() => parseCliOptions(['--dry-run'])).toThrow(
        /A valid GitHub issue number is required/,
      );
    });
  });

  describe('Staff Architect Review Rubric', () => {
    it('formats exactly 3 Optimizations and 1 Concern under GEAR Level 2 standards', () => {
      const formatted = formatStaffArchitectReview({
        optimizations: [
          'Zod typed contracts on all ReAct tool boundaries',
          'Automated closed-loop verification feedback',
          'Zero-static credential parity with GCP ADC',
        ],
        concern: 'Bounded retry ceiling to prevent runaway Gemini thinking tokens',
      });

      expect(formatted).toContain('### 🏛️ Staff Architect Review Gate (GEAR Level 2)');
      expect(formatted).toContain('1. **Zod typed contracts on all ReAct tool boundaries**');
      expect(formatted).toContain('2. **Automated closed-loop verification feedback**');
      expect(formatted).toContain('3. **Zero-static credential parity with GCP ADC**');
      expect(formatted).toContain('⚠️ **Bounded retry ceiling to prevent runaway Gemini thinking tokens**');
    });
  });

  describe('Pull Request Template Formatter', () => {
    it('creates standardized PR body with issue linkage and evidence table', () => {
      const prBody = formatPullRequestBody({
        issueNumber: 176,
        title: 'Transition autonomous overnight builds to Frankfurt',
        summaryOfChanges: 'Replaced legacy Jules with native Frankfurt Mission Runner.',
        rubric: {
          optimizations: ['Opt 1', 'Opt 2', 'Opt 3'],
          concern: 'Concern 1',
        },
        verificationEvidence: [
          { name: 'Public Repo Hygiene', status: 'passed' },
          { name: 'API Jest Tests', status: 'passed' },
        ],
        diffStat: ' 3 files changed, 200 insertions(+)',
      });

      expect(prBody).toContain('Addresses and closes #176: **Transition autonomous overnight builds to Frankfurt**.');
      expect(prBody).toContain('Replaced legacy Jules with native Frankfurt Mission Runner.');
      expect(prBody).toContain('### 🛡️ Closed-Loop Verification Evidence');
      expect(prBody).toContain('| `Public Repo Hygiene` | 🟢 PASSED | Verified cleanly in closed-loop gate |');
      expect(prBody).toContain('3 files changed, 200 insertions(+)');
      expect(prBody).toContain('Closes #176');
    });
  });

  describe('Bologna Living Documentation Formatter', () => {
    it('generates standardized 4-B session entry', () => {
      const entry = generateBolognaEntry({
        dateStr: '2026-11-03',
        weekStr: 'Week 5',
        topicTitle: 'Transition to Native Frankfurt Mission Runner',
        breakthrough: 'Replacing black-box coding agents with first-party TypeScript ADK orchestrators.',
        build: 'Shipped run-frankfurt-mission.ts with bounded tools.',
        boundaryOrBug: 'Zero-diff guard blocks empty bot PRs.',
        broadcast: 'Autonomous overnight builds now run natively on Google ADK! #AIagents',
      });

      expect(entry).toContain('### 🗓️ 2026-11-03 | Week 5: Transition to Native Frankfurt Mission Runner');
      expect(entry).toContain('- **1. Breakthrough (The Concept):**');
      expect(entry).toContain('- **2. Build (The Code):**');
      expect(entry).toContain('- **3. Boundary / Bug (The Real-World Lesson):**');
      expect(entry).toContain('- **4. Broadcast (Content Hook for LinkedIn / X):**');
      expect(entry).toContain('Autonomous overnight builds now run natively on Google ADK! #AIagents');
    });
  });

  describe('Frankfurt Agent Tools', () => {
    it('registers all 9 bounded filesystem, verification, diff, delegation, and execution tools', () => {
      const tools = createFrankfurtAgentTools(process.cwd());
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('readFile');
      expect(toolNames).toContain('writeFile');
      expect(toolNames).toContain('editFile');
      expect(toolNames).toContain('listFiles');
      expect(toolNames).toContain('runVerificationGate');
      expect(toolNames).toContain('diffChecker');
      expect(toolNames).toContain('terminalExecution');
      expect(toolNames).toContain('delegateToRduBuilder');
      expect(toolNames).toContain('inspectRduReceipt');
      expect(tools).toHaveLength(9);
    });

    it('blocks directory traversal outside root path', async () => {
      const tools = createFrankfurtAgentTools(process.cwd());
      const readFileTool = tools.find((t) => t.name === 'readFile')!;

      const result = await (readFileTool as any).execute({
        filePath: '../../../../etc/passwd',
      });
      expect((result as any).error).toContain('Access denied');
    });

    it('blocks non-whitelisted terminal execution commands', async () => {
      const tools = createFrankfurtAgentTools(process.cwd());
      const terminalTool = tools.find((t) => t.name === 'terminalExecution')!;

      const result = await (terminalTool as any).execute({
        command: 'rm -rf /tmp/test',
      });
      expect((result as any).error).toContain('not in the safe command allowlist');
    });

    it('executes allowed diffChecker tool cleanly', async () => {
      const tools = createFrankfurtAgentTools(process.cwd());
      const diffTool = tools.find((t) => t.name === 'diffChecker')!;

      const result = await (diffTool as any).execute({});
      expect(typeof (result as any).diffStat).toBe('string');
    });
  });

  describe('Non-Zero Diff Verification Guard', () => {
    it('returns diff status for current repository', () => {
      const diff = verifyNonZeroDiff(process.cwd());
      expect(typeof diff.hasChanges).toBe('boolean');
      expect(typeof diff.diffStat).toBe('string');
    });
  });

  describe('Mission Telemetry Emitter', () => {
    it('returns false gracefully when supervisor API server is unreachable', async () => {
      const emitted = await emitMissionTelemetry(
        {
          runId: 'test-run-unreachable',
          issueNumber: 176,
          issueTitle: 'Test unreachable API',
          state: 'started',
        },
        'http://127.0.0.1:59999',
      );
      expect(emitted).toBe(false);
    });
  });
});
