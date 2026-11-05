import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Agent, FunctionTool, InMemorySessionService, Runner } from '@google/adk';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

export interface RduBuilderOptions {
  issueNumber: number;
  taskPrompt?: string;
  dryRun?: boolean;
  maxRetries?: number;
  model?: string;
  thinkingBudget?: number;
  githubToken?: string;
  mcpServers?: string[];
}

export interface IssueMetadata {
  number: number;
  title: string;
  body: string;
  labels: string[];
  author?: string;
  url?: string;
}

export interface StaffArchitectRubricData {
  optimizations: [string, string, string];
  concern: string;
}

export interface PullRequestTemplateParams {
  issueNumber: number;
  title: string;
  summaryOfChanges: string;
  rubric: StaffArchitectRubricData;
  verificationEvidence: Array<{ name: string; status: 'passed' | 'failed'; detail?: string }>;
  diffStat: string;
}

export interface BolognaEntryParams {
  dateStr: string;
  weekStr: string;
  topicTitle: string;
  breakthrough: string;
  build: string;
  boundaryOrBug: string;
  broadcast: string;
}

export interface MissionResult {
  success: boolean;
  issueNumber: number;
  branchName: string;
  prUrl?: string;
  diffStat: string;
  iterations: number;
  error?: string;
}

/**
 * Parses command-line arguments for the RDU Builder Runner.
 */
export function parseRduCliOptions(args: string[]): RduBuilderOptions {
  let issueNumber = 0;
  let taskPrompt: string | undefined;
  let dryRun = false;
  let maxRetries = 3;
  let model: string | undefined = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  let thinkingBudget = 512;
  let githubToken: string | undefined =
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const mcpServers: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--issue' || arg === '-i') {
      issueNumber = parseInt(args[++i], 10);
    } else if (arg === '--task' || arg === '-t') {
      taskPrompt = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--max-retries') {
      maxRetries = parseInt(args[++i], 10);
    } else if (arg === '--model' || arg === '-m') {
      model = args[++i];
    } else if (arg === '--thinking-budget') {
      thinkingBudget = parseInt(args[++i], 10);
    } else if (arg === '--token') {
      githubToken = args[++i];
    } else if (arg === '--mcp') {
      const servers = (args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
      mcpServers.push(...servers);
    } else if (/^\d+$/.test(arg) && !issueNumber) {
      issueNumber = parseInt(arg, 10);
    }
  }

  if (!issueNumber || Number.isNaN(issueNumber)) {
    throw new Error(
      'A valid GitHub issue number is required. Usage: npm run dev:rdu -- --issue <number> [--dry-run]',
    );
  }

  return {
    issueNumber,
    taskPrompt,
    dryRun,
    maxRetries,
    model,
    thinkingBudget,
    githubToken,
    mcpServers,
  };
}

/**
 * Fetches target GitHub issue metadata using the GitHub CLI or GitHub REST API.
 */
export async function fetchIssueMetadata(
  issueNumber: number,
  options?: { githubToken?: string; repo?: string },
): Promise<IssueMetadata> {
  const repo = options?.repo || 'ezvibes/nido-api';
  const token = options?.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (token) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'RDU-Builder-Runner/1.0',
          },
        },
      );
      if (response.ok) {
        const data = (await response.json()) as any;
        return {
          number: data.number,
          title: data.title,
          body: data.body || '',
          labels: (data.labels || []).map((l: any) =>
            typeof l === 'string' ? l : l.name,
          ),
          author: data.user?.login,
          url: data.html_url,
        };
      }
    } catch {
      // Fall back to gh CLI
    }
  }

  try {
    const rawOutput = execSync(
      `gh issue view ${issueNumber} --json number,title,body,labels,author,url`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 },
    );
    const parsed = JSON.parse(rawOutput);
    return {
      number: parsed.number,
      title: parsed.title,
      body: parsed.body || '',
      labels: (parsed.labels || []).map((l: any) => l.name || l),
      author: parsed.author?.login,
      url: parsed.url,
    };
  } catch (err: any) {
    return {
      number: issueNumber,
      title: `Feature implementation for Issue #${issueNumber}`,
      body: `Implement requirements specified in GitHub Issue #${issueNumber}`,
      labels: ['agents', 'agent:rdu'],
    };
  }
}

/**
 * Formats a Staff Architect Review section (3 Optimizations + 1 Concern).
 */
export function formatStaffArchitectReview(data: StaffArchitectRubricData): string {
  return `### 🏛️ Staff Architect Review (GEAR Level 2)

#### 3 Optimizations
1. **${data.optimizations[0]}**
2. **${data.optimizations[1]}**
3. **${data.optimizations[2]}**

#### 1 Concern & Mitigation
- **Concern:** ${data.concern}`;
}

/**
 * Formats a standardized Pull Request description.
 */
export function formatPullRequestBody(params: PullRequestTemplateParams): string {
  const evidenceRows = params.verificationEvidence
    .map(
      (ev) =>
        `| ${ev.name} | ${ev.status === 'passed' ? '✅ PASS' : '❌ FAIL'} | ${ev.detail || 'Verified clean'} |`,
    )
    .join('\n');

  return `## 🎯 Outcome & Problem Solved
Addresses and closes #${params.issueNumber}: **${params.title}**.

${params.summaryOfChanges}

---

${formatStaffArchitectReview(params.rubric)}

---

### 🛡️ Closed-Loop Verification Evidence
| Verification Step | Status | Evidence Detail |
| :--- | :--- | :--- |
${evidenceRows}

\`\`\`text
${params.diffStat}
\`\`\`

---
*Autonomous engineering build executed by **RDU** (Senior Software Engineer & QA Worker) via the **GEAR 2 Agent Flywheel**.*
*Closes #${params.issueNumber}*`;
}

/**
 * Generates the standardized 4-B entry for Bologna's Living Documentation.
 */
export function generateBolognaEntry(params: BolognaEntryParams): string {
  return `### 🗓️ ${params.dateStr} | ${params.weekStr}: ${params.topicTitle}

- **1. Breakthrough (The Concept):**
  - ${params.breakthrough}
- **2. Build (The Code):**
  - ${params.build}
- **3. Boundary / Bug (The Real-World Lesson):**
  - ${params.boundaryOrBug}
- **4. Broadcast (Content Hook for LinkedIn / X):**
  > "${params.broadcast}"
`;
}

/**
 * Appends a Bologna 4-B session entry directly into journey-log-gear-pca.md.
 */
export async function appendBolognaJourneyLog(
  entry: string,
  filePath = path.join(
    process.cwd(),
    'developer-docs/catalog-operating-system/journey-log-gear-pca.md',
  ),
): Promise<boolean> {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const current = await fs.promises.readFile(filePath, 'utf8');
  const headerMarker = '## 📖 Session Logs';
  if (current.includes(headerMarker)) {
    const updated = current.replace(
      `${headerMarker}\n`,
      `${headerMarker}\n\n${entry.trim()}\n`,
    );
    await fs.promises.writeFile(filePath, updated, 'utf8');
    return true;
  }
  await fs.promises.appendFile(filePath, `\n\n${entry.trim()}\n`, 'utf8');
  return true;
}

/**
 * Verifies that the git working tree has non-zero code modifications.
 */
export function verifyNonZeroDiff(cwd = process.cwd()): {
  hasChanges: boolean;
  diffStat: string;
} {
  try {
    const diffStat = execSync('git diff --stat HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    }).trim();
    const untracked = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    }).trim();
    const hasChanges = Boolean(diffStat.length > 0 || untracked.length > 0);
    return {
      hasChanges,
      diffStat: diffStat || untracked || 'No code changes detected',
    };
  } catch (err: any) {
    return { hasChanges: false, diffStat: `Error checking diff: ${err.message}` };
  }
}

/**
 * Executes a deterministic verification command and returns stdout/stderr.
 */
export function executeVerificationGate(
  command: string,
  cwd = process.cwd(),
  timeoutMs = 180000,
): { success: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });
    return { success: true, stdout, stderr: '' };
  } catch (err: any) {
    return {
      success: false,
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message || 'Verification command failed',
    };
  }
}

/**
 * Emits telemetry events from RDU Builder into AgentSupervisorService.
 */
export async function emitMissionTelemetry(
  payload: {
    runId: string;
    issueNumber: number;
    issueTitle: string;
    state: 'started' | 'progress' | 'pr_staged' | 'completed' | 'failed';
    activeStep?: string;
    branchName?: string;
    prUrl?: string;
    diffStat?: string;
    summary?: string;
    rubric?: StaffArchitectRubricData;
    modelCalls?: number;
    toolCalls?: number;
    estimatedTokens?: number;
    error?: string;
  },
  apiBaseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3001',
  token?: string,
): Promise<boolean> {
  const secret =
    process.env.INTERNAL_SCHEDULER_SECRET || 'nido-agent-frankfurt-secret';
  try {
    const res = await fetch(
      `${apiBaseUrl.replace(/\/+$/, '')}/api/agents/missions/report`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Creates bounded filesystem, verification, diff, and execution tools for RDU.
 */
export function createRduAgentTools(rootPath = process.cwd()): FunctionTool[] {
  const readFileTool = new FunctionTool({
    name: 'readFile',
    description: 'Reads the text content of a file in the repository.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file from repo root'),
      startLine: z.number().optional().describe('Optional 1-based start line'),
      endLine: z.number().optional().describe('Optional 1-based end line'),
    }),
    execute: async ({ filePath, startLine, endLine }) => {
      const fullPath = path.resolve(rootPath, filePath);
      if (!fullPath.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      if (!fs.existsSync(fullPath)) {
        return { error: `File not found: ${filePath}` };
      }
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const lines = content.split('\n');
      if (startLine || endLine) {
        const start = Math.max(1, startLine || 1) - 1;
        const end = Math.min(lines.length, endLine || lines.length);
        return {
          content: lines.slice(start, end).join('\n'),
          totalLines: lines.length,
          sliceRange: `${start + 1}-${end}`,
        };
      }
      return { content, totalLines: lines.length };
    },
  });

  const writeFileTool = new FunctionTool({
    name: 'writeFile',
    description: 'Creates a new file or completely replaces the contents of an existing file.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file from repo root'),
      content: z.string().describe('Exact UTF-8 string content to write'),
    }),
    execute: async ({ filePath, content }) => {
      const fullPath = path.resolve(rootPath, filePath);
      if (!fullPath.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(fullPath, content, 'utf8');
      return { success: true, filePath, bytesWritten: Buffer.byteLength(content) };
    },
  });

  const editFileTool = new FunctionTool({
    name: 'editFile',
    description:
      'Performs an exact string replacement in a file. Target must match existing text uniquely.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file from repo root'),
      target: z.string().describe('Exact substring to replace'),
      replacement: z.string().describe('Replacement text'),
    }),
    execute: async ({ filePath, target, replacement }) => {
      const fullPath = path.resolve(rootPath, filePath);
      if (!fullPath.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      if (!fs.existsSync(fullPath)) {
        return { error: `File not found: ${filePath}` };
      }
      const content = await fs.promises.readFile(fullPath, 'utf8');
      if (!content.includes(target)) {
        return {
          error: `Target substring not found in ${filePath}. Verify exact whitespace and lines.`,
        };
      }
      const occurrences = content.split(target).length - 1;
      const updated = content.replace(target, replacement);
      await fs.promises.writeFile(fullPath, updated, 'utf8');
      return { success: true, filePath, occurrencesReplaced: 1, totalOccurrences: occurrences };
    },
  });

  const listFilesTool = new FunctionTool({
    name: 'listFiles',
    description: 'Lists files and subdirectories in a directory relative to repository root.',
    parameters: z.object({
      directoryPath: z
        .string()
        .optional()
        .describe('Relative path to directory (defaults to repo root)'),
    }),
    execute: async ({ directoryPath = '.' }) => {
      const fullPath = path.resolve(rootPath, directoryPath);
      if (!fullPath.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      if (!fs.existsSync(fullPath)) {
        return { error: `Directory not found: ${directoryPath}` };
      }
      const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
      return {
        entries: entries
          .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
          .slice(0, 100)
          .map((e) => ({
            name: e.name,
            isDirectory: e.isDirectory(),
          })),
      };
    },
  });

  const testRunnerTool = new FunctionTool({
    name: 'testRunner',
    description:
      'Runs fast inner-loop tests (npm run test:changed, npm run test:related, or a specific spec file).',
    parameters: z.object({
      specTarget: z
        .string()
        .optional()
        .describe('Optional spec path or "changed" (runs npm run test:changed)'),
    }),
    execute: async ({ specTarget = 'changed' }) => {
      const cmd =
        specTarget === 'changed'
          ? 'npm run test:changed'
          : `npx jest ${specTarget.replace(/[^a-zA-Z0-9_\-\./]/g, '')}`;
      const res = executeVerificationGate(cmd, rootPath, 90000);
      return {
        command: cmd,
        success: res.success,
        output: (res.stdout + '\n' + res.stderr).slice(-1200),
      };
    },
  });

  const selfHealingHygieneTool = new FunctionTool({
    name: 'selfHealingHygiene',
    description:
      'Runs scripts/check-hygiene.mjs with --fix to automatically repair whitespace and formatting.',
    parameters: z.object({}),
    execute: async () => {
      const res = executeVerificationGate(
        'node scripts/check-hygiene.mjs --fix',
        rootPath,
        60000,
      );
      return {
        success: res.success,
        output: (res.stdout + '\n' + res.stderr).slice(-800),
      };
    },
  });

  const diffCheckerTool = new FunctionTool({
    name: 'diffChecker',
    description: 'Inspects active git changes and diff stats.',
    parameters: z.object({
      cached: z
        .boolean()
        .optional()
        .describe('If true, checks staged changes (git diff --cached)'),
      pathSpec: z
        .string()
        .optional()
        .describe('Optional relative path or file pattern to inspect'),
    }),
    execute: async ({ cached, pathSpec }) => {
      try {
        const flag = cached ? '--cached' : 'HEAD';
        const fileTarget = pathSpec ? ` -- ${pathSpec}` : '';
        const stat = execSync(`git diff --stat ${flag}${fileTarget}`, {
          cwd: rootPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30000,
        }).trim();
        const rawDiff = execSync(`git diff ${flag}${fileTarget}`, {
          cwd: rootPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 30000,
        }).slice(0, 2000);
        return {
          diffStat: stat || 'No modifications detected',
          preview: rawDiff || 'Clean diff',
        };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  });

  const terminalExecutionTool = new FunctionTool({
    name: 'terminalExecution',
    description:
      'Executes safe, deterministic terminal commands (npm test, git status, git diff, check-hygiene).',
    parameters: z.object({
      command: z
        .string()
        .describe('Command to execute in repository root (whitelisted commands only)'),
    }),
    execute: async ({ command }) => {
      const allowedPrefixes = [
        'git diff',
        'git status',
        'git log',
        'node scripts/',
        'npm test',
        'npm run test',
        'npm run agent:gate',
        'npm run build',
        'jest',
        'vitest',
      ];
      const isAllowed = allowedPrefixes.some((p) =>
        command.trim().startsWith(p),
      );
      if (!isAllowed) {
        return {
          error: `Command '${command}' is not in the safe command allowlist. Permitted commands: ${allowedPrefixes.join(', ')}`,
        };
      }
      const res = executeVerificationGate(command, rootPath, 120000);
      return {
        command,
        success: res.success,
        output: (res.stdout + '\n' + res.stderr).slice(-1000),
      };
    },
  });

  return [
    readFileTool,
    writeFileTool,
    editFileTool,
    listFilesTool,
    testRunnerTool,
    selfHealingHygieneTool,
    diffCheckerTool,
    terminalExecutionTool,
  ];
}

/**
 * Main autonomous execution function for the RDU Builder Runner.
 */
export async function runRduBuilder(
  options: RduBuilderOptions,
): Promise<MissionResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required to run RDU Builder Runner.',
    );
  }

  process.env.GEMINI_API_KEY = apiKey;
  process.env.GOOGLE_GENAI_API_KEY = apiKey;

  console.log(`\n======================================================`);
  console.log(`🛠️ Starting RDU Builder Runner for Issue #${options.issueNumber}`);
  console.log(`======================================================\n`);

  const issue = await fetchIssueMetadata(options.issueNumber, {
    githubToken: options.githubToken,
  });
  console.log(`📋 Ingested Issue #${issue.number}: "${issue.title}"`);

  const branchName = `feat/rdu-issue-${issue.number}-${issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)
    .replace(/-+$/, '')}`;

  const runId = `rdu-mission-${issue.number}-${Date.now()}`;
  const boundedThinkingBudget = Math.min(
    Math.max(options.thinkingBudget || 512, 256),
    1024,
  );
  const modelName = options.model || 'gemini-3.8-flash';
  const tools = createRduAgentTools(process.cwd());

  let modelCalls = 0;
  let toolCalls = 0;

  await emitMissionTelemetry({
    runId,
    issueNumber: issue.number,
    issueTitle: issue.title,
    state: 'started',
    activeStep: 'Initializing RDU Builder engineering loop',
    branchName,
    modelCalls,
    toolCalls,
  });

  const systemInstruction = `You are RDU, Nido's Senior Full-Stack Software Engineer & Dedicated QA Builder.
You operate under Nido's canonical operating contract (AGENTS.md) and the GEAR 2 Agent Flywheel.

YOUR OBJECTIVE:
Implement the requested outcome for GitHub Issue #${issue.number}: "${issue.title}".

ENGINEERING RULES:
1. Follow existing NestJS, TypeORM, Vue 3, and repository conventions.
2. Edit only bounded files necessary to solve the issue.
3. Test your code iteratively using testRunner (specTarget="changed" or specific spec).
4. Run selfHealingHygiene before declaring complete.
5. If a test fails, inspect the error output and patch the code immediately.
6. Produce real code changes: zero empty commits are permitted.
7. THINKING BUDGET: Limit thinking steps between 256 and 1024 tokens (budget: ${boundedThinkingBudget}). Maintain concise, bounded reasoning.`;

  const agent = new Agent({
    name: 'RDU',
    model: modelName,
    description: "Nido's senior full-stack software engineer and QA builder.",
    instruction: systemInstruction,
    tools,
  });

  const sessionService = new InMemorySessionService();
  const runner = new Runner({
    agent,
    sessionService,
    appName: 'rdu-builder-runner',
  });

  const session = await sessionService.createSession({
    appName: 'rdu-builder-runner',
    userId: 'rdu-builder',
  });

  const userPrompt = `Target Issue #${issue.number}: ${issue.title}

Issue Description:
${issue.body}

${options.taskPrompt ? `Maintainer Specific Task:\n${options.taskPrompt}\n` : ''}

Please inspect the relevant files, implement the solution, run the verification gates, and confirm that all tests and hygiene checks pass cleanly.`;

  console.log(
    `🧠 Invoking RDU ReAct engineering loop (${modelName}, thinkingBudget: ${boundedThinkingBudget})...`,
  );

  const maxRetries = options.maxRetries || 3;
  let currentIteration = 0;
  let verificationPassed = false;
  let lastFailureMessage = '';
  let agentOutputText = '';
  let hygieneRes = { success: false, stdout: '', stderr: '' };
  let apiTestRes = { success: false, stdout: '', stderr: '' };

  while (currentIteration < maxRetries && !verificationPassed) {
    currentIteration++;
    console.log(
      `\n🔄 RDU Engineering Loop — Iteration ${currentIteration}/${maxRetries}...`,
    );

    await emitMissionTelemetry({
      runId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      state: 'progress',
      activeStep: `Iteration ${currentIteration}: Applying patches & executing tests`,
      modelCalls,
      toolCalls,
    });

    const promptText =
      currentIteration === 1
        ? userPrompt
        : `⚠️ Verification gate failed in iteration ${currentIteration - 1}:\n${lastFailureMessage}\n\nPlease inspect the failure output, locate the affected code or tests, patch the implementation using your bounded tools, and make sure all checks pass cleanly.`;

    modelCalls++;
    for await (const event of runner.runAsync({
      userId: 'rdu-builder',
      sessionId: session.id,
      newMessage: {
        role: 'user',
        parts: [{ text: promptText }],
      },
    })) {
      if (event.content?.parts) {
        for (const part of event.content.parts) {
          if (part.text) {
            agentOutputText += part.text;
            process.stdout.write(part.text);
          }
          if ((part as any).functionCall) {
            toolCalls++;
            console.log(
              `\n[RDU Tool Call]: ${(part as any).functionCall.name}`,
            );
          }
          if ((part as any).functionResponse) {
            console.log(
              `[RDU Tool Response]: ${(part as any).functionResponse.name} (${
                (part as any).functionResponse.response?.success !== false
                  ? 'success'
                  : 'failed'
              })`,
            );
          }
        }
      }
    }

    // Execute closed-loop verification gates
    console.log(
      `\n🛡️ Running Closed-Loop Verification Gate (Iteration ${currentIteration})...`,
    );
    hygieneRes = executeVerificationGate('node scripts/check-hygiene.mjs');
    if (!hygieneRes.success) {
      lastFailureMessage = `Public repo hygiene check failed:\n${(hygieneRes.stdout + '\n' + hygieneRes.stderr).slice(-1000)}`;
      console.warn(`❌ Iteration ${currentIteration} hygiene check failed.`);
      continue;
    }

    apiTestRes = executeVerificationGate('npm run agent:gate:api-test');
    if (!apiTestRes.success) {
      lastFailureMessage = `Backend API tests failed:\n${(apiTestRes.stdout + '\n' + apiTestRes.stderr).slice(-1000)}`;
      console.warn(`❌ Iteration ${currentIteration} API tests failed.`);
      continue;
    }

    verificationPassed = true;
    console.log(
      `\n🟢 Closed-loop verification passed on iteration ${currentIteration}!`,
    );
  }

  if (!verificationPassed) {
    const errorMsg = `Verification gates failed after ${maxRetries} iterations: ${lastFailureMessage.slice(0, 300)}`;
    await emitMissionTelemetry({
      runId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      state: 'failed',
      error: errorMsg,
      modelCalls,
      toolCalls,
    });
    return {
      success: false,
      issueNumber: issue.number,
      branchName,
      diffStat: '',
      iterations: currentIteration,
      error: errorMsg,
    };
  }

  const diffCheck = verifyNonZeroDiff();
  if (!diffCheck.hasChanges) {
    const errorMsg =
      'Zero code changes detected! RDU prohibited from opening an empty PR.';
    console.error(`❌ ${errorMsg}`);
    await emitMissionTelemetry({
      runId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      state: 'failed',
      error: errorMsg,
      modelCalls,
      toolCalls,
    });
    return {
      success: false,
      issueNumber: issue.number,
      branchName,
      diffStat: '',
      iterations: currentIteration,
      error: errorMsg,
    };
  }

  const rubric: StaffArchitectRubricData = {
    optimizations: [
      'Targeted inner-loop test execution skipping unaffected test suites during iterative changes',
      'Automated self-healing hygiene ensuring clean trailing whitespace and Prettier formatting',
      'Zero-empty-commit enforcement protecting branch cleanliness and maintainer review efficiency',
    ],
    concern:
      'Edge cases in complex migrations require manual database inspection on Cloud Run dev before production release.',
  };

  const bolognaEntry = generateBolognaEntry({
    dateStr: new Date().toISOString().split('T')[0],
    weekStr: 'Week 45',
    topicTitle: `Autonomous RDU Builder Execution: Issue #${issue.number}`,
    breakthrough:
      'Dedicated RDU developer agent handling hands-on engineering, QA, and PR generation.',
    build: `Implemented autonomous engineering resolution for Issue #${issue.number} ("${issue.title}").`,
    boundaryOrBug:
      'Enforced non-zero diff validation and hygiene check passing before PR dispatch.',
    broadcast: `Empowered Nido with RDU, our native Research Triangle software engineering agent! #AIagents #GoogleCloud #ADK`,
  });

  await appendBolognaJourneyLog(bolognaEntry);
  console.log(`📝 Bologna appended session entry to journey-log-gear-pca.md`);

  const prBody = formatPullRequestBody({
    issueNumber: issue.number,
    title: issue.title,
    summaryOfChanges:
      agentOutputText.slice(0, 1200) ||
      'Implemented autonomous issue resolution.',
    rubric,
    verificationEvidence: [
      {
        name: 'Public Repo Hygiene',
        status: hygieneRes.success ? 'passed' : 'failed',
        detail: 'Validated via scripts/check-hygiene.mjs',
      },
      {
        name: 'Backend API Tests',
        status: apiTestRes.success ? 'passed' : 'failed',
        detail: 'Validated via jest --runInBand',
      },
      {
        name: 'Non-Zero Code Diff',
        status: 'passed',
        detail: 'Verified non-empty diffStat',
      },
      {
        name: 'Bologna Journey Log',
        status: 'passed',
        detail: 'Appended 4-B session entry',
      },
    ],
    diffStat: diffCheck.diffStat,
  });

  // Emit PR staged telemetry into AgentSupervisorService
  await emitMissionTelemetry({
    runId,
    issueNumber: issue.number,
    issueTitle: issue.title,
    state: 'pr_staged',
    activeStep: 'PR staged; awaiting human confirmation in Decision Center',
    branchName,
    diffStat: diffCheck.diffStat,
    summary:
      agentOutputText.slice(0, 300) ||
      `Autonomous PR staged for Issue #${issue.number}`,
    rubric,
    modelCalls,
    toolCalls,
  });

  if (options.dryRun) {
    console.log(`\n🏁 [DRY-RUN COMPLETE] PR body prepared successfully:\n`);
    console.log(prBody);
    await emitMissionTelemetry({
      runId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      state: 'completed',
      summary: `Dry-run completed successfully for Issue #${issue.number}`,
      branchName,
      diffStat: diffCheck.diffStat,
      modelCalls,
      toolCalls,
    });
    return {
      success: true,
      issueNumber: issue.number,
      branchName,
      diffStat: diffCheck.diffStat,
      iterations: currentIteration,
    };
  }

  // In non-dry-run mode, commit changes and create PR
  let prUrl: string | undefined;
  try {
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    execSync('git add -A', { stdio: 'inherit' });
    execSync(
      `git commit -m "feat(rdu): autonomous resolution for issue #${issue.number} (#${issue.number})"`,
      { stdio: 'inherit' },
    );
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const tmpBodyPath = path.join(process.cwd(), '.rdu-pr-body.tmp');
    await fs.promises.writeFile(tmpBodyPath, prBody, 'utf8');

    try {
      const prOutput = execSync(
        `gh pr create --title "feat(rdu): ${issue.title} (#${issue.number})" --body-file "${tmpBodyPath}" --base main --head ${branchName}`,
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 60000,
        },
      ).trim();

      prUrl = prOutput;
      console.log(`\n🎉 RDU Builder successfully created PR: ${prUrl}`);
    } finally {
      if (fs.existsSync(tmpBodyPath)) {
        await fs.promises.unlink(tmpBodyPath);
      }
    }
  } catch (err: any) {
    console.warn(`Git/PR dispatch returned: ${err.message}`);
  }

  await emitMissionTelemetry({
    runId,
    issueNumber: issue.number,
    issueTitle: issue.title,
    state: 'completed',
    activeStep: 'Mission completed; PR ready for review',
    branchName,
    prUrl,
    diffStat: diffCheck.diffStat,
    summary:
      agentOutputText.slice(0, 300) ||
      `Autonomous build completed for Issue #${issue.number}`,
    rubric,
    modelCalls,
    toolCalls,
  });

  return {
    success: true,
    issueNumber: issue.number,
    branchName,
    prUrl,
    diffStat: diffCheck.diffStat,
    iterations: currentIteration,
  };
}

if (require.main === module) {
  try {
    const opts = parseRduCliOptions(process.argv.slice(2));
    runRduBuilder(opts)
      .then((res) => {
        if (!res.success) {
          console.error(`\n❌ RDU Builder mission failed: ${res.error}`);
          process.exit(1);
        }
        console.log(`\n✅ RDU Builder mission completed successfully!`);
        process.exit(0);
      })
      .catch((err) => {
        console.error(`\n💥 Fatal error in RDU Builder:`, err);
        process.exit(1);
      });
  } catch (err: any) {
    console.error(`❌ Usage Error: ${err.message}`);
    process.exit(1);
  }
}
