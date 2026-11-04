<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAuth } from '../composables/useAuth';
import {
  fetchAgentSupervisorStatus,
  resolveAgentActionItem,
  steerAgentSession,
  type AgentActionItem,
  type AgentDirectoryEntry,
  type AgentMissionSummary,
  type AgentRunRecord,
  type AgentSupervisorStatusResponse,
  type ResolveAgentActionItemPayload,
} from '../composables/useApi';
import { isAdminEmail } from '../utils/admin';

type DashboardTab = 'overview' | 'activity' | 'attention' | 'missions';

const { user, getIdToken } = useAuth();
const isAdmin = computed(() => isAdminEmail(user.value?.email ?? null));

const activeTab = ref<DashboardTab>('overview');
const loading = ref(false);
const errorMessage = ref('');
const actionFeedbackBanner = ref('');
const fixtureMode = ref(false);

const snapshot = ref<AgentSupervisorStatusResponse | null>(null);

// Filters for Activity tab
const filterAgentKey = ref('all');
const filterRunStatus = ref('all');

// Drawer state for Glass Box Run & Tool Inspector
const selectedRun = ref<AgentRunRecord | null>(null);
const selectedAgentForDrawer = ref<AgentDirectoryEntry | null>(null);
const showTechnicalIds = ref(false);
const steeringInput = ref('');
const steeringSubmitting = ref(false);

// Action Item resolution state
const resolvingItemId = ref<string | null>(null);
const rejectFeedbackMap = ref<Record<string, string>>({});

let pollTimer: ReturnType<typeof setInterval> | null = null;

const agents = computed<AgentDirectoryEntry[]>(
  () => snapshot.value?.agents ?? [],
);
const actionItems = computed<AgentActionItem[]>(
  () => snapshot.value?.actionItems ?? [],
);
const pendingActionItems = computed<AgentActionItem[]>(() =>
  actionItems.value.filter((item) => item.status === 'pending'),
);
const recentRuns = computed<AgentRunRecord[]>(
  () => snapshot.value?.recentRuns ?? [],
);
const missions = computed<AgentMissionSummary[]>(
  () => snapshot.value?.missions ?? [],
);

const filteredRuns = computed<AgentRunRecord[]>(() => {
  return recentRuns.value.filter((run) => {
    if (
      filterAgentKey.value !== 'all' &&
      run.agentKey !== filterAgentKey.value
    ) {
      return false;
    }
    if (
      filterRunStatus.value !== 'all' &&
      run.status !== filterRunStatus.value
    ) {
      return false;
    }
    return true;
  });
});

async function loadSupervisorSnapshot(options?: { silent?: boolean }) {
  if (!isAdmin.value) {
    return;
  }
  if (!options?.silent) {
    loading.value = true;
  }
  errorMessage.value = '';

  try {
    const token = await getIdToken();
    if (!token) {
      errorMessage.value = 'Authentication token unavailable. Please sign in.';
      return;
    }

    const data = await fetchAgentSupervisorStatus(token, {
      fixture: fixtureMode.value ? true : undefined,
    });
    snapshot.value = data;

    // Keep selected run drawer synced if open
    if (selectedRun.value) {
      const updated = data.recentRuns.find(
        (r) => r.id === selectedRun.value?.id,
      );
      if (updated) {
        selectedRun.value = updated;
      }
    }
  } catch (err: any) {
    errorMessage.value =
      err?.response?.data?.message ||
      err?.message ||
      'Unable to load Agent Control Center telemetry.';
  } finally {
    if (!options?.silent) {
      loading.value = false;
    }
  }
}

async function toggleFixtureMode() {
  fixtureMode.value = !fixtureMode.value;
  selectedRun.value = null;
  selectedAgentForDrawer.value = null;
  await loadSupervisorSnapshot();
}

function openAgentInspector(agent: AgentDirectoryEntry) {
  selectedAgentForDrawer.value = agent;
  const matchingRun =
    recentRuns.value.find((r) => r.id === agent.currentTask?.runId) ||
    recentRuns.value.find((r) => r.agentKey === agent.key) ||
    null;
  selectedRun.value = matchingRun;
}

function openRunInspector(run: AgentRunRecord) {
  selectedRun.value = run;
  selectedAgentForDrawer.value =
    agents.value.find((a) => a.key === run.agentKey) || null;
}

function closeInspector() {
  selectedRun.value = null;
  selectedAgentForDrawer.value = null;
  steeringInput.value = '';
}

async function handleResolveAction(
  item: AgentActionItem,
  action: ResolveAgentActionItemPayload['action'],
) {
  resolvingItemId.value = item.id;
  errorMessage.value = '';
  actionFeedbackBanner.value = '';

  try {
    const token = await getIdToken();
    if (!token) {
      throw new Error('Authentication token required.');
    }

    const feedbackText = rejectFeedbackMap.value[item.id]?.trim() || undefined;
    const targetConcertId = item.probableDuplicates?.[0]?.id;

    const result = await resolveAgentActionItem(token, item.id, {
      action,
      targetConcertId,
      feedback: feedbackText,
      reviewDurationMs: 2200,
      publishData: item.extractedData
        ? {
            title: item.extractedData.title,
            date: item.extractedData.date,
            time: item.extractedData.time,
            venueId: item.extractedData.venueId || undefined,
            venueName: item.extractedData.venueName,
            bandNames: item.extractedData.bandNames,
            genre: item.extractedData.genre,
            notes: feedbackText,
          }
        : undefined,
    });

    actionFeedbackBanner.value = `Resolved "${item.title}" with action "${result.action}".`;
    await loadSupervisorSnapshot({ silent: true });
  } catch (err: any) {
    errorMessage.value =
      err?.response?.data?.message ||
      err?.message ||
      `Failed to resolve action item (${action}).`;
  } finally {
    resolvingItemId.value = null;
  }
}

async function handleSendSteering() {
  const targetAgentKey =
    selectedAgentForDrawer.value?.key || selectedRun.value?.agentKey;
  if (!targetAgentKey || !steeringInput.value.trim()) {
    return;
  }

  steeringSubmitting.value = true;
  errorMessage.value = '';
  try {
    const token = await getIdToken();
    if (!token) {
      throw new Error('Authentication token required.');
    }
    const res = await steerAgentSession(token, targetAgentKey, {
      instruction: steeringInput.value.trim(),
      runId: selectedRun.value?.id,
    });
    actionFeedbackBanner.value = `Steering note recorded for ${targetAgentKey}: "${res.sanitizedInstruction}"`;
    steeringInput.value = '';
    await loadSupervisorSnapshot({ silent: true });
  } catch (err: any) {
    errorMessage.value =
      err?.response?.data?.message ||
      err?.message ||
      'Failed to send steering instruction.';
  } finally {
    steeringSubmitting.value = false;
  }
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'RUNNING':
    case 'running':
      return 'badge--running';
    case 'WAITING_FOR_HUMAN':
    case 'waiting_for_approval':
      return 'badge--waiting';
    case 'ERROR':
    case 'failed':
      return 'badge--error';
    case 'succeeded':
    case 'verified':
      return 'badge--succeeded';
    default:
      return 'badge--idle';
  }
}

function statusDotLabel(status: string): string {
  switch (status) {
    case 'RUNNING':
      return 'RUNNING';
    case 'WAITING_FOR_HUMAN':
      return 'WAITING FOR HUMAN';
    case 'ERROR':
      return 'ERROR';
    default:
      return 'IDLE';
  }
}

function readinessBadgeClass(readiness: string): string {
  switch (readiness) {
    case 'available_runtime':
      return 'readiness--runtime';
    case 'partially_implemented':
      return 'readiness--partial';
    case 'operating_role':
      return 'readiness--role';
    default:
      return 'readiness--proposed';
  }
}

onMounted(async () => {
  await loadSupervisorSnapshot();
  pollTimer = setInterval(() => {
    void loadSupervisorSnapshot({ silent: true });
  }, 15000);
});

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});
</script>

<template>
  <section class="supervisor-page" aria-labelledby="supervisor-heading">
    <!-- Unauthorized Guard -->
    <div v-if="!isAdmin" class="supervisor-card supervisor-card--unauthorized" role="alert">
      <h2>Admin Authorization Required</h2>
      <p>
        The Nido Agent Control Center is restricted to authorized platform
        administrators.
      </p>
      <router-link to="/concerts" class="btn btn--secondary">
        Return to Concerts
      </router-link>
    </div>

    <template v-else>
      <!-- Top Executive Header -->
      <header class="supervisor-header">
        <div>
          <div class="supervisor-eyebrow">
            <span class="env-pill">
              ENV: {{ snapshot?.summary.environment || 'dev' }}
            </span>
            <span
              v-if="snapshot?.summary.freshness"
              class="freshness-pill"
              :class="`freshness-pill--${snapshot.summary.freshness.status}`"
            >
              Freshness: {{ snapshot.summary.freshness.status }} ·
              {{ formatTimestamp(snapshot.summary.generatedAt) }}
            </span>
            <span v-if="fixtureMode" class="fixture-pill">
              Sanitized Demo Fixture Mode
            </span>
          </div>
          <h1 id="supervisor-heading" class="supervisor-title">
            Agent Control Center &amp; Action Hub
          </h1>
          <p class="supervisor-subtitle">
            Monitor Nido’s TypeScript / <code>@google/adk</code> city-agent
            network, inspect structured tool executions, and resolve
            human-in-the-loop publication gates.
          </p>
        </div>

        <div class="supervisor-header__actions">
          <button
            type="button"
            class="btn btn--ghost"
            :aria-pressed="fixtureMode"
            data-testid="toggle-fixture-btn"
            @click="toggleFixtureMode"
          >
            {{ fixtureMode ? 'Exit Demo Fixtures' : 'Load Demo Walkthrough' }}
          </button>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="loading"
            data-testid="refresh-supervisor-btn"
            @click="loadSupervisorSnapshot()"
          >
            {{ loading ? 'Refreshing…' : 'Refresh Status' }}
          </button>
        </div>
      </header>

      <!-- Partial Data / Fixture Warnings -->
      <div
        v-if="snapshot?.summary.freshness.warnings?.length"
        class="banner banner--info"
        role="status"
      >
        <p
          v-for="(warning, idx) in snapshot.summary.freshness.warnings"
          :key="idx"
        >
          {{ warning }}
        </p>
      </div>

      <!-- Feedback & Error Banners -->
      <div
        v-if="actionFeedbackBanner"
        class="banner banner--success"
        role="status"
        data-testid="action-feedback-banner"
      >
        <span>{{ actionFeedbackBanner }}</span>
        <button
          type="button"
          class="banner__dismiss"
          @click="actionFeedbackBanner = ''"
        >
          Dismiss
        </button>
      </div>

      <div
        v-if="errorMessage"
        class="banner banner--error"
        role="alert"
        data-testid="supervisor-error-banner"
      >
        <span>{{ errorMessage }}</span>
      </div>

      <!-- First Viewport: 4 Concise Operational Signals -->
      <div
        v-if="snapshot"
        class="kpi-grid"
        aria-label="Operational summary metrics"
      >
        <article class="kpi-card">
          <span class="kpi-card__label">Active Runs (Now)</span>
          <strong class="kpi-card__value" data-testid="kpi-active-runs">
            {{ snapshot.summary.kpis.activeRuns }}
          </strong>
          <span class="kpi-card__meta">
            {{ snapshot.summary.kpis.totalRuns24h }} total runs (24h window)
          </span>
        </article>

        <article
          class="kpi-card"
          :class="{
            'kpi-card--highlight':
              snapshot.summary.kpis.waitingForApproval > 0,
          }"
        >
          <span class="kpi-card__label">Waiting for Human Approval</span>
          <strong class="kpi-card__value" data-testid="kpi-waiting-approval">
            {{ snapshot.summary.kpis.waitingForApproval }}
          </strong>
          <span class="kpi-card__meta">
            <template
              v-if="snapshot.summary.kpis.oldestApprovalAgeMinutes !== null"
            >
              Oldest gate:
              {{ snapshot.summary.kpis.oldestApprovalAgeMinutes }}m ago
            </template>
            <template v-else>Queue clear</template>
          </span>
        </article>

        <article class="kpi-card">
          <span class="kpi-card__label">7-Day Completion Rate</span>
          <strong class="kpi-card__value" data-testid="kpi-completion-rate">
            {{ snapshot.summary.kpis.completionRate7d }}%
          </strong>
          <span class="kpi-card__meta">
            Median {{ formatDuration(snapshot.summary.kpis.medianDurationMs7d) }} ·
            p95 {{ formatDuration(snapshot.summary.kpis.p95DurationMs7d) }} (7d)
          </span>
        </article>

        <article class="kpi-card">
          <span class="kpi-card__label">Attention Required</span>
          <strong class="kpi-card__value" data-testid="kpi-attention-count">
            {{ snapshot.summary.kpis.attentionCount }}
          </strong>
          <span class="kpi-card__meta">
            {{ snapshot.summary.usage24h.modelCalls }} model calls ·
            {{ snapshot.summary.usage24h.toolCalls }} tool calls (24h)
          </span>
        </article>
      </div>

      <!-- Segmented View Navigation Tabs -->
      <nav class="supervisor-tabs" aria-label="Agent Control Center sections">
        <button
          type="button"
          class="supervisor-tab"
          :class="{ 'supervisor-tab--active': activeTab === 'overview' }"
          data-testid="tab-overview"
          @click="activeTab = 'overview'"
        >
          Fleet Overview ({{ agents.length }})
        </button>
        <button
          type="button"
          class="supervisor-tab"
          :class="{ 'supervisor-tab--active': activeTab === 'attention' }"
          data-testid="tab-attention"
          @click="activeTab = 'attention'"
        >
          Decision Center
          <span
            v-if="pendingActionItems.length > 0"
            class="tab-badge"
            data-testid="attention-badge-count"
          >
            {{ pendingActionItems.length }}
          </span>
        </button>
        <button
          type="button"
          class="supervisor-tab"
          :class="{ 'supervisor-tab--active': activeTab === 'activity' }"
          data-testid="tab-activity"
          @click="activeTab = 'activity'"
        >
          Activity &amp; Runs ({{ recentRuns.length }})
        </button>
        <button
          type="button"
          class="supervisor-tab"
          :class="{ 'supervisor-tab--active': activeTab === 'missions' }"
          data-testid="tab-missions"
          @click="activeTab = 'missions'"
        >
          Missions ({{ missions.length }})
        </button>
      </nav>

      <!-- TAB 1: FLEET OVERVIEW ("Air Traffic Control") -->
      <section
        v-if="activeTab === 'overview'"
        aria-labelledby="fleet-roster-heading"
        class="supervisor-section"
      >
        <div class="section-header">
          <div>
            <h2 id="fleet-roster-heading">
              City-Agent Fleet &amp; Readiness Roster
            </h2>
            <p class="section-subtitle">
              Distinguishes deployed <code>@google/adk</code> and Cloud Tasks
              runtimes from documented operating roles.
            </p>
          </div>
          <label class="toggle-control">
            <input v-model="showTechnicalIds" type="checkbox" />
            <span>Show technical identifiers</span>
          </label>
        </div>

        <div class="agent-grid" data-testid="agent-roster-grid">
          <article
            v-for="agent in agents"
            :key="agent.key"
            class="agent-card"
            :data-testid="`agent-card-${agent.key}`"
          >
            <header class="agent-card__header">
              <div>
                <div class="agent-card__badges">
                  <span class="city-pill">{{ agent.cityCode }}</span>
                  <span
                    class="readiness-pill"
                    :class="readinessBadgeClass(agent.readiness)"
                  >
                    {{ agent.readinessLabel }}
                  </span>
                </div>
                <h3 class="agent-card__title">{{ agent.name }}</h3>
                <p class="agent-card__role">{{ agent.role }}</p>
              </div>

              <span
                class="status-badge"
                :class="statusBadgeClass(agent.status)"
              >
                <span class="status-dot" aria-hidden="true"></span>
                {{ statusDotLabel(agent.status) }}
              </span>
            </header>

            <p class="agent-card__responsibility">
              {{ agent.responsibility }}
            </p>

            <!-- Active Task Card when RUNNING or WAITING_FOR_HUMAN -->
            <div
              v-if="agent.currentTask"
              class="active-task-box"
              :data-testid="`active-task-${agent.key}`"
            >
              <div class="active-task-box__top">
                <strong>{{ agent.currentTask.missionSummary }}</strong>
                <span v-if="agent.currentTask.delegatedFrom" class="delegation-tag">
                  {{ agent.currentTask.delegatedFrom }} → {{ agent.name }}
                </span>
              </div>
              <p class="active-task-box__step">
                Step: {{ agent.currentTask.activeStep }}
              </p>
              <div class="active-task-box__metrics">
                <span>Elapsed: {{ formatDuration(agent.currentTask.elapsedMs) }}</span>
                <span>Model calls: {{ agent.currentTask.modelCalls }}</span>
                <span>Tools: {{ agent.currentTask.toolCalls }}</span>
                <span v-if="agent.currentTask.estimatedTokens">
                  Tokens: {{ agent.currentTask.estimatedTokens }}
                </span>
              </div>
            </div>

            <!-- Last Verified Outcome -->
            <div v-else-if="agent.lastVerifiedOutcome" class="outcome-box">
              <span class="outcome-box__label">Latest verified outcome:</span>
              <p class="outcome-box__summary">
                {{ agent.lastVerifiedOutcome.summary }}
              </p>
            </div>

            <!-- Technical Metadata Disclosure -->
            <div v-if="showTechnicalIds" class="technical-meta">
              <div><strong>Key:</strong> <code>{{ agent.key }}</code></div>
              <div><strong>Model:</strong> <code>{{ agent.model }}</code></div>
              <div>
                <strong>Docs:</strong>
                <code>{{ agent.documentationPath }}</code>
              </div>
              <div>
                <strong>Tools:</strong>
                <code>{{ agent.tools.join(', ') }}</code>
              </div>
            </div>

            <footer class="agent-card__footer">
              <button
                type="button"
                class="btn btn--secondary btn--sm"
                :data-testid="`inspect-agent-${agent.key}`"
                @click="openAgentInspector(agent)"
              >
                Inspect Trace &amp; Tools
              </button>

              <button
                v-if="agent.nextAction.actionItemCount"
                type="button"
                class="btn btn--primary btn--sm"
                @click="activeTab = 'attention'"
              >
                {{ agent.nextAction.label }}
              </button>
              <router-link
                v-else-if="
                  agent.nextAction.route &&
                  !agent.nextAction.route.startsWith('/admin/agents')
                "
                :to="agent.nextAction.route"
                class="btn btn--ghost btn--sm"
              >
                {{ agent.nextAction.label }}
              </router-link>
            </footer>
          </article>
        </div>
      </section>

      <!-- TAB 2: DECISION CENTER (Human-in-the-Loop Action Items Queue) -->
      <section
        v-if="activeTab === 'attention'"
        aria-labelledby="decision-center-heading"
        class="supervisor-section"
      >
        <div class="section-header">
          <div>
            <h2 id="decision-center-heading">
              Human-in-the-Loop Decision Center
            </h2>
            <p class="section-subtitle">
              Approve or reject Firenze newsletter drafts and resolve Venezia
              poster candidates &amp; probable duplicate conflicts.
            </p>
          </div>
        </div>

        <div
          v-if="pendingActionItems.length === 0"
          class="empty-state"
          data-testid="empty-action-items"
        >
          <h3>All Human-in-the-Loop Gates Clear</h3>
          <p>
            No newsletter drafts or extracted poster candidates are currently
            waiting for operator intervention.
          </p>
        </div>

        <div v-else class="action-queue">
          <article
            v-for="item in pendingActionItems"
            :key="item.id"
            class="action-card"
            :data-testid="`action-item-${item.id}`"
          >
            <header class="action-card__header">
              <div>
                <div class="action-card__badges">
                  <span class="city-pill">{{ item.agentName }}</span>
                  <span
                    class="priority-pill"
                    :class="`priority-pill--${item.priority}`"
                  >
                    {{ item.priority.toUpperCase() }} PRIORITY
                  </span>
                  <span class="age-pill">{{ item.ageMinutes }}m ago</span>
                </div>
                <h3 class="action-card__title">{{ item.title }}</h3>
                <p class="action-card__summary">{{ item.summary }}</p>
              </div>
            </header>

            <!-- Firenze Newsletter Draft Confirmation Gate -->
            <div
              v-if="item.newsletterDraft"
              class="draft-preview-box"
              data-testid="firenze-draft-gate"
            >
              <div class="draft-preview-box__meta">
                <span>
                  <strong>Edition:</strong>
                  {{ item.newsletterDraft.dateRangeLabel }}
                </span>
                <span>
                  <strong>Approved Shows Included:</strong>
                  {{ item.newsletterDraft.concertsCount }}
                </span>
                <span>
                  <strong>Target:</strong> Beehiiv Draft API v2
                </span>
              </div>
              <div class="draft-preview-box__code">
                <code>{{ item.newsletterDraft.htmlPreview }}</code>
              </div>

              <div class="action-card__controls">
                <input
                  v-model="rejectFeedbackMap[item.id]"
                  type="text"
                  class="feedback-input"
                  placeholder="Optional editorial feedback or revision note…"
                  :aria-label="`Editorial feedback for ${item.title}`"
                />
                <div class="button-row">
                  <button
                    type="button"
                    class="btn btn--primary"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`approve-draft-${item.id}`"
                    @click="handleResolveAction(item, 'approve_beehiiv_draft')"
                  >
                    Approve &amp; Stage to Beehiiv
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`reject-draft-${item.id}`"
                    @click="handleResolveAction(item, 'reject_with_feedback')"
                  >
                    Reject with Feedback
                  </button>
                </div>
              </div>
            </div>

            <!-- Venezia Poster Extraction & Duplicate Conflict Resolver -->
            <div
              v-if="item.extractedData"
              class="comparison-grid"
              data-testid="venezia-conflict-resolver"
            >
              <div class="comparison-col">
                <h4>Venezia Extracted Candidate</h4>
                <dl class="meta-list">
                  <div>
                    <dt>Title</dt>
                    <dd>{{ item.extractedData.title }}</dd>
                  </div>
                  <div>
                    <dt>Date &amp; Time</dt>
                    <dd>
                      {{ item.extractedData.date }} at
                      {{ item.extractedData.time }}
                    </dd>
                  </div>
                  <div>
                    <dt>Venue</dt>
                    <dd>
                      {{ item.extractedData.venueName }}
                      <span v-if="item.extractedData.city">
                        ({{ item.extractedData.city }},
                        {{ item.extractedData.state || 'NC' }})
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Lineup</dt>
                    <dd>
                      {{
                        item.extractedData.bandNames.length
                          ? item.extractedData.bandNames.join(', ')
                          : 'Headliner in title'
                      }}
                    </dd>
                  </div>
                  <div>
                    <dt>Model &amp; Confidence</dt>
                    <dd>
                      <code>{{ item.extractedData.modelName || 'gemini-3.8-flash' }}</code>
                      <span v-if="item.extractedData.confidence">
                        ({{ Math.round(item.extractedData.confidence * 100) }}%)
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div
                v-if="item.probableDuplicates?.length"
                class="comparison-col comparison-col--duplicate"
              >
                <h4>Probable Catalog Match in PostgreSQL</h4>
                <div
                  v-for="dup in item.probableDuplicates"
                  :key="dup.id"
                  class="duplicate-match-item"
                >
                  <strong>{{ dup.title }}</strong>
                  <span>Venue: {{ dup.venueName || 'Matched Venue' }}</span>
                  <span>Starts: {{ formatTimestamp(dup.startsAt) }}</span>
                  <code v-if="showTechnicalIds">ID: {{ dup.id }}</code>
                </div>
              </div>

              <div class="action-card__controls comparison-controls">
                <input
                  v-model="rejectFeedbackMap[item.id]"
                  type="text"
                  class="feedback-input"
                  placeholder="Optional review notes or rejection reason…"
                  :aria-label="`Review notes for ${item.title}`"
                />
                <div class="button-row">
                  <button
                    v-if="item.supportedActions.includes('publish')"
                    type="button"
                    class="btn btn--primary"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`publish-candidate-${item.id}`"
                    @click="handleResolveAction(item, 'publish')"
                  >
                    Approve &amp; Publish
                  </button>
                  <button
                    v-if="item.supportedActions.includes('link')"
                    type="button"
                    class="btn btn--secondary"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`link-candidate-${item.id}`"
                    @click="handleResolveAction(item, 'link')"
                  >
                    Link to Existing
                  </button>
                  <button
                    v-if="item.supportedActions.includes('merge')"
                    type="button"
                    class="btn btn--primary"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`merge-candidate-${item.id}`"
                    @click="handleResolveAction(item, 'merge')"
                  >
                    Merge into Existing
                  </button>
                  <button
                    v-if="item.supportedActions.includes('publish_separately')"
                    type="button"
                    class="btn btn--ghost"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`publish-sep-${item.id}`"
                    @click="handleResolveAction(item, 'publish_separately')"
                  >
                    Publish Separately
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`reject-candidate-${item.id}`"
                    @click="handleResolveAction(item, 'reject')"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>

            <!-- Frankfurt Autonomous Mission PR Confirmation Gate -->
            <div
              v-if="item.missionPr"
              class="pr-decision-box draft-preview-box"
              data-testid="frankfurt-pr-gate"
            >
              <div class="draft-preview-box__meta">
                <span>
                  <strong>Target Issue:</strong>
                  #{{ item.missionPr.issueNumber }} — {{ item.missionPr.issueTitle }}
                </span>
                <span>
                  <strong>Branch:</strong>
                  <code>{{ item.missionPr.branchName }}</code>
                </span>
                <span v-if="item.missionPr.prUrl">
                  <strong>Pull Request:</strong>
                  <a
                    :href="item.missionPr.prUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ item.missionPr.prUrl }}
                  </a>
                </span>
              </div>

              <div class="draft-preview-box__code">
                <div class="pr-summary-text">{{ item.missionPr.summary }}</div>
                <div v-if="item.missionPr.rubric" class="pr-rubric-summary">
                  <div class="rubric-title">
                    Staff Architect Review Gate (GEAR Level 2):
                  </div>
                  <ul class="rubric-list">
                    <li
                      v-for="(opt, idx) in item.missionPr.rubric.optimizations"
                      :key="idx"
                    >
                      🟢 {{ opt }}
                    </li>
                    <li v-if="item.missionPr.rubric.concern">
                      ⚠️ {{ item.missionPr.rubric.concern }}
                    </li>
                  </ul>
                </div>
                <div v-if="item.missionPr.diffStat" class="pr-diff-stat">
                  <code>{{ item.missionPr.diffStat }}</code>
                </div>
              </div>

              <div class="action-card__controls">
                <input
                  v-model="rejectFeedbackMap[item.id]"
                  type="text"
                  class="feedback-input"
                  placeholder="Optional review feedback or change request notes…"
                  :aria-label="`Review feedback for ${item.title}`"
                />
                <div class="button-row">
                  <button
                    type="button"
                    class="btn btn--primary"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`approve-pr-${item.id}`"
                    @click="handleResolveAction(item, 'approve_pr')"
                  >
                    1-Click Approve PR
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger"
                    :disabled="resolvingItemId === item.id"
                    :data-testid="`reject-pr-${item.id}`"
                    @click="handleResolveAction(item, 'reject_with_feedback')"
                  >
                    Request Changes / Reject
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- TAB 3: ACTIVITY & RUNS -->
      <section
        v-if="activeTab === 'activity'"
        aria-labelledby="activity-heading"
        class="supervisor-section"
      >
        <div class="section-header">
          <div>
            <h2 id="activity-heading">Recent Agent Executions</h2>
            <p class="section-subtitle">
              Sanitized execution history from PostgreSQL
              <code>agent_sessions</code> and <code>ingestion_jobs</code>.
            </p>
          </div>

          <div class="filter-bar">
            <label>
              <span>Agent:</span>
              <select
                v-model="filterAgentKey"
                data-testid="filter-agent-select"
              >
                <option value="all">All agents</option>
                <option
                  v-for="agent in agents"
                  :key="agent.key"
                  :value="agent.key"
                >
                  {{ agent.name }}
                </option>
              </select>
            </label>

            <label>
              <span>Status:</span>
              <select
                v-model="filterRunStatus"
                data-testid="filter-status-select"
              >
                <option value="all">All statuses</option>
                <option value="running">Running</option>
                <option value="waiting_for_approval">
                  Waiting for approval
                </option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>
        </div>

        <div v-if="filteredRuns.length === 0" class="empty-state">
          <h3>No Matching Agent Runs</h3>
          <p>Try adjusting the agent or status filter, or load demo fixtures.</p>
        </div>

        <div v-else class="runs-table-wrapper">
          <table class="runs-table" data-testid="runs-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Workflow &amp; Summary</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Calls / Tokens</th>
                <th>Started</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="run in filteredRuns"
                :key="run.id"
                :data-testid="`run-row-${run.id}`"
              >
                <td>
                  <strong>{{ run.agentName }}</strong>
                  <div class="muted-small"><code>{{ run.model }}</code></div>
                </td>
                <td>
                  <div class="run-title">{{ run.title }}</div>
                  <div class="muted-small">{{ run.outputSummary }}</div>
                </td>
                <td>
                  <span
                    class="status-badge"
                    :class="statusBadgeClass(run.status)"
                  >
                    {{ run.status.replace(/_/g, ' ') }}
                  </span>
                </td>
                <td>{{ formatDuration(run.durationMs) }}</td>
                <td>
                  <div>
                    {{ run.modelCalls }} model / {{ run.toolCalls }} tools
                  </div>
                  <div v-if="run.estimatedCostUsd !== null" class="muted-small">
                    ${{ run.estimatedCostUsd.toFixed(4) }}
                  </div>
                </td>
                <td>{{ formatTimestamp(run.startedAt) }}</td>
                <td>
                  <button
                    type="button"
                    class="btn btn--secondary btn--sm"
                    :data-testid="`open-run-${run.id}`"
                    @click="openRunInspector(run)"
                  >
                    Inspect Timeline
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- TAB 4: FRANKFURT MISSIONS -->
      <section
        v-if="activeTab === 'missions'"
        aria-labelledby="missions-heading"
        class="supervisor-section"
      >
        <div class="section-header">
          <div>
            <h2 id="missions-heading">
              Frankfurt Mission Outcomes &amp; Evidence
            </h2>
            <p class="section-subtitle">
              Tracks multi-slice outcomes across GitHub issues, pull requests,
              and verified runtime evidence.
            </p>
          </div>
        </div>

        <div class="missions-list">
          <article
            v-for="mission in missions"
            :key="mission.missionKey"
            class="mission-card"
            :data-testid="`mission-card-${mission.missionKey}`"
          >
            <header class="mission-card__header">
              <div>
                <span class="city-pill">{{ mission.missionKey }}</span>
                <span class="muted-small">
                  Coordinator: <strong>{{ mission.coordinator }}</strong> ·
                  Contracts: <strong>{{ mission.integrationSpecialist }}</strong>
                </span>
                <h3>{{ mission.title }}</h3>
              </div>
              <span
                class="status-badge"
                :class="
                  mission.status === 'completed'
                    ? 'badge--succeeded'
                    : 'badge--waiting'
                "
              >
                {{ mission.status.replace(/_/g, ' ') }} ({{
                  mission.completedSlices
                }}/{{ mission.totalSlices }} slices)
              </span>
            </header>

            <p>{{ mission.summary }}</p>

            <div v-if="mission.blocker" class="mission-blocker">
              <strong>Active Blocker:</strong> {{ mission.blocker }}
            </div>

            <div class="mission-evidence-grid">
              <div>
                <h4>Acceptance Evidence</h4>
                <ul class="evidence-list">
                  <li v-for="(ev, idx) in mission.evidence" :key="idx">
                    <span aria-hidden="true">{{
                      ev.verified ? '✓' : '○'
                    }}</span>
                    <div>
                      <strong>{{ ev.label }}</strong>
                      <div class="muted-small">{{ ev.detail }}</div>
                    </div>
                  </li>
                </ul>
              </div>

              <div>
                <h4>Linked Issues &amp; PRs</h4>
                <ul class="links-list">
                  <li v-for="iss in mission.linkedIssues" :key="iss.number">
                    <a :href="iss.url" target="_blank" rel="noopener noreferrer">
                      Issue #{{ iss.number }}: {{ iss.title }}
                    </a>
                    <span class="muted-small">({{ iss.state }})</span>
                  </li>
                  <li v-for="pr in mission.linkedPrs" :key="pr.number">
                    <a :href="pr.url" target="_blank" rel="noopener noreferrer">
                      PR #{{ pr.number }}: {{ pr.title }}
                    </a>
                    <span class="muted-small">({{ pr.state }})</span>
                  </li>
                </ul>
              </div>
            </div>

            <footer class="mission-card__footer">
              <strong>Next Step:</strong> {{ mission.nextStep }}
            </footer>
          </article>
        </div>
      </section>

      <!-- GLASS BOX INSPECTOR DRAWER (Run Timeline, Tool Payloads & Bounded Steering) -->
      <aside
        v-if="selectedRun || selectedAgentForDrawer"
        class="inspector-drawer-backdrop"
        data-testid="inspector-drawer"
        @click.self="closeInspector"
      >
        <div
          class="inspector-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspector-drawer-title"
        >
          <header class="inspector-drawer__header">
            <div>
              <span class="city-pill">
                {{
                  selectedAgentForDrawer?.name ||
                  selectedRun?.agentName ||
                  'Agent'
                }}
              </span>
              <h2 id="inspector-drawer-title">
                {{
                  selectedRun?.title ||
                  selectedAgentForDrawer?.role ||
                  'Execution Inspector'
                }}
              </h2>
            </div>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              data-testid="close-inspector-btn"
              @click="closeInspector"
            >
              Close ✕
            </button>
          </header>

          <div class="inspector-drawer__body">
            <!-- Run Summary Metadata -->
            <div v-if="selectedRun" class="inspector-meta-grid">
              <div>
                <span class="muted-small">Status</span>
                <div>
                  <strong>{{ selectedRun.status }}</strong>
                </div>
              </div>
              <div>
                <span class="muted-small">Model</span>
                <div>
                  <code>{{ selectedRun.model }}</code>
                </div>
              </div>
              <div>
                <span class="muted-small">Duration</span>
                <div>
                  <strong>{{ formatDuration(selectedRun.durationMs) }}</strong>
                </div>
              </div>
              <div>
                <span class="muted-small">Measured Cost</span>
                <div>
                  <strong>
                    {{
                      selectedRun.estimatedCostUsd !== null
                        ? `$${selectedRun.estimatedCostUsd.toFixed(4)}`
                        : 'Unavailable'
                    }}
                  </strong>
                </div>
              </div>
            </div>

            <!-- Ordered Event & Tool Call Timeline -->
            <h3>Structured Event &amp; Tool Timeline</h3>
            <p class="muted-small">
              Sanitized execution steps. Secret tokens, private prompts, and
              raw chain-of-thought are automatically redacted.
            </p>

            <ol
              v-if="selectedRun?.events?.length"
              class="trace-timeline"
              data-testid="trace-timeline"
            >
              <li
                v-for="evt in selectedRun.events"
                :key="evt.id"
                class="trace-step"
                :class="`trace-step--${evt.type}`"
              >
                <div class="trace-step__header">
                  <span class="trace-step__seq">#{{ evt.sequence }}</span>
                  <strong>{{ evt.title }}</strong>
                  <span v-if="evt.latencyMs" class="muted-small">
                    {{ evt.latencyMs }}ms
                  </span>
                  <span v-if="evt.httpStatus" class="muted-small">
                    HTTP {{ evt.httpStatus }}
                  </span>
                </div>
                <p class="trace-step__summary">{{ evt.summary }}</p>

                <details
                  v-if="evt.arguments && Object.keys(evt.arguments).length"
                  class="payload-details"
                >
                  <summary>Inspect Validated Tool Arguments</summary>
                  <pre><code>{{ JSON.stringify(evt.arguments, null, 2) }}</code></pre>
                </details>

                <details
                  v-if="evt.response && Object.keys(evt.response).length"
                  class="payload-details"
                >
                  <summary>Inspect Sanitized Tool Response</summary>
                  <pre><code>{{ JSON.stringify(evt.response, null, 2) }}</code></pre>
                </details>
              </li>
            </ol>

            <div v-else class="empty-state">
              <p>
                No active run selected for this agent. Choose a run in the
                Activity tab or load Demo Walkthrough fixtures.
              </p>
            </div>

            <!-- Operator Steering Note Box -->
            <div class="steering-box">
              <h4>Record Operator Steering Directive</h4>
              <p class="muted-small">
                Persists a sanitized steering note to
                <code>agent_memories</code> for this agent’s next reasoning or
                curation cycle.
              </p>
              <div class="steering-box__row">
                <input
                  v-model="steeringInput"
                  type="text"
                  class="feedback-input"
                  placeholder="e.g., Prioritize independent Durham venues in next curation…"
                  data-testid="steering-input"
                />
                <button
                  type="button"
                  class="btn btn--secondary"
                  :disabled="steeringSubmitting || !steeringInput.trim()"
                  data-testid="send-steering-btn"
                  @click="handleSendSteering"
                >
                  {{ steeringSubmitting ? 'Saving…' : 'Save Directive' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </template>
  </section>
</template>

<style scoped>
.supervisor-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.supervisor-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 14px;
  box-shadow: var(--shadow, 0 10px 30px rgba(31, 41, 51, 0.08));
}

.supervisor-eyebrow {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.env-pill,
.freshness-pill,
.fixture-pill,
.city-pill,
.readiness-pill,
.priority-pill,
.age-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.env-pill {
  background: #eef2ff;
  color: #3730a3;
}

.freshness-pill--fresh {
  background: #ecfdf5;
  color: #065f46;
}

.freshness-pill--partial,
.freshness-pill--degraded {
  background: #fffbeb;
  color: #92400e;
}

.fixture-pill {
  background: #fef3c7;
  color: #92400e;
}

.supervisor-title {
  margin: 0 0 0.35rem;
  font-size: 1.65rem;
  font-weight: 800;
}

.supervisor-subtitle {
  margin: 0;
  color: var(--text-muted, #5f6b76);
  max-width: 68ch;
  line-height: 1.45;
}

.supervisor-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1.15rem 1.25rem;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
}

.kpi-card--highlight {
  border-color: #f59e0b;
  background: #fffbeb;
}

.kpi-card__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-muted, #5f6b76);
}

.kpi-card__value {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1.1;
}

.kpi-card__meta {
  font-size: 0.8rem;
  color: var(--text-muted, #5f6b76);
}

.supervisor-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border, #e5e7eb);
  padding-bottom: 0.5rem;
}

.supervisor-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #5f6b76);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.supervisor-tab--active {
  background: var(--surface, #ffffff);
  border-color: var(--border, #e5e7eb);
  color: var(--text, #1f2933);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--accent, #f05537);
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
}

.section-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
}

.section-subtitle {
  margin: 0;
  color: var(--text-muted, #5f6b76);
  font-size: 0.92rem;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.agent-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 1.25rem;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
}

.agent-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.agent-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
}

.city-pill {
  background: #f3f4f6;
  color: #111827;
}

.readiness--runtime {
  background: #d1fae5;
  color: #065f46;
}

.readiness--partial {
  background: #e0f2fe;
  color: #075985;
}

.readiness--role {
  background: #f3e8ff;
  color: #6b21a8;
}

.agent-card__title {
  margin: 0;
  font-size: 1.15rem;
}

.agent-card__role {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted, #5f6b76);
}

.agent-card__responsibility {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--text, #1f2933);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  white-space: nowrap;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
}

.badge--running {
  background: #d1fae5;
  color: #065f46;
}

.badge--waiting {
  background: #fef3c7;
  color: #92400e;
}

.badge--error {
  background: #fee2e2;
  color: #991b1b;
}

.badge--succeeded {
  background: #dcfce7;
  color: #166534;
}

.badge--idle {
  background: #f3f4f6;
  color: #4b5563;
}

.active-task-box {
  padding: 0.75rem;
  border-radius: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  font-size: 0.85rem;
}

.active-task-box__top {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.delegation-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: #92400e;
}

.active-task-box__step {
  margin: 0 0 0.4rem;
  color: #78350f;
}

.active-task-box__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  font-size: 0.76rem;
  color: #92400e;
}

.outcome-box {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: var(--surface-soft, #fbfbfa);
  border: 1px solid var(--border, #e5e7eb);
  font-size: 0.83rem;
}

.outcome-box__label {
  display: block;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--text-muted, #5f6b76);
  margin-bottom: 0.2rem;
}

.outcome-box__summary {
  margin: 0;
}

.technical-meta {
  padding: 0.6rem;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 0.78rem;
  display: grid;
  gap: 0.2rem;
}

.agent-card__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border, #e5e7eb);
}

.action-queue {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-card {
  padding: 1.25rem;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
}

.action-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.priority-pill--high {
  background: #fee2e2;
  color: #991b1b;
}

.priority-pill--medium {
  background: #fef3c7;
  color: #92400e;
}

.age-pill {
  background: #f3f4f6;
  color: #374151;
}

.draft-preview-box,
.comparison-grid {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 10px;
  background: var(--surface-soft, #fbfbfa);
  border: 1px solid var(--border, #e5e7eb);
}

.draft-preview-box__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.draft-preview-box__code {
  padding: 0.75rem;
  background: #ffffff;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  font-size: 0.82rem;
  overflow-x: auto;
  margin-bottom: 0.85rem;
}

.pr-summary-text {
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text, #1f2933);
}

.pr-rubric-summary {
  margin: 0.5rem 0;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}

.rubric-title {
  font-weight: 700;
  font-size: 0.8rem;
  margin-bottom: 0.25rem;
  color: #1e3a8a;
}

.rubric-list {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.82rem;
  line-height: 1.4;
}

.pr-diff-stat {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 6px;
  font-size: 0.78rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.comparison-controls {
  grid-column: 1 / -1;
}

.meta-list {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.86rem;
}

.meta-list dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted, #5f6b76);
}

.meta-list dd {
  margin: 0;
}

.duplicate-match-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  font-size: 0.85rem;
}

.action-card__controls {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.feedback-input {
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.95rem;
  border-radius: 8px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--sm {
  padding: 0.4rem 0.75rem;
  font-size: 0.82rem;
}

.btn--primary {
  background: var(--accent, #f05537);
  color: #ffffff;
}

.btn--secondary {
  background: #1f2933;
  color: #ffffff;
}

.btn--ghost {
  background: #ffffff;
  border-color: var(--border, #e5e7eb);
  color: var(--text, #1f2933);
}

.btn--danger {
  background: #fee2e2;
  color: #991b1b;
}

.runs-table-wrapper {
  overflow-x: auto;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.runs-table th,
.runs-table td {
  padding: 0.85rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.muted-small {
  font-size: 0.78rem;
  color: var(--text-muted, #5f6b76);
}

.missions-list {
  display: grid;
  gap: 1rem;
}

.mission-card {
  padding: 1.25rem;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 12px;
}

.mission-card__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.mission-evidence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

.evidence-list,
.links-list {
  margin: 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 0.45rem;
  font-size: 0.86rem;
}

.banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  font-size: 0.9rem;
}

.banner--info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
}

.banner--success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.banner--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  background: var(--surface, #ffffff);
  border: 1px dashed var(--border, #e5e7eb);
  border-radius: 12px;
}

.inspector-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(17, 24, 39, 0.48);
  display: flex;
  justify-content: flex-end;
}

.inspector-drawer {
  width: min(620px, 100vw);
  height: 100%;
  background: var(--surface, #ffffff);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.15);
}

.inspector-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--border, #e5e7eb);
}

.inspector-drawer__body {
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.inspector-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 0.85rem;
  border-radius: 10px;
  background: var(--surface-soft, #fbfbfa);
  border: 1px solid var(--border, #e5e7eb);
}

.trace-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.trace-step {
  padding: 0.85rem;
  border-radius: 10px;
  border: 1px solid var(--border, #e5e7eb);
  background: #ffffff;
}

.trace-step__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.3rem;
}

.trace-step__seq {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted, #5f6b76);
}

.payload-details pre {
  margin: 0.5rem 0 0;
  padding: 0.65rem;
  background: #111827;
  color: #f9fafb;
  border-radius: 6px;
  font-size: 0.78rem;
  overflow-x: auto;
}

.steering-box {
  padding: 1rem;
  border-radius: 10px;
  background: var(--surface-soft, #fbfbfa);
  border: 1px solid var(--border, #e5e7eb);
}

.steering-box__row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

@media (max-width: 720px) {
  .supervisor-header {
    padding: 1rem;
  }

  .steering-box__row {
    flex-direction: column;
  }
}
</style>
