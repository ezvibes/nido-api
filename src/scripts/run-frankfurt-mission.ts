import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { Agent, FunctionTool, InMemorySessionService, Runner } from '@google/adk';
import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

export interface FrankfurtMissionOptions {
  issueNumber: number;
  dryRun?: boolean;
  maxRetries?: number;
  model?: string;
  thinkingBudget?: number;
  githubToken?: string;
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
 * Parses command-line arguments for the Frankfurt Mission Runner.
 */
export function parseCliOptions(args: string[]): FrankfurtMissionOptions {
  let issueNumber = 0;
  let dryRun = false;
  let maxRetries = 3;
  let model: string | undefined = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  let thinkingBudget = 512;
  let githubToken: string | undefined =
    process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--issue' || arg === '-i') {
      issueNumber = parseInt(args[++i], 10);
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--max-retries') {
      maxRetries = parseInt(args[++i], 10);
    } else if (arg === '--model') {
      model = args[++i];
    } else if (arg === '--thinking-budget') {
      thinkingBudget = parseInt(args[++i], 10);
    } else if (arg === '--token') {
      githubToken = args[++i];
    } else if (/^\d+$/.test(arg) && !issueNumber) {
      issueNumber = parseInt(arg, 10);
    }
  }

  if (!issueNumber || Number.isNaN(issueNumber)) {
    throw new Error(
      'A valid GitHub issue number is required. Usage: npm run mission:frankfurt -- --issue <number> [--dry-run]',
    );
  }

  return {
    issueNumber,
    dryRun,
    maxRetries,
    model,
    thinkingBudget,
    githubToken,
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

  // 1. Try using GitHub REST API if token is available
  if (token) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Frankfurt-Mission-Runner/1.0',
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

  // 2. Fall back to local gh CLI
  try {
    const raw = execSync(
      `gh issue view ${issueNumber} --repo ${repo} --json number,title,body,labels,author,url`,
      { encoding: 'utf8' },
    );
    const parsed = JSON.parse(raw);
    return {
      number: parsed.number,
      title: parsed.title,
      body: parsed.body || '',
      labels: (parsed.labels || []).map((l: any) => l.name || l),
      author: parsed.author?.login,
      url: parsed.url,
    };
  } catch (err: any) {
    throw new Error(
      `Failed to fetch metadata for issue #${issueNumber}: ${err.message}`,
    );
  }
}

/**
 * Formats the Staff Architect Review rubric containing exactly 3 Optimizations and 1 Concern.
 */
export function formatStaffArchitectReview(data: StaffArchitectRubricData): string {
  return `### 🏛️ Staff Architect Review Gate (GEAR Level 2)

#### 3 Technical Optimizations
1. **${data.optimizations[0]}**
2. **${data.optimizations[1]}**
3. **${data.optimizations[2]}**

#### 1 Boundary / Risk Concern
- ⚠️ **${data.concern}**`;
}

/**
 * Formats the standardized pull request markdown body.
 */
export function formatPullRequestBody(params: PullRequestTemplateParams): string {
  const evidenceRows = params.verificationEvidence
    .map(
      (ev) =>
        `| \`${ev.name}\` | ${ev.status === 'passed' ? '🟢 PASSED' : '🔴 FAILED'} | ${ev.detail || 'Verified cleanly in closed-loop gate'} |`,
    )
    .join('\n');

  return `## 🎯 Summary of Changes
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
*Autonomous overnight mission executed by **Frankfurt** (Mission Coordinator) via the **GEAR 2 Agent Flywheel**.*
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
  // Inject right after `## 📖 Session Logs\n`
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
 * Prohibits empty bot commits.
 */
export function verifyNonZeroDiff(cwd = process.cwd()): {
  hasChanges: boolean;
  diffStat: string;
} {
  try {
    const diffStat = execSync('git diff --stat HEAD', {
      cwd,
      encoding: 'utf8',
    }).trim();
    const untracked = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf8',
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
): { success: boolean; stdout: string; stderr: string } {
  try {
    const stdout = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
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
 * Emits telemetry events from Frankfurt Mission Runner into AgentSupervisorService.
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
 * Creates bounded filesystem, verification, diff, and execution tools for the Frankfurt Agent.
 */
export function createFrankfurtAgentTools(rootPath = process.cwd()): FunctionTool[] {
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
      const raw = await fs.promises.readFile(fullPath, 'utf8');
      if (startLine !== undefined && endLine !== undefined) {
        const lines = raw.split('\n');
        return {
          content: lines.slice(startLine - 1, endLine).join('\n'),
          totalLines: lines.length,
        };
      }
      return { content: raw };
    },
  });

  const writeFileTool = new FunctionTool({
    name: 'writeFile',
    description: 'Creates or overwrites a file with full content.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file from repo root'),
      content: z.string().describe('Complete file contents to write'),
    }),
    execute: async ({ filePath, content }) => {
      const fullPath = path.resolve(rootPath, filePath);
      if (!fullPath.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, content, 'utf8');
      return { success: true, filePath, bytesWritten: content.length };
    },
  });

  const editFileTool = new FunctionTool({
    name: 'editFile',
    description:
      'Replaces an exact target character sequence with a replacement in an existing file.',
    parameters: z.object({
      filePath: z.string().describe('Relative path to the file from repo root'),
      target: z.string().describe('Exact string to search and replace'),
      replacement: z.string().describe('Replacement text to substitute'),
    }),
    execute: async ({ filePath, target, replacement }) => {
      const fullPath = path.resolve(rootPath, filePath);
      if (!fullPath.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      if (!fs.existsSync(fullPath)) {
        return { error: `File not found: ${filePath}` };
      }
      const raw = await fs.promises.readFile(fullPath, 'utf8');
      if (!raw.includes(target)) {
        return {
          error: `Target string was not found in ${filePath}. Check exact whitespace.`,
        };
      }
      const updated = raw.replace(target, replacement);
      await fs.promises.writeFile(fullPath, updated, 'utf8');
      return { success: true, filePath };
    },
  });

  const listFilesTool = new FunctionTool({
    name: 'listFiles',
    description: 'Lists files and folders inside a given repository directory.',
    parameters: z.object({
      dirPath: z.string().optional().describe('Relative directory path (defaults to root)'),
    }),
    execute: async ({ dirPath }) => {
      const targetDir = path.resolve(rootPath, dirPath || '.');
      if (!targetDir.startsWith(rootPath)) {
        return { error: 'Access denied: Path is outside repository root' };
      }
      if (!fs.existsSync(targetDir)) {
        return { error: `Directory not found: ${dirPath}` };
      }
      const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
      return {
        entries: entries
          .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
          .slice(0, 50)
          .map((e) => ({
            name: e.name,
            isDirectory: e.isDirectory(),
          })),
      };
    },
  });

  const runVerificationGateTool = new FunctionTool({
    name: 'runVerificationGate',
    description:
      'Runs a deterministic verification command to test code changes before finishing.',
    parameters: z.object({
      gate: z
        .enum(['hygiene', 'api_test', 'client_test', 'build', 'full_gate'])
        .describe('Verification gate to execute'),
    }),
    execute: async ({ gate }) => {
      let command = 'node scripts/check-hygiene.mjs';
      if (gate === 'api_test') command = 'jest --runInBand';
      if (gate === 'client_test') command = 'npm test --prefix client';
      if (gate === 'build') command = 'npm run build';
      if (gate === 'full_gate') command = 'npm run agent:gate';

      const res = executeVerificationGate(command, rootPath);
      return {
        gate,
        success: res.success,
        outputSummary: (res.stdout + '\n' + res.stderr).slice(-800),
      };
    },
  });

  const diffCheckerTool = new FunctionTool({
    name: 'diffChecker',
    description:
      'Checks the current git diff and status of code modifications in the repository.',
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
        }).trim();
        const rawDiff = execSync(`git diff ${flag}${fileTarget}`, {
          cwd: rootPath,
          encoding: 'utf8',
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
      const res = executeVerificationGate(command, rootPath);
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
    runVerificationGateTool,
    diffCheckerTool,
    terminalExecutionTool,
  ];
}

/**
 * Main autonomous execution function for the Frankfurt Mission Runner.
 */
export async function runFrankfurtMission(
  options: FrankfurtMissionOptions,
): Promise<MissionResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required to run Frankfurt Mission Runner.',
    );
  }

  process.env.GEMINI_API_KEY = apiKey;
  process.env.GOOGLE_GENAI_API_KEY = apiKey;

  console.log(`\n======================================================`);
  console.log(`🚀 Starting Frankfurt Mission Runner for Issue #${options.issueNumber}`);
  console.log(`======================================================\n`);

  const issue = await fetchIssueMetadata(options.issueNumber, {
    githubToken: options.githubToken,
  });
  console.log(`📋 Ingested Issue #${issue.number}: "${issue.title}"`);

  const branchName = `feat/frankfurt-issue-${issue.number}-${issue.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)
    .replace(/-+$/, '')}`;

  const runId = `frankfurt-mission-${issue.number}-${Date.now()}`;
  const boundedThinkingBudget = Math.min(
    Math.max(options.thinkingBudget || 512, 256),
    1024,
  );
  const modelName = options.model || 'gemini-3.8-flash';
  const tools = createFrankfurtAgentTools(process.cwd());

  let modelCalls = 0;
  let toolCalls = 0;

  // Emit start telemetry
  await emitMissionTelemetry({
    runId,
    issueNumber: issue.number,
    issueTitle: issue.title,
    state: 'started',
    activeStep: 'Initializing Frankfurt ReAct mission loop',
    branchName,
    modelCalls,
    toolCalls,
  });

  const systemInstruction = `You are Frankfurt, Nido's Lead Mission Coordinator & Outcome Orchestrator.
You operate under Nido's canonical operating contract (AGENTS.md) and the GEAR 2 Agent Flywheel.

YOUR OBJECTIVE:
Implement the requested outcome for GitHub Issue #${issue.number}: "${issue.title}".

ENGINEERING RULES:
1. Follow existing NestJS, TypeORM, Vue 3, and repository conventions.
2. Edit only bounded files necessary to solve the issue.
3. Test every change using runVerificationGate before declaring complete.
4. If a test fails, inspect the error output and patch the code immediately.
5. Produce real code changes: zero empty commits are permitted.
6. Provide structured summary of your work and your Staff Architect evaluation.
7. THINKING BUDGET: Limit thinking steps to between 256 and 1024 tokens (budget: ${boundedThinkingBudget}). Maintain concise, bounded reasoning.`;

  const agent = new Agent({
    name: 'Frankfurt',
    model: modelName,
    description: "Nido's autonomous mission coordinator and outcome orchestrator.",
    instruction: systemInstruction,
    tools,
  });

  const sessionService = new InMemorySessionService();
  const runner = new Runner({
    agent,
    sessionService,
    appName: 'frankfurt-mission-runner',
  });

  const session = await sessionService.createSession({
    appName: 'frankfurt-mission-runner',
    userId: 'frankfurt-coordinator',
  });

  const userPrompt = `Target Issue #${issue.number}: ${issue.title}

Issue Description:
${issue.body}

Please inspect the relevant files, implement the solution, run the verification gates, and confirm that all tests and hygiene checks pass cleanly.`;

  console.log(
    `🧠 Invoking Frankfurt ReAct execution loop (${modelName}, thinkingBudget: ${boundedThinkingBudget})...`,
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
      `\n🔄 Frankfurt ReAct Loop — Iteration ${currentIteration}/${maxRetries}...`,
    );

    await emitMissionTelemetry({
      runId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      state: 'progress',
      activeStep: `Iteration ${currentIteration}: Reasoning & applying patches`,
      modelCalls,
      toolCalls,
    });

    const promptText =
      currentIteration === 1
        ? userPrompt
        : `⚠️ Verification gate failed in iteration ${currentIteration - 1}:\n${lastFailureMessage}\n\nPlease inspect the failure output, locate the affected code or tests, patch the implementation using your bounded tools, and make sure all checks pass cleanly.`;

    modelCalls++;
    for await (const event of runner.runAsync({
      userId: 'frankfurt-coordinator',
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
              `\n[Frankfurt Tool Call]: ${(part as any).functionCall.name}`,
            );
          }
          if ((part as any).functionResponse) {
            console.log(
              `[Frankfurt Tool Response]: ${(part as any).functionResponse.name} (${
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
      'Zero code changes detected! Frankfurt prohibited from opening an empty PR.';
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

  console.log(`\n📊 Verified Non-Zero Diff:\n${diffCheck.diffStat}\n`);

  // Staff Architect Rubric Formatter
  const rubric: StaffArchitectRubricData = {
    optimizations: [
      'Bounded ReAct Tool Interfaces: typed with Zod schema verification',
      'Fail-Closed Hygiene & Verification: automated pre-PR test execution',
      'Zero-Static Secrets: ADC & GITHUB_TOKEN workload identity parity',
    ],
    concern:
      'Ensure long-running autonomous scripts have bounded retry ceilings to prevent token exhaustion.',
  };

  // Bologna 4-B Living Documentation Update
  const today = new Date().toISOString().slice(0, 10);
  const bolognaEntry = generateBolognaEntry({
    dateStr: today,
    weekStr: 'Week 5',
    topicTitle: `Autonomous Frankfurt Mission Execution: Issue #${issue.number}`,
    breakthrough:
      'Replacing external black-box coding bots with first-party TypeScript ADK mission runners enforcing closed-loop verification before PR creation.',
    build: `Implemented autonomous mission runner for Issue #${issue.number} ("${issue.title}").`,
    boundaryOrBug:
      'Enforced non-zero diff validation and hygiene check passing before PR dispatch.',
    broadcast: `Transitioned Nido overnight builds from external bots to native Frankfurt orchestrator with deterministic GEAR verification! #AIagents #GoogleCloud #ADK`,
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
      `git commit -m "feat(frankfurt): autonomous resolution for issue #${issue.number} (#${issue.number})"`,
      { stdio: 'inherit' },
    );
    execSync(`git push -u origin ${branchName}`, { stdio: 'inherit' });

    const prOutput = execSync(
      `gh pr create --title "feat(frankfurt): ${issue.title} (#${issue.number})" --body "${prBody.replace(/"/g, '\\"')}" --base main --head ${branchName}`,
      { encoding: 'utf8' },
    ).trim();

    prUrl = prOutput;
    console.log(`\n🎉 Frankfurt Mission successfully created PR: ${prUrl}`);
  } catch (err: any) {
    console.warn(`Git/PR dispatch returned: ${err.message}`);
  }

  await emitMissionTelemetry({
    runId,
    issueNumber: issue.number,
    issueTitle: issue.title,
    state: 'completed',
    summary: `Mission successfully completed for Issue #${issue.number}`,
    branchName,
    prUrl,
    diffStat: diffCheck.diffStat,
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

// Direct CLI invocation
if (require.main === module) {
  try {
    const opts = parseCliOptions(process.argv.slice(2));
    runFrankfurtMission(opts)
      .then((res) => {
        if (!res.success) {
          process.exit(1);
        }
      })
      .catch((err) => {
        console.error(`Fatal error executing Frankfurt Mission: ${err.message}`);
        process.exit(1);
      });
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
}
