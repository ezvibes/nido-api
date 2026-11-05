import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import AdminAgentSupervisorPage from './AdminAgentSupervisorPage.vue';

const mockGetIdToken = vi.fn().mockResolvedValue('mock-firebase-token');
const mockUser = ref<{ email: string; getIdToken?: any } | null>({
  email: 'admin@ezvibes.co',
  getIdToken: mockGetIdToken,
});
const mockFetchStatus = vi.fn();
const mockResolveAction = vi.fn();
const mockSteerAgent = vi.fn();

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    getIdToken: mockGetIdToken,
  }),
}));

vi.mock('../utils/admin', () => ({
  isAdminEmail: (email?: string | null) => email === 'admin@ezvibes.co',
}));

vi.mock('../composables/useApi', () => ({
  fetchAgentSupervisorStatus: (...args: any[]) => mockFetchStatus(...args),
  resolveAgentActionItem: (...args: any[]) => mockResolveAction(...args),
  steerAgentSession: (...args: any[]) => mockSteerAgent(...args),
}));

const sampleSnapshot = {
  summary: {
    environment: 'development',
    generatedAt: '2026-11-01T18:00:00.000Z',
    fixtureMode: true,
    freshness: {
      status: 'fresh',
      checkedAt: '2026-11-01T18:00:00.000Z',
      sources: {
        agentSessions: 'ok',
        ingestionPipeline: 'ok',
        memoryStore: 'ok',
      },
      warnings: [],
    },
    kpis: {
      activeRuns: 1,
      waitingForApproval: 2,
      attentionCount: 2,
      staleRuns: 0,
      completionRate24h: 100,
      completionRate7d: 95,
      totalRuns24h: 4,
      totalRuns7d: 12,
      medianDurationMs7d: 2400,
      p95DurationMs7d: 8200,
      oldestApprovalAgeMinutes: 14,
    },
    usage24h: {
      modelCalls: 5,
      toolCalls: 9,
      measuredTokens: 4200,
      measuredCostUsd: 0.0008,
      availabilityNote: 'Measured tokens only.',
    },
  },
  agents: [
    {
      key: 'frankfurt',
      name: 'Frankfurt',
      cityCode: 'FRA',
      role: 'Mission Coordinator',
      responsibility: 'Owns mission scope and acceptance synthesis.',
      readiness: 'operating_role',
      readinessLabel: 'Operating role',
      status: 'IDLE',
      model: 'gemini-3.6-flash',
      documentationPath: 'developer-docs/frankfurt.md',
      expectedMaxRuntimeSeconds: null,
      supportedWorkflows: ['Mission orchestration'],
      tools: ['verifyMissionAcceptance'],
      currentTask: null,
      lastVerifiedOutcome: {
        summary: 'Documented operating contract active',
        status: 'verified',
        timestamp: '2026-11-01T18:00:00.000Z',
      },
      nextAction: { label: 'Inspect missions', route: '/admin/agents?tab=missions' },
    },
    {
      key: 'firenze',
      name: 'Firenze',
      cityCode: 'FLR',
      role: 'Newsletter Curation Agent',
      responsibility: 'Curates Weekly Top Picks and stages Beehiiv drafts.',
      readiness: 'available_runtime',
      readinessLabel: 'Available runtime',
      status: 'WAITING_FOR_HUMAN',
      model: 'gemini-3.6-flash',
      documentationPath: '.agents/skills/firenze-newsletter/SKILL.md',
      expectedMaxRuntimeSeconds: 120,
      supportedWorkflows: ['Weekly Top Picks Curation'],
      tools: ['fetchApprovedConcerts', 'stageBeehiivDraft'],
      currentTask: {
        runId: 'run-firenze-1',
        workflow: 'Weekly Top Picks Curation',
        missionSummary: 'Curate Nov Week 1 Newsletter',
        activeStep: 'Paused at Beehiiv confirmation gate',
        startedAt: '2026-11-01T17:50:00.000Z',
        elapsedMs: 8400,
        modelCalls: 2,
        toolCalls: 4,
        estimatedTokens: 4120,
        delegatedFrom: 'Frankfurt',
      },
      lastVerifiedOutcome: null,
      nextAction: {
        label: 'Review 1 pending item(s)',
        route: '/admin/agents?tab=attention',
        actionItemCount: 1,
      },
    },
    {
      key: 'rdu',
      name: 'RDU',
      cityCode: 'RDU',
      role: 'Senior Software Engineer & QA Builder',
      responsibility: 'Implements code, executes QA test suites, repairs hygiene, and stages pull requests.',
      readiness: 'available_runtime',
      readinessLabel: 'Available runtime',
      status: 'IDLE',
      model: 'gemini-3.6-flash',
      documentationPath: '.agents/skills/rdu-builder/SKILL.md',
      expectedMaxRuntimeSeconds: 300,
      supportedWorkflows: ['Feature development & QA builder'],
      tools: ['readFile', 'writeFile', 'editFile', 'listFiles', 'testRunner', 'selfHealingHygiene', 'diffChecker', 'terminalExecution'],
      currentTask: null,
      lastVerifiedOutcome: null,
      nextAction: { label: 'Dispatch mission', route: '/admin/agents?tab=missions' },
    },
  ],
  actionItems: [
    {
      id: 'firenze-draft-1',
      type: 'firenze_newsletter_draft',
      agentKey: 'firenze',
      agentName: 'Firenze',
      status: 'pending',
      priority: 'high',
      title: 'Approve Weekly Top Picks Draft',
      summary: 'Firenze curated 6 concerts.',
      createdAt: '2026-11-01T17:50:00.000Z',
      ageMinutes: 14,
      runId: 'run-firenze-1',
      newsletterDraft: {
        title: 'Triangle Top Picks',
        dateRangeLabel: 'Nov 1-8',
        concertsCount: 6,
        htmlPreview: '<h2>Triangle Picks</h2>',
        targetSystem: 'beehiiv',
      },
      supportedActions: ['approve_beehiiv_draft', 'reject_with_feedback'],
    },
    {
      id: 'frankfurt-pr-fixture-176',
      type: 'frankfurt_mission_pr',
      agentKey: 'frankfurt',
      agentName: 'Frankfurt',
      status: 'pending',
      priority: 'high',
      title: 'Review Autonomous Overnight Build: Issue #176',
      summary: 'Frankfurt autonomously implemented issue #176.',
      createdAt: '2026-11-01T17:55:00.000Z',
      ageMinutes: 8,
      runId: 'fixture-run-frankfurt-176',
      missionPr: {
        issueNumber: 176,
        issueTitle: 'Transition autonomous overnight builds to Frankfurt',
        prUrl: 'https://github.com/ezvibes/nido-api/pull/177',
        branchName: 'feat/frankfurt-issue-176',
        diffStat: '8 files changed, 450 insertions(+)',
        summary: 'Transitioned overnight builds to Frankfurt.',
        rubric: {
          optimizations: ['Opt 1', 'Opt 2', 'Opt 3'],
          concern: 'Concern 1',
        },
      },
      supportedActions: ['approve_pr', 'reject_with_feedback'],
    },
  ],
  recentRuns: [
    {
      id: 'run-firenze-1',
      agentKey: 'firenze',
      agentName: 'Firenze',
      workflow: 'Weekly Top Picks Curation',
      missionKey: 'NIDO-002',
      title: 'Curate Nov Week 1 Newsletter',
      status: 'waiting_for_approval',
      isStale: false,
      initiator: 'admin',
      model: 'gemini-3.6-flash',
      startedAt: '2026-11-01T17:50:00.000Z',
      updatedAt: '2026-11-01T17:51:00.000Z',
      completedAt: null,
      durationMs: 8400,
      modelCalls: 2,
      toolCalls: 4,
      inputTokens: 3000,
      outputTokens: 1120,
      estimatedCostUsd: 0.0006,
      inputSummary: 'Nov 1-8',
      outputSummary: 'Waiting for Beehiiv confirmation',
      errorCategory: null,
      evidenceLinks: [],
      events: [
        {
          id: 'evt-1',
          sequence: 1,
          timestamp: '2026-11-01T17:50:00.000Z',
          agentKey: 'firenze',
          runId: 'run-firenze-1',
          type: 'tool_call',
          title: 'Tool Call: fetchApprovedConcerts',
          summary: 'Fetched 6 concerts',
          toolName: 'fetchApprovedConcerts',
          arguments: { topPicksOnly: true },
          latencyMs: 120,
          httpStatus: 200,
          status: 'ok',
        },
      ],
    },
    {
      id: 'fixture-run-rdu-001',
      agentKey: 'rdu',
      agentName: 'RDU',
      workflow: 'Autonomous Feature Engineering & QA Builder',
      missionKey: 'NIDO-004',
      title: 'Issue #181: Define and implement RDU dedicated developer agent',
      status: 'waiting_for_approval',
      isStale: false,
      initiator: 'agent:rdu',
      model: 'gemini-3.8-flash',
      startedAt: '2026-11-01T17:55:00.000Z',
      updatedAt: '2026-11-01T17:59:00.000Z',
      completedAt: null,
      durationMs: 38200,
      modelCalls: 4,
      toolCalls: 9,
      inputTokens: 4120,
      outputTokens: 1180,
      estimatedCostUsd: 0.0009,
      inputSummary: 'Issue #181',
      outputSummary: 'Staged PR #182 with 10 files changed',
      errorCategory: null,
      evidenceLinks: [],
      events: [
        {
          id: 'rdu-evt-1',
          sequence: 1,
          timestamp: '2026-11-01T17:55:00.000Z',
          agentKey: 'rdu',
          runId: 'fixture-run-rdu-001',
          type: 'tool_call',
          title: 'Tool Call: readFile',
          summary: 'Inspected src/apis/agents/agent-supervisor.service.ts',
          toolName: 'readFile',
          arguments: { filePath: 'src/apis/agents/agent-supervisor.service.ts' },
          status: 'ok',
        },
      ],
    },
  ],
  missions: [
    {
      missionKey: 'NIDO-001',
      title: 'Async Poster Ingestion & Human Publication Pipeline',
      coordinator: 'Frankfurt',
      integrationSpecialist: 'Innsbruck',
      status: 'completed',
      summary: 'End-to-end multimodal poster extraction.',
      completedSlices: 5,
      totalSlices: 5,
      blocker: null,
      nextStep: 'Start v2 extraction enhancements.',
      linkedIssues: [],
      linkedPrs: [],
      evidence: [
        {
          label: 'Direct VPC Egress verified',
          verified: true,
          detail: 'Cloud Run revision healthy.',
        },
      ],
    },
  ],
};

describe('AdminAgentSupervisorPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.value = { email: 'admin@ezvibes.co' };
    mockFetchStatus.mockResolvedValue(sampleSnapshot);
    mockResolveAction.mockResolvedValue({
      id: 'firenze-draft-1',
      status: 'resolved',
      action: 'approve_beehiiv_draft',
      result: { staged: true },
    });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders KPI signals, fleet roster cards, and honest readiness labels for admin users', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    expect(wrapper.get('[data-testid="kpi-active-runs"]').text()).toBe('1');
    expect(wrapper.get('[data-testid="kpi-waiting-approval"]').text()).toBe('2');
    expect(wrapper.get('[data-testid="kpi-completion-rate"]').text()).toBe('95%');

    const frankfurtCard = wrapper.get('[data-testid="agent-card-frankfurt"]');
    expect(frankfurtCard.text()).toContain('Operating role');
    expect(frankfurtCard.text()).toContain('IDLE');

    const firenzeCard = wrapper.get('[data-testid="agent-card-firenze"]');
    expect(firenzeCard.text()).toContain('Available runtime');
    expect(firenzeCard.text()).toContain('WAITING FOR HUMAN');
  });

  it('switches to Decision Center tab and resolves a Firenze newsletter draft approval gate', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="tab-attention"]').trigger('click');
    expect(wrapper.find('[data-testid="firenze-draft-gate"]').exists()).toBe(true);

    await wrapper
      .get('[data-testid="approve-draft-firenze-draft-1"]')
      .trigger('click');
    await flushPromises();

    expect(mockResolveAction).toHaveBeenCalledWith(
      'mock-firebase-token',
      'firenze-draft-1',
      expect.objectContaining({
        action: 'approve_beehiiv_draft',
      }),
    );
  });

  it('switches to Decision Center tab and resolves a Frankfurt mission PR approval gate', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="tab-attention"]').trigger('click');
    expect(wrapper.find('[data-testid="frankfurt-pr-gate"]').exists()).toBe(true);

    await wrapper
      .get('[data-testid="approve-pr-frankfurt-pr-fixture-176"]')
      .trigger('click');
    await flushPromises();

    expect(mockResolveAction).toHaveBeenCalledWith(
      'mock-firebase-token',
      'frankfurt-pr-fixture-176',
      expect.objectContaining({
        action: 'approve_pr',
      }),
    );
  });

  it('opens the Glass Box trace inspector drawer when clicking Inspect Trace & Tools', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="inspect-agent-firenze"]').trigger('click');
    const drawer = wrapper.get('[data-testid="inspector-drawer"]');
    expect(drawer.text()).toContain('Tool Call: fetchApprovedConcerts');
  });

  it('blocks non-admin users from loading supervisor data', async () => {
    mockUser.value = { email: 'fan@example.com' };
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('Admin Authorization Required');
    expect(mockFetchStatus).not.toHaveBeenCalled();
  });

  it('renders RDU Engineering & Build Station on the Overview tab in idle state and copies CLI command', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    const banner = wrapper.find('[data-testid="rdu-station-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('RDU Engineering & Build Station');
    expect(banner.text()).toContain('Dedicated Software Engineer & QA Builder');

    const idleBox = wrapper.find('[data-testid="rdu-idle-box"]');
    expect(idleBox.exists()).toBe(true);
    expect(idleBox.text()).toContain('npm run dev:rdu -- --issue');

    const copyBtn = idleBox.find('button');
    await copyBtn.trigger('click');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm run dev:rdu -- --issue ');
  });

  it('renders RDU Station with active task progress when RDU is running', async () => {
    const snapshotWithActiveTask = JSON.parse(JSON.stringify(sampleSnapshot));
    const rdu = snapshotWithActiveTask.agents.find((a: any) => a.key === 'rdu');
    rdu.status = 'BUSY';
    rdu.currentTask = {
      runId: 'rdu-run-101',
      workflow: 'Feature development & QA builder',
      missionSummary: 'Implement multi-modal poster sync in Vue',
      activeStep: 'Running shared test suites & hygiene check',
      startedAt: '2026-11-01T17:55:00.000Z',
      elapsedMs: 45000,
      modelCalls: 6,
      toolCalls: 14,
    };
    mockFetchStatus.mockResolvedValueOnce(snapshotWithActiveTask);

    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    const activeBox = wrapper.find('[data-testid="rdu-active-task-box"]');
    expect(activeBox.exists()).toBe(true);
    expect(activeBox.text()).toContain('Implement multi-modal poster sync in Vue');
    expect(activeBox.text()).toContain('Running shared test suites & hygiene check');
    expect(activeBox.text()).toContain('6 model calls');
    expect(activeBox.text()).toContain('14 tool calls');
  });

  it('renders RDU Station with staged PR details and copies PR link to clipboard', async () => {
    const snapshotWithStagedPr = JSON.parse(JSON.stringify(sampleSnapshot));
    snapshotWithStagedPr.actionItems.push({
      id: 'rdu-pr-181',
      type: 'frankfurt_mission_pr',
      agentKey: 'rdu',
      agentName: 'RDU',
      status: 'pending',
      priority: 'high',
      title: 'Review RDU Developer Agent Implementation: Issue #181',
      summary: 'RDU autonomously implemented and verified issue #181.',
      createdAt: '2026-11-01T18:00:00.000Z',
      ageMinutes: 2,
      runId: 'rdu-run-181',
      missionPr: {
        issueNumber: 181,
        issueTitle: 'Define and implement RDU builder agent',
        prUrl: 'https://github.com/ezvibes/nido-api/pull/182',
        branchName: 'feat/rdu-developer-agent',
        diffStat: '10 files changed, 950 insertions(+)',
        summary: 'RDU dedicated developer agent implementation.',
      },
      supportedActions: ['approve_pr', 'reject_with_feedback'],
    });
    mockFetchStatus.mockResolvedValueOnce(snapshotWithStagedPr);

    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    const stagedBox = wrapper.find('[data-testid="rdu-staged-pr-box"]');
    expect(stagedBox.exists()).toBe(true);
    expect(stagedBox.text()).toContain('Review RDU Developer Agent Implementation: Issue #181');
    expect(stagedBox.text()).toContain('10 files changed, 950 insertions(+)');

    const copyBtn = wrapper.find('[data-testid="rdu-copy-pr-btn"]');
    expect(copyBtn.exists()).toBe(true);
    await copyBtn.trigger('click');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://github.com/ezvibes/nido-api/pull/182',
    );
    expect(wrapper.text()).toContain('Pull Request URL copied to clipboard.');

    const openLink = wrapper.find('[data-testid="rdu-open-pr-link"]');
    expect(openLink.exists()).toBe(true);
    expect(openLink.attributes('href')).toBe('https://github.com/ezvibes/nido-api/pull/182');
  });

  it('copies PR link from the pending PR gate in the Decision Center tab', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="tab-attention"]').trigger('click');
    const copyPrBtn = wrapper.find('[data-testid="copy-pr-link-btn"]');
    expect(copyPrBtn.exists()).toBe(true);

    await copyPrBtn.trigger('click');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://github.com/ezvibes/nido-api/pull/177',
    );
  });

  it('opens the Glass Box trace inspector drawer when clicking Inspect Trace & Tools for RDU', async () => {
    const wrapper = mount(AdminAgentSupervisorPage, {
      global: {
        stubs: {
          'router-link': { template: '<a><slot /></a>' },
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="inspect-agent-rdu"]').trigger('click');
    const drawer = wrapper.get('[data-testid="inspector-drawer"]');
    expect(drawer.text()).toContain('Tool Call: readFile');
  });
});
