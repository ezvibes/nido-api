<template>
  <section class="concert-sync">
    <header class="concert-sync__header">
      <div>
        <p class="concert-sync__eyebrow">Sync Doctor</p>
        <h2>Concert sync</h2>
        <p>Create concerts from calendar events and monitor the sync job.</p>
      </div>
      <router-link class="concert-sync__events-link" to="/events">
        View Events
      </router-link>
    </header>

    <p v-if="message" :class="messageClass">{{ message }}</p>

    <div class="concert-sync__layout">
      <div class="concert-sync__main-column">
        <section class="concert-sync__panel">
          <div class="concert-sync__panel-header">
            <div>
              <h3>Run sync</h3>
              <p>Sync live calendar events into your concert feed.</p>
            </div>
          </div>

          <form class="concert-sync__form" @submit.prevent="runSync">
            <details
              class="concert-sync__advanced concert-sync__field--wide"
              open
            >
              <summary>Advanced: Live Google Calendar</summary>
              <div class="concert-sync__advanced-grid">
                <label class="concert-sync__advanced-field">
                  <span>Calendar ID</span>
                  <select v-model="liveForm.calendarId">
                    <option
                      v-for="calendar in calendarOptions"
                      :key="calendar.value"
                      :value="calendar.value"
                    >
                      {{ calendar.label }}
                    </option>
                  </select>
                </label>
                <div class="concert-sync__date-range">
                  <label class="concert-sync__advanced-field">
                    <span>From</span>
                    <input v-model="liveForm.fromDate" type="datetime-local" />
                  </label>
                  <label class="concert-sync__advanced-field">
                    <span>To</span>
                    <input v-model="liveForm.toDate" type="datetime-local" />
                  </label>
                </div>
              </div>
            </details>

            <div class="concert-sync__options concert-sync__field--wide">
              <label>
                <span>Max events</span>
                <input
                  v-model.number="sharedForm.maxEvents"
                  type="number"
                  min="1"
                  max="100"
                />
              </label>
              <label class="concert-sync__check">
                <input v-model="sharedForm.dryRun" type="checkbox" />
                <span>Dry run</span>
              </label>
              <label class="concert-sync__check">
                <input v-model="sharedForm.refreshTopPicks" type="checkbox" />
                <span>Refresh Top Picks</span>
              </label>
            </div>

            <div class="concert-sync__actions concert-sync__field--wide">
              <button
                type="submit"
                class="concert-sync__primary"
                :disabled="isRunDisabled"
              >
                {{ isCreatingJob ? 'Starting…' : 'Run sync' }}
              </button>
              <button
                type="button"
                class="concert-sync__secondary"
                :disabled="isRefreshingJob || !activeJob"
                @click="refreshActiveJob"
              >
                {{ isRefreshingJob ? 'Refreshing…' : 'Refresh status' }}
              </button>
            </div>
          </form>
        </section>

        <section class="concert-sync__panel">
          <div class="concert-sync__panel-header">
            <div>
              <h3>Latest sync</h3>
              <p v-if="activeJob">
                {{ latestSyncTimestamp(activeJob) }} by
                {{ formatPerformer(activeJob) }}
              </p>
              <p v-else>Run a sync to create concerts from calendar events.</p>
            </div>
            <span v-if="activeJob" :class="statusClass(activeJob.status)">
              {{ activeJob.status }}
            </span>
          </div>

          <div v-if="activeJob" class="concert-sync__job-summary">
            <div class="concert-sync__summary-grid">
              <div>
                <span>Started</span>
                <strong>{{ formatDate(activeJob.startedAt) }}</strong>
              </div>
              <div>
                <span>Completed</span>
                <strong>{{ formatDate(activeJob.completedAt) }}</strong>
              </div>
              <div>
                <span>Calendar</span>
                <strong>{{ formatCalendarLabel(activeJob.calendarId) }}</strong>
              </div>
              <div>
                <span>Concert</span>
                <strong>{{ formatConcertNames(activeJob) }}</strong>
              </div>
              <div>
                <span>Result</span>
                <strong>{{ formatJobResult(activeJob) }}</strong>
              </div>
            </div>

            <p v-if="isPolling" class="concert-sync__muted">
              Polling job status…
            </p>
            <p v-if="activeJob.errorMessage" class="concert-sync__error">
              {{ activeJob.errorMessage }}
            </p>

            <div v-if="showEventsHandoff" class="concert-sync__handoff">
              <p>Concerts were written to your event feed.</p>
              <router-link class="concert-sync__primary" to="/events">
                View Events
              </router-link>
            </div>

            <p
              v-if="activeJob.status === 'completed'"
              class="concert-sync__muted"
            >
              Admin approval for Top Picks can be completed in Swagger.
            </p>
          </div>
        </section>
      </div>
    </div>

    <section class="concert-sync__panel concert-sync__panel--jobs">
      <div class="concert-sync__panel-header">
        <div>
          <h3>Recent jobs</h3>
          <p>Last {{ recentJobs.length }} sync jobs for this account.</p>
        </div>
        <button
          type="button"
          class="concert-sync__secondary"
          :disabled="isLoadingJobs"
          @click="loadRecentJobs"
        >
          {{ isLoadingJobs ? 'Loading…' : 'Refresh jobs' }}
        </button>
      </div>

      <div v-if="recentJobs.length" class="concert-sync__jobs-table">
        <div class="concert-sync__jobs-header" aria-hidden="true">
          <span>Status</span>
          <span>Started</span>
          <span>Synced by</span>
          <span>Calendar</span>
          <span>Result</span>
          <span>Skipped</span>
        </div>
        <button
          v-for="job in recentJobs"
          :key="job.id"
          type="button"
          class="concert-sync__job-row"
          @click="selectJob(job.id)"
        >
          <span :class="statusClass(job.status)">{{ job.status }}</span>
          <span>{{ latestSyncTimestamp(job) }}</span>
          <span>{{ formatPerformer(job) }}</span>
          <span>{{ formatCalendarLabel(job.calendarId) }}</span>
          <span>{{ formatJobResult(job) }}</span>
          <span>{{ job.eventsSkipped }}</span>
        </button>
      </div>

      <p v-else class="concert-sync__empty">No sync jobs yet.</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import {
  createConcertSyncJob,
  fetchConcertSyncJob,
  fetchConcertSyncJobs,
  type ConcertSyncJobDetailResponse,
  type ConcertSyncJobResponse,
  type ConcertSyncJobStatus,
  type CreateConcertSyncJobPayload,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';

const { user } = useAuth();

const activeJob = ref<ConcertSyncJobDetailResponse | null>(null);
const recentJobs = ref<ConcertSyncJobResponse[]>([]);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const isCreatingJob = ref(false);
const isRefreshingJob = ref(false);
const isLoadingJobs = ref(false);
const isPolling = ref(false);
const pollingAttempts = ref(0);
let pollingTimer: number | undefined;

const liveForm = reactive({
  calendarId: 'ezvibesinc@gmail.com',
  fromDate: '2026-06-01T00:00',
  toDate: '2026-07-01T00:00',
});

const calendarOptions = [
  {
    label: 'EZ Vibes Concert Calendar',
    value: 'ezvibesinc@gmail.com',
  },
  {
    label: 'Jambase Calendar',
    value:
      'http://www.jambase.com/calendar/8540E6A6-9ED5-43D6-A7C9-A442AF57E0F0/ical.ics',
  },
] as const;

const sharedForm = reactive({
  dryRun: true,
  refreshTopPicks: false,
  maxEvents: 1,
});

const terminalStatuses: ConcertSyncJobStatus[] = ['completed', 'failed'];

const messageClass = computed(() =>
  messageType.value === 'success'
    ? 'concert-sync__message concert-sync__message--success'
    : 'concert-sync__message concert-sync__message--error',
);

const isRunDisabled = computed(
  () =>
    isCreatingJob.value ||
    !user.value ||
    !sharedForm.maxEvents ||
    sharedForm.maxEvents < 1 ||
    sharedForm.maxEvents > 100 ||
    !isLiveFormValid.value,
);

const selectedCalendarId = computed(() => liveForm.calendarId.trim());

const isLiveFormValid = computed(() => {
  if (!selectedCalendarId.value) {
    return false;
  }

  const from = liveForm.fromDate ? new Date(liveForm.fromDate) : null;
  const to = liveForm.toDate ? new Date(liveForm.toDate) : null;
  if (from && to && from > to) {
    return false;
  }

  return true;
});

const showEventsHandoff = computed(
  () =>
    activeJob.value?.status === 'completed' &&
    activeJob.value.eventsCreated + activeJob.value.eventsUpdated > 0,
);

const getToken = async () => {
  const current = user.value;
  if (!current) {
    throw new Error('You must be signed in.');
  }
  return current.getIdToken();
};

const getErrorMessage = (error: unknown) => {
  const maybeAxiosError = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const responseMessage = maybeAxiosError.response?.data?.message;
  if (Array.isArray(responseMessage)) {
    return responseMessage.join(' ');
  }
  return responseMessage ?? maybeAxiosError.message ?? 'Request failed.';
};

const clampMaxEvents = () => {
  const value = Number(sharedForm.maxEvents);
  if (!Number.isFinite(value)) {
    sharedForm.maxEvents = 1;
    return;
  }
  sharedForm.maxEvents = Math.min(Math.max(Math.trunc(value), 1), 100);
};

const toIsoDate = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

const buildLivePayload = (): CreateConcertSyncJobPayload => ({
  calendarId: selectedCalendarId.value,
  fromDate: toIsoDate(liveForm.fromDate),
  toDate: toIsoDate(liveForm.toDate),
  maxEvents: sharedForm.maxEvents,
  dryRun: sharedForm.dryRun,
  refreshTopPicks: sharedForm.refreshTopPicks,
});

const runSync = async () => {
  if (isRunDisabled.value) return;

  stopPolling();
  clampMaxEvents();
  isCreatingJob.value = true;
  message.value = '';

  try {
    const token = await getToken();
    const payload = buildLivePayload();
    const job = await createConcertSyncJob(token, payload);
    activeJob.value = { ...job, recentEvents: [] };
    messageType.value = 'success';
    message.value = 'Sync job started.';
    startPolling(job.id);
    await loadRecentJobs();
  } catch (error) {
    messageType.value = 'error';
    message.value = getErrorMessage(error);
  } finally {
    isCreatingJob.value = false;
  }
};

const loadRecentJobs = async () => {
  if (!user.value) {
    recentJobs.value = [];
    return;
  }

  isLoadingJobs.value = true;
  try {
    const token = await getToken();
    const result = await fetchConcertSyncJobs(token, {
      limit: 10,
      offset: 0,
    });
    recentJobs.value = result.items;
  } catch (error) {
    messageType.value = 'error';
    message.value = getErrorMessage(error);
  } finally {
    isLoadingJobs.value = false;
  }
};

const refreshJob = async (jobId: string) => {
  const token = await getToken();
  const job = await fetchConcertSyncJob(token, jobId);
  activeJob.value = job;

  if (terminalStatuses.includes(job.status)) {
    stopPolling();
    await loadRecentJobs();
  }

  return job;
};

const refreshActiveJob = async () => {
  if (!activeJob.value || isRefreshingJob.value) return;

  isRefreshingJob.value = true;
  message.value = '';
  try {
    await refreshJob(activeJob.value.id);
  } catch (error) {
    messageType.value = 'error';
    message.value = getErrorMessage(error);
  } finally {
    isRefreshingJob.value = false;
  }
};

const selectJob = async (jobId: string) => {
  stopPolling();
  isRefreshingJob.value = true;
  message.value = '';
  try {
    const job = await refreshJob(jobId);
    if (!terminalStatuses.includes(job.status)) {
      startPolling(job.id);
    }
  } catch (error) {
    messageType.value = 'error';
    message.value = getErrorMessage(error);
  } finally {
    isRefreshingJob.value = false;
  }
};

const startPolling = (jobId: string) => {
  stopPolling();
  pollingAttempts.value = 0;
  isPolling.value = true;
  pollingTimer = window.setInterval(() => {
    pollingAttempts.value += 1;
    if (pollingAttempts.value > 60) {
      stopPolling();
      messageType.value = 'error';
      message.value = 'Still processing. Refresh job status to continue.';
      return;
    }

    void refreshJob(jobId).catch((error) => {
      stopPolling();
      messageType.value = 'error';
      message.value = getErrorMessage(error);
    });
  }, 1000);
};

const stopPolling = () => {
  if (pollingTimer !== undefined) {
    window.clearInterval(pollingTimer);
    pollingTimer = undefined;
  }
  isPolling.value = false;
};

const statusClass = (status: ConcertSyncJobStatus) => [
  'concert-sync__status',
  `concert-sync__status--${status}`,
];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const latestSyncTimestamp = (job: ConcertSyncJobResponse) =>
  formatDate(job.completedAt ?? job.startedAt ?? job.createdAt);

const formatPerformer = (job: ConcertSyncJobResponse) =>
  job.performedByUserEmail ?? user.value?.email ?? 'Current user';

const formatCalendarLabel = (calendarId: string) =>
  calendarOptions.find((calendar) => calendar.value === calendarId)?.label ??
  calendarId;

const formatConcertNames = (job: ConcertSyncJobDetailResponse) => {
  const titles = job.recentEvents
    .map((event) => event.concertTitle?.trim())
    .filter((title): title is string => Boolean(title));

  if (!titles.length) return 'No concert created';

  const uniqueTitles = Array.from(new Set(titles));
  if (uniqueTitles.length === 1) return uniqueTitles[0];

  return `${uniqueTitles[0]} +${uniqueTitles.length - 1} more`;
};

const formatJobResult = (job: ConcertSyncJobResponse) => {
  const changed = job.eventsCreated + job.eventsUpdated;
  if (job.status === 'failed') return 'Failed';
  if (job.metadata?.dryRun) return `${job.eventsProcessed} checked`;
  if (changed > 0) return `${changed} written`;
  return `${job.eventsProcessed} checked`;
};

watch(
  user,
  () => {
    void loadRecentJobs();
  },
  { immediate: true },
);

onMounted(() => {
  void loadRecentJobs();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<style scoped>
.concert-sync {
  display: grid;
  gap: 1.25rem;
}

.concert-sync__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.concert-sync__header h2,
.concert-sync__header p,
.concert-sync__panel h3,
.concert-sync__panel p {
  margin: 0;
}

.concert-sync__header h2 {
  font-size: 1.8rem;
  letter-spacing: 0;
}

.concert-sync__header p,
.concert-sync__panel-header p,
.concert-sync__muted,
.concert-sync__empty {
  color: var(--text-muted);
}

.concert-sync__eyebrow {
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.concert-sync__layout {
  display: grid;
  gap: 1rem;
}

.concert-sync__main-column {
  display: grid;
  gap: 1rem;
}

.concert-sync__panel {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.concert-sync__panel-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.concert-sync__options,
.concert-sync__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.concert-sync__check {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.5rem;
}

.concert-sync__form {
  display: grid;
  gap: 0.85rem;
}

.concert-sync__form label,
.concert-sync__summary-grid div {
  display: grid;
  gap: 0.3rem;
}

.concert-sync__form span,
.concert-sync__summary-grid span {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.concert-sync__form input,
.concert-sync__form select,
.concert-sync__form textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font: inherit;
}

.concert-sync__advanced {
  padding: 1rem;
  border: 1px solid rgba(53, 211, 153, 0.24);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(53, 211, 153, 0.08), #fff);
}

.concert-sync__advanced summary {
  cursor: pointer;
  font-weight: 700;
  color: var(--text);
}

.concert-sync__advanced-grid {
  display: grid;
  gap: 0.9rem;
  margin-top: 0.85rem;
}

.concert-sync__advanced-field {
  display: grid;
  gap: 0.3rem;
}

.concert-sync__date-range {
  display: grid;
  gap: 0.75rem;
}

.concert-sync__primary,
.concert-sync__secondary,
.concert-sync__events-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  border-radius: 999px;
  padding: 0.65rem 1rem;
  font-weight: 700;
  text-decoration: none;
}

.concert-sync__primary {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
}

.concert-sync__secondary,
.concert-sync__events-link {
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text);
}

.concert-sync__primary:disabled,
.concert-sync__secondary:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.concert-sync__message {
  margin: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.concert-sync__message--success {
  background: rgba(40, 93, 51, 0.08);
  color: #285d33;
}

.concert-sync__message--error,
.concert-sync__error {
  background: rgba(180, 35, 24, 0.08);
  color: #b42318;
}

.concert-sync__error {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
}

.concert-sync__job-summary {
  display: grid;
  gap: 0.85rem;
}

.concert-sync__summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.concert-sync__summary-grid div {
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-soft);
}

.concert-sync__summary-grid strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.concert-sync__jobs-table {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}

.concert-sync__jobs-header,
.concert-sync__job-row {
  display: grid;
  gap: 0.65rem;
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  text-align: left;
  background: #fff;
  box-sizing: border-box;
}

.concert-sync__jobs-header {
  display: none;
  background: var(--surface-soft);
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.concert-sync__job-row:last-child {
  border-bottom: 0;
}

.concert-sync__job-row:hover {
  background: var(--surface-soft);
}

.concert-sync__handoff {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem;
  border: 1px solid rgba(40, 93, 51, 0.2);
  border-radius: 8px;
  background: rgba(40, 93, 51, 0.08);
}

.concert-sync__status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.8rem;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.concert-sync__status--queued {
  background: #eef2ff;
  color: #3730a3;
}

.concert-sync__status--processing {
  background: #fff7ed;
  color: #9a3412;
}

.concert-sync__status--completed {
  background: #ecfdf3;
  color: #027a48;
}

.concert-sync__status--failed {
  background: #fef3f2;
  color: #b42318;
}

@media (min-width: 820px) {
  .concert-sync__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .concert-sync__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .concert-sync__advanced-grid {
    grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr);
    align-items: end;
  }

  .concert-sync__date-range {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .concert-sync__field--wide,
  .concert-sync__options,
  .concert-sync__actions,
  .concert-sync__advanced {
    grid-column: 1 / -1;
  }

  .concert-sync__summary-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: center;
  }

  .concert-sync__jobs-header {
    display: grid;
  }

  .concert-sync__jobs-header,
  .concert-sync__job-row {
    grid-template-columns:
      minmax(108px, 0.7fr)
      minmax(160px, 1fr)
      minmax(160px, 1fr)
      minmax(160px, 1fr)
      minmax(92px, 0.7fr)
      minmax(72px, 0.55fr);
    align-items: center;
  }
}

@media (max-width: 720px) {
  .concert-sync__header,
  .concert-sync__panel-header,
  .concert-sync__handoff {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
