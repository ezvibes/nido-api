<template>
  <section class="my-submissions-page">
    <header class="my-submissions-page__header">
      <div>
        <h2 class="my-submissions-page__title">My Poster Submissions</h2>
        <p class="my-submissions-page__subtitle">
          Track your uploaded concert posters and view their live status in the event extraction pipeline.
        </p>
      </div>
      <button
        type="button"
        class="my-submissions-page__refresh"
        :disabled="loading"
        @click="loadSubmissions"
      >
        {{ loading ? 'Refreshing…' : 'Refresh status' }}
      </button>
    </header>

    <div v-if="loading && submissions.length === 0" class="my-submissions-page__state">
      Loading your submissions…
    </div>

    <div v-else-if="error" class="my-submissions-page__state my-submissions-page__state--error">
      {{ error }}
    </div>

    <div v-else-if="submissions.length === 0" class="my-submissions-page__empty">
      <h3>No poster submissions yet</h3>
      <p>When you upload a poster on the Concerts page, your submission history and live extraction status will appear here.</p>
      <router-link to="/concerts" class="my-submissions-page__upload-link">
        Upload a Concert Poster →
      </router-link>
    </div>

    <div v-else class="my-submissions-page__list">
      <div
        v-for="item in submissions"
        :key="item.id"
        class="submission-card"
      >
        <div class="submission-card__main">
          <div class="submission-card__title-row">
            <h3 class="submission-card__title">{{ getSubmissionTitle(item) }}</h3>
            <span :class="['ingestion-status-pill', `ingestion-status-pill--${getJobStatusKey(item)}`]">
              {{ getJobStatusLabel(item) }}
            </span>
          </div>
          <p class="submission-card__meta">
            {{ getSubmissionMeta(item) }}
          </p>
          <p class="submission-card__next">
            {{ getJobNextStepCopy(item) }}
          </p>

          <div v-if="item.candidates && item.candidates.length > 0" class="submission-card__candidates">
            <div
              v-for="cand in item.candidates"
              :key="cand.id"
              class="submission-cand-row"
            >
              <div class="submission-cand-row__info">
                <strong>{{ cand.title || 'Show Listing' }}</strong>
                <span class="submission-cand-row__venue">
                  {{ cand.venueName || 'Venue pending' }}
                  <span v-if="cand.date"> · {{ formatSummaryDate(cand.date) }}</span>
                  <span v-if="cand.time"> · {{ cand.time.slice(0, 5) }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="submission-card__actions">
          <a
            v-if="getPublishedConcertIdForJob(item)"
            href="/concerts"
            class="submission-card__link submission-card__link--published"
          >
            View Live Show →
          </a>
          <button
            v-else-if="getJobStatusKey(item) === 'failed' && item.concertUpload?.id"
            type="button"
            class="submission-card__retry-btn"
            :disabled="retryingJobId === item.id"
            @click="handleRetry(item)"
          >
            {{ retryingJobId === item.id ? 'Retrying…' : 'Retry' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  createIngestionJob,
  fetchIngestionJob,
  fetchMyIngestionSubmissions,
  type IngestionJobResponse,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';

const { user } = useAuth();
const submissions = ref<IngestionJobResponse[]>([]);
const loading = ref(false);
const error = ref('');
const retryingJobId = ref<string | null>(null);

const FAILED_JOB_STATUSES = ['failed', 'retryable_failure', 'terminal_failure'];
const IN_FLIGHT_JOB_STATUSES = [
  'queued',
  'processing',
  'asset_validated',
  'ocr_completed',
  'extraction_completed',
  'matches_proposed',
];

let pollingTimer: any = null;

const getJobStatusKey = (targetJob?: IngestionJobResponse | null) => {
  if (!targetJob) return 'submitted';
  const hasPublished =
    targetJob.status === 'completed' ||
    targetJob.concertUpload?.reviewStatus === 'approved' ||
    targetJob.candidates?.some((c) => c.status === 'published');
  if (hasPublished) return 'published';
  if (FAILED_JOB_STATUSES.includes(targetJob.status)) return 'failed';
  if (targetJob.status === 'rejected' || targetJob.concertUpload?.reviewStatus === 'rejected') {
    return 'rejected';
  }
  if (targetJob.status === 'needs_review') return 'awaiting_review';
  if (IN_FLIGHT_JOB_STATUSES.includes(targetJob.status) && targetJob.status !== 'queued') {
    return 'reading';
  }
  return 'submitted';
};

const getJobStatusLabel = (targetJob?: IngestionJobResponse | null) => {
  const key = getJobStatusKey(targetJob);
  switch (key) {
    case 'submitted':
      return 'Submitted';
    case 'reading':
      return 'Reading poster';
    case 'awaiting_review':
      return 'Awaiting review';
    case 'published':
      return 'Published';
    case 'rejected':
      return 'Not published';
    case 'failed':
      return 'Needs retry';
    default:
      return 'Submitted';
  }
};

const getJobNextStepCopy = (targetJob: IngestionJobResponse) => {
  const key = getJobStatusKey(targetJob);
  if (key === 'published') {
    return 'Your show is live on the Nido concert calendar.';
  }
  if (key === 'awaiting_review') {
    return 'Details found! Nothing else to do — our editors will review and publish your show.';
  }
  if (key === 'reading') {
    return 'Reading show details from your poster graphic.';
  }
  if (key === 'failed') {
    return targetJob.errorMessage || 'We could not finish reading this poster. Click Retry to try again.';
  }
  if (key === 'rejected') {
    return 'This upload was reviewed and not added to the concert calendar.';
  }
  return 'Saved and queued to read poster details.';
};

const getPublishedConcertIdForJob = (item: IngestionJobResponse) => {
  const fromCand = item.candidates?.find((c) => c.publishedConcertId)?.publishedConcertId;
  return fromCand || item.concertUpload?.concertId || null;
};

const getSubmissionTitle = (item: IngestionJobResponse) => {
  const candTitle = item.candidates?.[0]?.title;
  return candTitle || item.concertUpload?.originalFilename || 'Concert Poster';
};

const formatSummaryDate = (value?: string) => {
  if (!value) return 'Not provided';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return date.toLocaleDateString(undefined, {
      timeZone: 'UTC',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getSubmissionMeta = (item: IngestionJobResponse) => {
  const firstCand = item.candidates?.[0];
  const parts: string[] = [];
  if (firstCand?.venueName) {
    parts.push(firstCand.venueName);
  } else if (item.concertUpload?.city) {
    parts.push([item.concertUpload.city, item.concertUpload.state].filter(Boolean).join(', '));
  }
  if (firstCand?.date) {
    parts.push(formatSummaryDate(firstCand.date));
  }
  if (item.candidates && item.candidates.length > 1) {
    parts.push(`${item.candidates.length} shows found on poster`);
  }
  return parts.join(' · ') || 'Submitted poster graphic';
};

const loadSubmissions = async () => {
  if (!user.value || typeof fetchMyIngestionSubmissions !== 'function') {
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const token = await user.value.getIdToken();
    const list = await fetchMyIngestionSubmissions(token);
    submissions.value = Array.isArray(list) ? list : [];
    checkAndPollInFlightJobs();
  } catch {
    error.value = 'Unable to load your submissions right now.';
  } finally {
    loading.value = false;
  }
};

const checkAndPollInFlightJobs = () => {
  const hasInFlight = submissions.value.some((item) =>
    IN_FLIGHT_JOB_STATUSES.includes(item.status),
  );
  if (hasInFlight && !pollingTimer) {
    pollingTimer = setInterval(pollInFlightSubmissions, 1000);
  } else if (!hasInFlight && pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
};

const pollInFlightSubmissions = async () => {
  if (!user.value) return;
  const inFlightItems = submissions.value.filter((item) =>
    IN_FLIGHT_JOB_STATUSES.includes(item.status),
  );
  if (inFlightItems.length === 0) {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
    return;
  }

  try {
    const token = await user.value.getIdToken();
    for (const item of inFlightItems) {
      const updated = await fetchIngestionJob(token, item.id);
      if (updated) {
        const idx = submissions.value.findIndex((s) => s.id === item.id);
        if (idx !== -1) {
          submissions.value[idx] = updated;
        }
      }
    }
  } catch {
    // ignore background polling errors
  }
};

const pollJobStatusUntilComplete = async (targetJobId: string) => {
  if (!user.value) return;
  const token = await user.value.getIdToken();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const updated = await fetchIngestionJob(token, targetJobId);
      if (updated) {
        const idx = submissions.value.findIndex((s) => s.id === targetJobId);
        if (idx !== -1) {
          submissions.value[idx] = updated;
        }
        if (!IN_FLIGHT_JOB_STATUSES.includes(updated.status)) {
          return;
        }
      }
    } catch {
      // ignore transient poll error
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }
};

const handleRetry = async (item: IngestionJobResponse) => {
  const uploadId = item.concertUpload?.id;
  if (!user.value || !uploadId || retryingJobId.value === item.id) return;
  retryingJobId.value = item.id;
  try {
    const token = await user.value.getIdToken();
    const newJob = await createIngestionJob(token, uploadId);
    const idx = submissions.value.findIndex((s) => s.id === item.id);
    if (idx !== -1) {
      submissions.value[idx] = newJob;
    }
    await pollJobStatusUntilComplete(newJob.id);
    await loadSubmissions();
  } catch {
    error.value = 'Failed to retry poster reading.';
  } finally {
    retryingJobId.value = null;
  }
};

watch(
  user,
  (nextUser) => {
    if (nextUser) {
      void loadSubmissions();
    } else {
      submissions.value = [];
    }
  },
  { immediate: true },
);

onMounted(() => {
  void loadSubmissions();
});

onBeforeUnmount(() => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
});
</script>

<style scoped>
.my-submissions-page {
  display: grid;
  gap: 1.5rem;
}

.my-submissions-page__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.my-submissions-page__title {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 800;
  color: var(--text-dark, #1e293b);
}

.my-submissions-page__subtitle {
  margin: 0.25rem 0 0;
  font-size: 0.92rem;
  color: var(--text-light, #64748b);
}

.my-submissions-page__refresh {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg, #fff);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.my-submissions-page__state {
  padding: 2rem;
  text-align: center;
  color: var(--text-light);
  border: 1px dashed var(--border);
  border-radius: 1rem;
  background: var(--card-bg);
}

.my-submissions-page__state--error {
  color: #b42318;
}

.my-submissions-page__empty {
  padding: 3rem 1.5rem;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  background: var(--card-bg);
  display: grid;
  gap: 0.75rem;
  justify-items: center;
}

.my-submissions-page__empty h3 {
  margin: 0;
  font-size: 1.25rem;
}

.my-submissions-page__empty p {
  margin: 0;
  color: var(--text-light);
  max-width: 28rem;
}

.my-submissions-page__upload-link {
  margin-top: 0.5rem;
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.2rem;
  border-radius: 999px;
  background: var(--primary, #f05537);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}

.my-submissions-page__list {
  display: grid;
  gap: 1rem;
}

.submission-card {
  padding: 1.15rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--card-bg, #fff);
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.submission-card__main {
  display: grid;
  gap: 0.35rem;
  flex: 1;
  min-width: 260px;
}

.submission-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.submission-card__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.submission-card__meta,
.submission-card__next {
  margin: 0;
  font-size: 0.88rem;
  color: var(--text-light);
}

.submission-card__candidates {
  margin-top: 0.5rem;
  display: grid;
  gap: 0.4rem;
}

.submission-cand-row {
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: var(--background, #f8fafc);
  font-size: 0.85rem;
}

.submission-cand-row__venue {
  display: block;
  color: var(--text-light);
  font-size: 0.8rem;
}

.submission-card__actions {
  display: flex;
  align-items: center;
}

.submission-card__link--published {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  background: #ecfdf3;
  color: #027a48;
  font-size: 0.85rem;
  font-weight: 700;
  text-decoration: none;
}

.submission-card__retry-btn {
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text-dark);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.ingestion-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
}

.ingestion-status-pill--published {
  background: #ecfdf3;
  color: #027a48;
}

.ingestion-status-pill--awaiting_review {
  background: #eff6ff;
  color: #1d4ed8;
}

.ingestion-status-pill--reading,
.ingestion-status-pill--submitted {
  background: #fef9c3;
  color: #854d0e;
}

.ingestion-status-pill--failed,
.ingestion-status-pill--rejected {
  background: #fef2f2;
  color: #b91c1c;
}
</style>