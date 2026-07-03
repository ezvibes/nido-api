<template>
  <section class="admin-uploads">
    <header class="admin-uploads__header">
      <div>
        <h2 class="admin-uploads__title">Ingestion uploads</h2>
        <p class="admin-uploads__subtitle">
          Review uploaded images and mark them approved or rejected. <span v-if="total">({{ total }} total)</span>
        </p>
      </div>
      <div class="admin-uploads__controls">
        <label class="admin-uploads__control">
          <span>Status</span>
          <select v-model="statusFilter">
            <option value="all">All</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="past">Past</option>
          </select>
        </label>
        <button type="button" class="admin-uploads__refresh" :disabled="loading" @click="load">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <p v-if="error" class="admin-uploads__message admin-uploads__message--error">{{ error }}</p>
    <p v-else-if="!loading && uploads.length === 0" class="admin-uploads__message">
      No uploads found.
    </p>

    <div v-if="uploads.length" class="admin-uploads__card">
      <div class="admin-uploads__table-header">
        <span>Uploaded</span>
        <span>File</span>
        <span>Location</span>
        <span>Uploader</span>
        <span>Status</span>
      </div>
      <div class="admin-uploads__rows">
        <button
          v-for="upload in uploads"
          :key="upload.id"
          type="button"
          class="admin-uploads__row"
          @click="openPreview(upload)"
        >
          <span class="admin-uploads__cell admin-uploads__cell--mono">{{ formatDate(upload.createdAt) }}</span>
          <span class="admin-uploads__cell">
            <span class="admin-uploads__filename" :title="upload.originalFilename">{{ upload.originalFilename }}</span>
            <span class="admin-uploads__filesize">{{ formatBytes(upload.size) }}</span>
          </span>
          <span class="admin-uploads__cell">{{ formatLocation(upload.city, upload.state) }}</span>
          <span class="admin-uploads__cell admin-uploads__cell--muted admin-uploads__cell--truncate">
            {{ upload.uploadedByUserEmail ?? upload.uploadedByUid }}
          </span>
          <span class="admin-uploads__cell">
            <span class="status-chip" :class="`status-chip--${upload.reviewStatus}`">
              {{ formatStatus(upload.reviewStatus) }}
            </span>
          </span>
        </button>
      </div>
    </div>

    <div v-if="previewOpen" class="admin-uploads__modal" role="dialog" aria-modal="true">
      <div class="admin-uploads__modal-backdrop" @click="closePreview"></div>
      <div class="admin-uploads__modal-card">
        <header class="admin-uploads__modal-header">
          <div class="admin-uploads__modal-title">
            <h3>{{ previewUpload?.originalFilename }}</h3>
            <p class="admin-uploads__modal-subtitle">
              {{ formatLocation(previewUpload?.city, previewUpload?.state) }} ·
              {{ previewUpload?.uploadedByUserEmail ?? previewUpload?.uploadedByUid }}
            </p>
          </div>
          <button type="button" class="admin-uploads__modal-close" @click="closePreview">Close</button>
        </header>

        <div class="admin-uploads__modal-body">
          <div class="admin-uploads__preview">
            <div v-if="previewLoading" class="admin-uploads__preview-loading">Loading image…</div>
            <div v-else-if="previewError" class="admin-uploads__preview-error">{{ previewError }}</div>
            <img v-else :src="previewUrl" class="admin-uploads__preview-image" alt="Uploaded flyer preview" />
          </div>

          <div class="admin-uploads__review">
            <div class="admin-uploads__details">
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Uploaded</span>
                <strong>{{ previewUpload ? formatDate(previewUpload.createdAt) : '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Uploader</span>
                <strong>{{ previewUpload?.uploadedByUserEmail ?? previewUpload?.uploadedByUid ?? '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Location</span>
                <strong>{{ previewUpload ? formatLocation(previewUpload.city, previewUpload.state) : '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">File size</span>
                <strong>{{ previewUpload ? formatBytes(previewUpload.size) : '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Source</span>
                <strong>{{ previewUpload?.source ?? '—' }}</strong>
              </div>
              <div class="admin-uploads__detail">
                <span class="admin-uploads__detail-label">Storage path</span>
                <strong class="admin-uploads__detail-value admin-uploads__detail-value--storage" :title="previewUpload?.storageUri">
                  {{ previewUpload ? formatStorageUri(previewUpload.storageUri) : '—' }}
                </strong>
              </div>
            </div>
            <div class="admin-uploads__decision-panel">
              <div class="admin-uploads__decision-header">
                <span class="admin-uploads__detail-label">Review decision</span>
                <span class="status-chip" :class="`status-chip--${reviewStatusDraft}`">
                  {{ formatStatus(reviewStatusDraft) }}
                </span>
              </div>
              <div class="admin-uploads__decision-actions">
                <button
                  type="button"
                  class="admin-uploads__decision admin-uploads__decision--approve"
                  :disabled="!previewUpload || savingId === previewUpload.id"
                  @click="setDraftStatus('approved')"
                >
                  Approve
                </button>
                <button
                  type="button"
                  class="admin-uploads__decision admin-uploads__decision--reject"
                  :disabled="!previewUpload || savingId === previewUpload.id"
                  @click="setDraftStatus('rejected')"
                >
                  Reject
                </button>
                <button
                  type="button"
                  class="admin-uploads__decision"
                  :disabled="!previewUpload || savingId === previewUpload.id"
                  @click="setDraftStatus('past')"
                >
                  Mark past
                </button>
              </div>
            </div>
            <details class="admin-uploads__advanced">
              <summary class="admin-uploads__advanced-summary">Advanced status override</summary>
              <label class="admin-uploads__control admin-uploads__control--stack admin-uploads__control--compact">
                <span>Override status</span>
                <select v-model="reviewStatusDraft">
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="past">Past</option>
                </select>
              </label>
            </details>
            <div v-if="reviewStatusDraft === 'approved'" class="admin-uploads__publish-panel">
              <div class="admin-uploads__publish-grid">
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Concert title</span>
                  <input v-model="concertTitleDraft" type="text" placeholder="Doctor S at The Pour House" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Genre</span>
                  <input v-model="concertGenreDraft" type="text" placeholder="Live Music" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Date</span>
                  <input v-model="concertDateDraft" type="date" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Time</span>
                  <input v-model="concertTimeDraft" type="time" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Venue</span>
                  <input v-model="concertVenueNameDraft" type="text" placeholder="Venue TBD" />
                </label>
                <label class="admin-uploads__control admin-uploads__control--stack">
                  <span>Artist / lineup</span>
                  <input v-model="concertArtistNameDraft" type="text" placeholder="Artist or lineup" />
                </label>
              </div>
              <label class="admin-uploads__control admin-uploads__control--stack">
                <span>Public description</span>
                <textarea v-model="concertDescriptionDraft" rows="3" placeholder="Short public note for the event card"></textarea>
              </label>
            </div>
            <label class="admin-uploads__control admin-uploads__control--stack">
              <span>Notes</span>
              <textarea v-model="reviewNotesDraft" rows="3" placeholder="Optional notes for the team"></textarea>
            </label>
            <p
              v-if="reviewMessage"
              :class="[
                'admin-uploads__review-message',
                reviewMessageType === 'success'
                  ? 'admin-uploads__review-message--success'
                  : 'admin-uploads__review-message--error',
              ]"
            >
              {{ reviewMessage }}
            </p>
            <div class="admin-uploads__review-actions">
              <button
                type="button"
                class="admin-uploads__primary"
                :disabled="isSaveDisabled"
                @click="saveReview"
              >
                {{ saveButtonLabel }}
              </button>
              <button type="button" class="admin-uploads__secondary" @click="closePreview">Done</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  fetchAdminIngestionUploadImageBlob,
  fetchAdminIngestionUploads,
  reviewAdminIngestionUpload,
  type AdminConcertUploadListItem,
  type UploadReviewStatus,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';

type StatusFilter = 'all' | UploadReviewStatus;

const { user } = useAuth();

const uploads = ref<AdminConcertUploadListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const savingId = ref<string>('');

const statusFilter = ref<StatusFilter>('all');

const previewOpen = ref(false);
const previewUpload = ref<AdminConcertUploadListItem | null>(null);
const previewUrl = ref('');
const previewLoading = ref(false);
const previewError = ref('');
const reviewStatusDraft = ref<UploadReviewStatus>('submitted');
const reviewNotesDraft = ref('');
const reviewMessage = ref('');
const reviewMessageType = ref<'success' | 'error'>('success');
const concertTitleDraft = ref('');
const concertGenreDraft = ref('Live Music');
const concertDateDraft = ref('');
const concertTimeDraft = ref('19:00');
const concertVenueNameDraft = ref('');
const concertArtistNameDraft = ref('');
const concertDescriptionDraft = ref('');

const limit = 25;
const offset = ref(0);

const getToken = async () => {
  const current = user.value;
  if (!current) {
    throw new Error('You must be signed in.');
  }
  return current.getIdToken();
};

const load = async () => {
  error.value = '';
  loading.value = true;
  try {
    const token = await getToken();
    const reviewStatus = statusFilter.value === 'all' ? undefined : statusFilter.value;
    const result = await fetchAdminIngestionUploads(token, {
      limit,
      offset: offset.value,
      reviewStatus,
    });
    uploads.value = result.items;
    total.value = result.total;
  } catch (err: any) {
    error.value = err?.message ?? 'Failed to load uploads.';
  } finally {
    loading.value = false;
  }
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString();
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
};

const formatLocation = (city?: string, state?: string) =>
  [city, state].filter(Boolean).join(', ') || '—';

const formatStatus = (value: UploadReviewStatus) =>
  value.replace(/_/g, ' ');

const defaultTitleFromFilename = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatStorageUri = (value: string) => {
  if (value.length <= 72) {
    return value;
  }

  const start = value.slice(0, 36);
  const end = value.slice(-24);
  return `${start}…${end}`;
};

const revokePreviewUrl = () => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = '';
  }
};

const openPreview = async (upload: AdminConcertUploadListItem) => {
  previewOpen.value = true;
  previewUpload.value = upload;
  previewError.value = '';
  reviewMessage.value = '';
  previewLoading.value = true;
  revokePreviewUrl();

  reviewStatusDraft.value = upload.reviewStatus;
  reviewNotesDraft.value = upload.reviewNotes ?? '';
  concertTitleDraft.value = defaultTitleFromFilename(upload.originalFilename);
  concertGenreDraft.value = 'Live Music';
  concertDateDraft.value = '';
  concertTimeDraft.value = '19:00';
  concertVenueNameDraft.value = '';
  concertArtistNameDraft.value = concertTitleDraft.value;
  concertDescriptionDraft.value = '';

  try {
    const token = await getToken();
    const blob = await fetchAdminIngestionUploadImageBlob(token, upload.id);
    previewUrl.value = URL.createObjectURL(blob);
  } catch (err: any) {
    previewError.value = err?.message ?? 'Failed to load preview.';
  } finally {
    previewLoading.value = false;
  }
};

const closePreview = () => {
  previewOpen.value = false;
  previewUpload.value = null;
  previewError.value = '';
  reviewMessage.value = '';
  previewLoading.value = false;
  revokePreviewUrl();
};

const patchLocalUpload = (updated: AdminConcertUploadListItem) => {
  uploads.value = uploads.value.map((item) => (item.id === updated.id ? updated : item));
  if (previewUpload.value?.id === updated.id) {
    previewUpload.value = updated;
    reviewStatusDraft.value = updated.reviewStatus;
    reviewNotesDraft.value = updated.reviewNotes ?? '';
  }
};

const setDraftStatus = (status: UploadReviewStatus) => {
  reviewStatusDraft.value = status;
  reviewMessage.value = '';
};

const buildConcertStartsAt = () => {
  if (!concertDateDraft.value || !concertTimeDraft.value) {
    return undefined;
  }

  return new Date(`${concertDateDraft.value}T${concertTimeDraft.value}`).toISOString();
};

const isSaveDisabled = computed(
  () =>
    !previewUpload.value ||
    savingId.value === previewUpload.value.id ||
    (reviewStatusDraft.value === 'approved' &&
      (!concertTitleDraft.value.trim() || !concertDateDraft.value || !concertTimeDraft.value)),
);

const saveButtonLabel = computed(() => {
  if (savingId.value === previewUpload.value?.id) {
    return 'Saving...';
  }

  if (reviewStatusDraft.value === 'approved') {
    return 'Approve and publish';
  }

  if (reviewStatusDraft.value === 'rejected') {
    return 'Save rejection';
  }

  if (reviewStatusDraft.value === 'past') {
    return 'Mark past';
  }

  return 'Save review';
});

const saveReview = async () => {
  const upload = previewUpload.value;
  if (!upload) return;

  savingId.value = upload.id;
  previewError.value = '';
  reviewMessage.value = '';
  try {
    const token = await getToken();
    const updated = await reviewAdminIngestionUpload(token, upload.id, {
      status: reviewStatusDraft.value,
      notes: reviewNotesDraft.value || undefined,
      concertTitle:
        reviewStatusDraft.value === 'approved'
          ? concertTitleDraft.value.trim()
          : undefined,
      concertGenre:
        reviewStatusDraft.value === 'approved'
          ? concertGenreDraft.value.trim() || 'Live Music'
          : undefined,
      concertStartsAt:
        reviewStatusDraft.value === 'approved'
          ? buildConcertStartsAt()
          : undefined,
      concertVenueName:
        reviewStatusDraft.value === 'approved'
          ? concertVenueNameDraft.value.trim() || undefined
          : undefined,
      concertArtistName:
        reviewStatusDraft.value === 'approved'
          ? concertArtistNameDraft.value.trim() || concertTitleDraft.value.trim()
          : undefined,
      concertDescription:
        reviewStatusDraft.value === 'approved'
          ? concertDescriptionDraft.value.trim() || undefined
          : undefined,
    });
    patchLocalUpload(updated);
    void load();
    reviewMessageType.value = 'success';
    reviewMessage.value =
      updated.reviewStatus === 'approved'
        ? 'Approved and published to the events feed.'
        : 'Review saved.';
    if (updated.reviewStatus === 'approved') {
      window.dispatchEvent(new CustomEvent('concerts:changed'));
      closePreview();
    }
  } catch (err: any) {
    reviewMessageType.value = 'error';
    reviewMessage.value = err?.message ?? 'Failed to save review.';
  } finally {
    savingId.value = '';
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && previewOpen.value) {
    closePreview();
  }
};

watch(statusFilter, () => {
  offset.value = 0;
  void load();
});

watch(offset, () => {
  void load();
});

onMounted(() => {
  void load();
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  revokePreviewUrl();
});
</script>

<style scoped>
.admin-uploads {
  padding: 1.5rem 0 2rem;
}

.admin-uploads__header {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.admin-uploads__title {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}

.admin-uploads__subtitle {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
}

.admin-uploads__controls {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.admin-uploads__control {
  display: grid;
  gap: 0.25rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.admin-uploads__control input,
.admin-uploads__control select,
.admin-uploads__control textarea {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.55rem 0.75rem;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  min-width: 180px;
}

.admin-uploads__control input {
  min-width: 0;
}

.admin-uploads__control textarea {
  resize: vertical;
}

.admin-uploads__control input[type='date'],
.admin-uploads__control input[type='time'] {
  min-width: 0;
}

.admin-uploads__control--stack input,
.admin-uploads__control--stack select,
.admin-uploads__control--stack textarea {
  min-width: 0;
  width: 100%;
}

.admin-uploads__control--compact select {
  min-width: 0;
}

.admin-uploads__refresh {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.6rem 0.9rem;
  background: var(--surface);
  font-weight: 700;
  cursor: pointer;
}

.admin-uploads__refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.admin-uploads__message {
  margin: 1rem 0;
  color: var(--text-muted);
}

.admin-uploads__message--error {
  color: var(--accent);
}

.admin-uploads__card {
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: clip;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.admin-uploads__table-header,
.admin-uploads__row {
  display: grid;
  grid-template-columns: minmax(170px, 1.15fr) minmax(220px, 1.45fr) minmax(140px, 0.95fr) minmax(190px, 1.1fr) 120px;
  gap: 0.875rem;
  align-items: center;
  padding: 0.9rem 1.25rem;
}

.admin-uploads__table-header {
  background: var(--surface-soft);
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.admin-uploads__row {
  appearance: none;
  width: 100%;
  border: 0;
  border-top: 1px solid var(--border);
  background: transparent;
  text-align: left;
  border-top: 1px solid var(--border);
  min-height: 88px;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.admin-uploads__row:hover {
  background: rgba(251, 251, 250, 0.9);
}

.admin-uploads__row:focus-visible {
  outline: 2px solid rgba(53, 211, 153, 0.35);
  outline-offset: -2px;
}

.admin-uploads__cell {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.admin-uploads__cell--mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.85rem;
  line-height: 1.35;
}

.admin-uploads__cell--muted {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.admin-uploads__cell--truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-uploads__filename {
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-uploads__filesize {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: capitalize;
  border: 1px solid transparent;
  width: fit-content;
}

.status-chip--submitted {
  background: rgba(95, 107, 118, 0.12);
  border-color: rgba(95, 107, 118, 0.2);
  color: var(--text-muted);
}

.status-chip--approved {
  background: rgba(53, 211, 153, 0.14);
  border-color: rgba(53, 211, 153, 0.2);
  color: #0f5d45;
}

.status-chip--rejected {
  background: rgba(240, 85, 55, 0.12);
  border-color: rgba(240, 85, 55, 0.2);
  color: var(--accent);
}

.status-chip--past {
  background: rgba(31, 41, 51, 0.08);
  border-color: rgba(31, 41, 51, 0.14);
  color: #34404c;
}

.admin-uploads__modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: clamp(0.5rem, 2vw, 1rem);
}

.admin-uploads__modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(31, 41, 51, 0.6);
}

.admin-uploads__modal-card {
  position: relative;
  width: min(1200px, 96vw);
  max-height: calc(100dvh - 2rem);
  background: var(--surface);
  border-radius: 18px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
}

.admin-uploads__modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.9rem 1.15rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}

.admin-uploads__modal-title h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.2;
}

.admin-uploads__modal-subtitle {
  margin: 0.18rem 0 0;
  font-size: 0.95rem;
  color: var(--text-muted);
}

.admin-uploads__modal-close {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 0.5rem 0.8rem;
  font-weight: 800;
  cursor: pointer;
}

.admin-uploads__modal-body {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(380px, 0.95fr);
  gap: 0.85rem;
  padding: 0.85rem 0.95rem 0.95rem;
  overflow: auto;
  align-items: stretch;
  min-height: 0;
}

.admin-uploads__preview {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-soft);
  display: grid;
  place-items: center;
  padding: 0.7rem;
  min-height: 0;
  height: fit-content;
  max-height: 100%;
  position: sticky;
  top: 0;
}

.admin-uploads__preview-image {
  max-width: 100%;
  max-height: min(64dvh, 640px);
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.admin-uploads__preview-loading,
.admin-uploads__preview-error {
  color: var(--text-muted);
  font-weight: 700;
}

.admin-uploads__preview-error {
  color: var(--accent);
}

.admin-uploads__review {
  display: grid;
  gap: 0.6rem;
  align-content: start;
  min-height: 0;
}

.admin-uploads__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem 0.8rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-soft);
}

.admin-uploads__detail {
  display: grid;
  gap: 0.2rem;
}

.admin-uploads__detail-label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.admin-uploads__detail strong {
  font-size: 0.88rem;
  line-height: 1.22;
}

.admin-uploads__detail-value {
  white-space: normal;
  overflow: hidden;
  word-break: break-word;
}

.admin-uploads__detail-value--storage {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.8rem;
}

.admin-uploads__decision-panel {
  display: grid;
  gap: 0.55rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.admin-uploads__decision-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.admin-uploads__decision-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
}

.admin-uploads__decision {
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  padding: 0.66rem 0.72rem;
  font-size: 0.88rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.admin-uploads__decision:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.admin-uploads__decision--approve {
  background: rgba(53, 211, 153, 0.14);
  border-color: rgba(53, 211, 153, 0.35);
  color: #0f5d45;
}

.admin-uploads__decision--reject {
  background: rgba(240, 85, 55, 0.12);
  border-color: rgba(240, 85, 55, 0.25);
  color: var(--accent);
}

.admin-uploads__publish-panel {
  display: grid;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-soft);
}

.admin-uploads__publish-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.admin-uploads__publish-panel .admin-uploads__control {
  gap: 0.35rem;
}

.admin-uploads__publish-panel .admin-uploads__control input,
.admin-uploads__publish-panel .admin-uploads__control textarea {
  min-height: 3rem;
}

.admin-uploads__publish-panel .admin-uploads__control textarea {
  min-height: 7rem;
}

.admin-uploads__review-message {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 700;
}

.admin-uploads__review-message--success {
  border: 1px solid rgba(43, 130, 79, 0.28);
  color: #21663f;
  background: rgba(43, 130, 79, 0.1);
}

.admin-uploads__review-message--error {
  border: 1px solid rgba(186, 64, 41, 0.28);
  color: var(--accent);
  background: rgba(186, 64, 41, 0.1);
}

.admin-uploads__review-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem;
  align-self: end;
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin: 0 -0.1rem -0.1rem;
  padding: 0.55rem 0.1rem 0.1rem;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0),
    var(--surface) 32%
  );
}

.admin-uploads__advanced {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.3rem 0.8rem 0.72rem;
  background: var(--surface);
}

.admin-uploads__advanced[open] {
  padding-top: 0.65rem;
}

.admin-uploads__advanced-summary {
  cursor: pointer;
  list-style: none;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--text-muted);
}

.admin-uploads__advanced-summary::-webkit-details-marker {
  display: none;
}

.admin-uploads__primary,
.admin-uploads__secondary {
  border-radius: 12px;
  padding: 0.66rem 0.9rem;
  font-weight: 900;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
}

.admin-uploads__primary {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.admin-uploads__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.admin-uploads__secondary {
  background: var(--surface);
}

@media (max-width: 980px) {
  .admin-uploads__table-header,
  .admin-uploads__row {
    grid-template-columns: 170px 1fr 120px;
    grid-auto-rows: auto;
  }

  .admin-uploads__table-header span:nth-child(n + 4),
  .admin-uploads__row span:nth-child(n + 4) {
    display: none;
  }

  .admin-uploads__modal-body {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .admin-uploads__preview {
    position: static;
    max-height: none;
  }

  .admin-uploads__preview-image {
    max-height: min(42dvh, 420px);
  }

  .admin-uploads__details {
    grid-template-columns: 1fr;
  }

  .admin-uploads__decision-actions {
    grid-template-columns: 1fr;
  }

  .admin-uploads__publish-grid {
    grid-template-columns: 1fr;
  }

  .admin-uploads__review-actions {
    grid-template-columns: 1fr;
  }
}
</style>
