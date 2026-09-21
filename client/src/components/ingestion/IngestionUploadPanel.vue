<template>
  <section class="ingestion-panel">
    <div class="ingestion-panel__header">
      <h2 class="ingestion-panel__title">Upload a concert poster</h2>
      <p class="ingestion-panel__subtitle">
        Drop your flyer below to add it to the local live music calendar
      </p>
    </div>

    <form class="ingestion-panel__form" @submit.prevent="handleSubmit">
      <div
        class="ingestion-panel__dropzone"
        :class="{
          'ingestion-panel__dropzone--active': isDragActive,
          'ingestion-panel__dropzone--filled': !!selectedFile,
        }"
        role="button"
        tabindex="0"
        aria-label="Choose flyer image or drag and drop one here"
        @click="openFilePicker"
        @keydown.enter.prevent="openFilePicker"
        @keydown.space.prevent="openFilePicker"
        @dragenter.prevent="isDragActive = true"
        @dragover.prevent="isDragActive = true"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <input
          ref="fileInput"
          class="ingestion-panel__file-input"
          type="file"
          :accept="acceptedFileTypes"
          @change="handleFileChange"
        />
        <div class="ingestion-panel__dropzone-copy">
          <p class="ingestion-panel__dropzone-eyebrow">Flyer image</p>
          <p class="ingestion-panel__dropzone-title">
            {{ selectedFile ? selectedFile.name : 'Choose a file or drag it here' }}
          </p>
          <p class="ingestion-panel__dropzone-subtitle">
            Supports JPG, PNG, WEBP, GIF, and HEIC up to 50 MB.
          </p>
        </div>
        <div class="ingestion-panel__dropzone-meta">
          <span v-if="selectedFile" class="ingestion-panel__file-pill">{{ formattedFileSize }}</span>
          <button type="button" class="ingestion-panel__file-button" @click.stop="openFilePicker">
            {{ selectedFile ? 'Replace image' : 'Choose file' }}
          </button>
        </div>
      </div>

      <div class="ingestion-panel__hints">
        <div class="ingestion-panel__hints-header">
          <p class="ingestion-panel__hints-title">Event Details</p>
          <p class="ingestion-panel__hints-subtitle">Provide known details to help our team match and publish the show faster.</p>
        </div>

        <div class="ingestion-panel__fields-grid">
          <label class="ingestion-panel__field">
            <span>Date</span>
            <input
              v-model="concertDate"
              type="date"
              aria-label="Concert date"
            />
          </label>

          <label class="ingestion-panel__field">
            <span>Venue</span>
            <select v-model="venueId" aria-label="Venue" @change="onVenueChange">
              <option value="">Select a venue (optional)</option>
              <option v-for="v in venues" :key="v.id" :value="v.id">
                {{ v.name }} ({{ v.city }}, {{ v.region || v.city }})
              </option>
            </select>
          </label>

          <div class="ingestion-panel__field ingestion-panel__genre-field">
            <GenreCombobox
              v-model="genre"
              :options="userGenreOptions"
              placeholder="Select a genre"
              :loading="genreLoadState === 'loading'"
              :allow-custom="false"
              :max-visible-options="25"
              :described-by="genreHelpMessage ? 'genre-help' : undefined"
            />
            <small
              v-if="genreHelpMessage"
              id="genre-help"
              class="ingestion-panel__field-help"
            >
              {{ genreHelpMessage }}
            </small>
          </div>

          <label class="ingestion-panel__field">
            <span>Band / Artist</span>
            <select v-model="bandId" aria-label="Band or artist">
              <option value="">Select an artist (optional)</option>
              <option v-for="b in bands" :key="b.id" :value="b.id">
                {{ b.name }}
              </option>
            </select>
          </label>

          <label class="ingestion-panel__field">
            <span>City</span>
            <input v-model="city" type="text" placeholder="Raleigh" />
          </label>

          <label class="ingestion-panel__field">
            <span>State</span>
            <input v-model="state" type="text" maxlength="2" placeholder="NC" />
          </label>
        </div>
      </div>

      <p v-if="message" :class="messageClass">{{ message }}</p>

      <div class="ingestion-panel__actions">
        <button type="submit" class="ingestion-panel__submit" :disabled="isSubmitDisabled">
          {{ isSubmitting ? 'Uploading…' : 'Upload flyer' }}
        </button>
      </div>
    </form>

    <div v-if="showProgress" class="ingestion-panel__progress" role="status" aria-live="polite">
      <div v-if="isJobLoading" class="ingestion-panel__spinner" aria-hidden="true"></div>
      <div>
        <p class="ingestion-panel__progress-title">{{ progressTitle }}</p>
        <p class="ingestion-panel__progress-copy">{{ progressCopy }}</p>
      </div>
    </div>

    <div v-if="uploadResult" class="ingestion-panel__summary">
      <p class="ingestion-panel__summary-title">Latest upload</p>
      <dl class="ingestion-panel__details">
        <div>
          <dt>Job</dt>
          <dd>{{ job?.id ?? 'Not started yet' }}</dd>
        </div>
        <div>
          <dt>Asset</dt>
          <dd>{{ uploadResult.originalFilename }}</dd>
        </div>
        <div>
          <dt>Date hint</dt>
          <dd>{{ formatSummaryDate(uploadResult.concertDate) }}</dd>
        </div>
        <div>
          <dt>Venue hint</dt>
          <dd>{{ selectedVenueName || uploadResult.venueId || 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Genre</dt>
          <dd>{{ uploadResult.genre ?? 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Band hint</dt>
          <dd>{{ selectedBandName || uploadResult.bandId || 'Not provided' }}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{{ uploadLocation }}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{{ currentStatus }}</dd>
        </div>
        <div>
          <dt>Stage</dt>
          <dd>{{ job?.stage ?? 'asset_uploaded' }}</dd>
        </div>
        <div>
          <dt>Stored at</dt>
          <dd>{{ uploadResult.storageUri }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { AxiosError } from 'axios';
import {
  createIngestionJob,
  fetchBands,
  fetchConcertGenres,
  fetchIngestionJob,
  fetchVenues,
  type BandListItem,
  type IngestionJobResponse,
  type IngestionUploadResult,
  type VenueListItem,
  uploadIngestionImage,
} from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';
import GenreCombobox from '../GenreCombobox.vue';

const { user } = useAuth();

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const acceptedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/avif',
];

const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isDragActive = ref(false);
const concertDate = ref('');
const venueId = ref('');
const bandId = ref('');
const city = ref('');
const state = ref('NC');
const genre = ref('');
const genres = ref<string[]>([]);
const venues = ref<VenueListItem[]>([]);
const bands = ref<BandListItem[]>([]);
const genreLoadState = ref<'loading' | 'loaded' | 'empty' | 'failed'>('loading');
const message = ref('');
const messageType = ref<'success' | 'error'>('success');
const isSubmitting = ref(false);
const uploadResult = ref<IngestionUploadResult | null>(null);
const job = ref<IngestionJobResponse | null>(null);

const jobId = computed(() => job.value?.id ?? '');
const currentStatus = computed(() => job.value?.status ?? 'not_started');
const isJobLoading = computed(() => isSubmitting.value || ['queued', 'processing'].includes(currentStatus.value));
const showProgress = computed(() => isSubmitting.value || !!uploadResult.value || !!job.value);
const progressTitle = computed(() => {
  if (isSubmitting.value) {
    return 'Uploading flyer...';
  }
  if (currentStatus.value === 'needs_review') {
    return 'Ready for review';
  }
  if (currentStatus.value === 'failed') {
    return 'Ingestion failed';
  }
  return 'Processing upload...';
});
const progressCopy = computed(() => {
  if (isSubmitting.value) {
    return 'Saving the image and creating an ingestion job.';
  }
  if (currentStatus.value === 'needs_review') {
    return 'The image is stored and the Phase 1 job is queued for review.';
  }
  if (currentStatus.value === 'failed') {
    return job.value?.errorMessage ?? 'The ingestion job failed.';
  }
  return `Current status: ${currentStatus.value}`;
});
const uploadLocation = computed(() =>
  [uploadResult.value?.city, uploadResult.value?.state].filter(Boolean).join(', ') || 'Not provided',
);
const userGenreOptions = computed(() => [
  ...genres.value.filter(
    (option) => option.trim().toLocaleLowerCase() !== 'other',
  ),
  'Other',
]);
const genreHelpMessage = computed(() => {
  if (genreLoadState.value === 'loading') {
    return 'Loading current genres…';
  }
  if (genreLoadState.value === 'failed') {
    return 'Genres are unavailable right now. You can still upload without one.';
  }
  if (genreLoadState.value === 'empty') {
    return 'No genres are available yet. You can still upload without one.';
  }
  return '';
});
const acceptedFileTypes = acceptedMimeTypes.join(',');
const formattedFileSize = computed(() => {
  if (!selectedFile.value) {
    return '';
  }

  const fileSizeMb = selectedFile.value.size / (1024 * 1024);
  return `${fileSizeMb.toFixed(fileSizeMb >= 10 ? 0 : 1)} MB`;
});
const isDev = import.meta.env.DEV;
const isSubmitDisabled = computed(
  () => (!user.value && !isDev) || !selectedFile.value || isSubmitting.value,
);
const messageClass = computed(() =>
  messageType.value === 'success'
    ? 'ingestion-panel__message ingestion-panel__message--success'
    : 'ingestion-panel__message ingestion-panel__message--error',
);

const loadGenres = async () => {
  try {
    const response = await fetchConcertGenres();
    genres.value = response.genres;
    genreLoadState.value = genres.value.length ? 'loaded' : 'empty';
  } catch {
    if (isDev && import.meta.env.MODE !== 'test') {
      genres.value = [
        'Electronic',
        'Rock',
        'Indie Rock',
        'Jazz',
        'Hip-Hop',
        'Folk',
        'Metal',
        'Soul',
      ];
      genreLoadState.value = 'loaded';
    } else {
      genres.value = [];
      genreLoadState.value = 'failed';
    }
  }
};

const loadVenues = async () => {
  if (typeof fetchVenues !== 'function') return;
  try {
    const response = await fetchVenues();
    venues.value = Array.isArray(response) ? response : [];
  } catch {
    venues.value = [];
  }
  if (isDev && import.meta.env.MODE !== 'test' && venues.value.length === 0) {
    venues.value = [
      {
        id: 'v-1',
        name: 'The Pour House Music Hall',
        city: 'Raleigh',
        citySlug: 'raleigh',
        region: 'NC',
        regionSlug: 'nc',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v-2',
        name: "Cat's Cradle",
        city: 'Carrboro',
        citySlug: 'carrboro',
        region: 'NC',
        regionSlug: 'nc',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v-3',
        name: 'Lincoln Theatre',
        city: 'Raleigh',
        citySlug: 'raleigh',
        region: 'NC',
        regionSlug: 'nc',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'v-4',
        name: 'The Orange Peel',
        city: 'Asheville',
        citySlug: 'asheville',
        region: 'NC',
        regionSlug: 'nc',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
  }
};

const loadBands = async () => {
  if (typeof fetchBands !== 'function') return;
  try {
    const response = await fetchBands();
    bands.value = Array.isArray(response) ? response : [];
  } catch {
    bands.value = [];
  }
  if (isDev && import.meta.env.MODE !== 'test' && bands.value.length === 0) {
    bands.value = [
      { id: 'b-1', name: 'Doctor S', slug: 'doctor-s', genres: ['Rock'] },
      { id: 'b-2', name: 'Archers of Loaf', slug: 'archers-of-loaf', genres: ['Indie Rock'] },
      { id: 'b-3', name: 'Sylvan Esso', slug: 'sylvan-esso', genres: ['Electronic'] },
      { id: 'b-4', name: 'Wednesday', slug: 'wednesday', genres: ['Indie Rock'] },
    ];
  }
};

const onVenueChange = () => {
  const matched = venues.value.find((v) => v.id === venueId.value);
  if (matched) {
    if (!city.value.trim() && matched.city) {
      city.value = matched.city;
    }
    if (matched.region) {
      state.value = matched.region;
    }
  }
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

const selectedVenueName = computed(() => {
  const currentVenueId = uploadResult.value?.venueId || venueId.value;
  if (!currentVenueId) return '';
  const v = venues.value.find((item) => item.id === currentVenueId);
  return v ? `${v.name} (${v.city}, ${v.region || v.city})` : (uploadResult.value?.venueId ? 'Selected venue' : '');
});

const selectedBandName = computed(() => {
  const currentBandId = uploadResult.value?.bandId || bandId.value;
  if (!currentBandId) return '';
  const b = bands.value.find((item) => item.id === currentBandId);
  return b ? b.name : (uploadResult.value?.bandId ? 'Selected band' : '');
});

onMounted(() => {
  void loadGenres();
  void loadVenues();
  void loadBands();
});

const resetFileInput = () => {
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const setErrorMessage = (value: string) => {
  messageType.value = 'error';
  message.value = value;
};

const validateFile = (file: File | null) => {
  if (!file) {
    return null;
  }

  if (!acceptedMimeTypes.includes(file.type)) {
    setErrorMessage('Please upload a standard image file such as JPG, PNG, WEBP, GIF, TIFF, BMP, HEIC, or AVIF.');
    resetFileInput();
    return null;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    setErrorMessage('Image size must be 50 MB or smaller.');
    resetFileInput();
    return null;
  }

  message.value = '';
  return file;
};

const setSelectedFile = (file: File | null) => {
  selectedFile.value = validateFile(file);
};

const openFilePicker = () => {
  fileInput.value?.click();
};

const handleFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  setSelectedFile(input.files?.[0] ?? null);
};

const handleDragLeave = (event: DragEvent) => {
  const nextTarget = event.relatedTarget as Node | null;
  if (nextTarget && (event.currentTarget as HTMLElement).contains(nextTarget)) {
    return;
  }

  isDragActive.value = false;
};

const handleDrop = (event: DragEvent) => {
  isDragActive.value = false;
  setSelectedFile(event.dataTransfer?.files?.[0] ?? null);
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AxiosError) {
    return error.response?.data?.message ?? 'Upload failed.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Upload failed.';
};

const refreshJob = async () => {
  if (!user.value || !jobId.value) {
    return;
  }

  try {
    const token = await user.value.getIdToken();
    job.value = await fetchIngestionJob(token, jobId.value);
  } catch (error) {
    messageType.value = 'error';
    message.value = getErrorMessage(error);
  }
};

const pollJobStatus = async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await refreshJob();
    if (job.value && !['queued', 'processing'].includes(job.value.status)) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }
};

const handleSubmit = async () => {
  if (!selectedFile.value || isSubmitDisabled.value) {
    return;
  }

  if (!user.value) {
    if (isDev) {
      isSubmitting.value = true;
      window.setTimeout(() => {
        uploadResult.value = {
          concertUploadId: 'preview-upload-123',
          bucket: 'preview-bucket',
          objectName: selectedFile.value!.name,
          storageUri: `gs://preview-bucket/${selectedFile.value!.name}`,
          contentType: selectedFile.value!.type || 'image/jpeg',
          size: selectedFile.value!.size,
          originalFilename: selectedFile.value!.name,
          city: city.value.trim() || undefined,
          state: state.value.trim() || undefined,
          genre: genre.value || undefined,
          concertDate: concertDate.value
            ? new Date(`${concertDate.value}T00:00:00Z`).toISOString()
            : undefined,
          venueId: venueId.value || undefined,
          bandId: bandId.value || undefined,
          source: 'flyer_upload',
          uploadedAt: new Date().toISOString(),
        };
        messageType.value = 'success';
        message.value = 'Local preview: Flyer simulated upload complete! See details below.';
        isSubmitting.value = false;
      }, 400);
    }
    return;
  }

  isSubmitting.value = true;
  message.value = '';
  job.value = null;

  try {
    const token = await user.value.getIdToken();
    uploadResult.value = await uploadIngestionImage(token, {
      file: selectedFile.value,
      city: city.value.trim() || undefined,
      state: state.value.trim().toUpperCase() || undefined,
      ...(genre.value ? { genre: genre.value } : {}),
      concertDate: concertDate.value
        ? new Date(`${concertDate.value}T00:00:00Z`).toISOString()
        : undefined,
      venueId: venueId.value || undefined,
      bandId: bandId.value || undefined,
      source: 'flyer_upload',
    });
    job.value = await createIngestionJob(token, uploadResult.value.concertUploadId);
    messageType.value = 'success';
    message.value = 'Flyer uploaded and ingestion job started.';
    await pollJobStatus();
  } catch (error) {
    messageType.value = 'error';
    message.value = getErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.ingestion-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--card-bg);
}

.ingestion-panel__header h2,
.ingestion-panel__header p,
.ingestion-panel__summary-title,
.ingestion-panel__details dt,
.ingestion-panel__details dd {
  margin: 0;
}

.ingestion-panel__header {
  display: grid;
  gap: 0.35rem;
  justify-items: center;
  text-align: center;
  padding: 0.25rem 0 0.25rem;
}

.ingestion-panel__title {
  font-size: 1.55rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--text-dark, #1e293b);
  margin: 0;
  line-height: 1.25;
}

.ingestion-panel__subtitle {
  font-size: 0.92rem;
  color: var(--text-light, #64748b);
  max-width: 32rem;
  margin: 0;
  line-height: 1.45;
}

.ingestion-panel__form {
  display: grid;
  gap: 0.9rem;
  justify-items: center;
}

.ingestion-panel__hints {
  width: min(100%, 34rem);
  box-sizing: border-box;
  padding: 1.15rem;
  border-radius: 1.25rem;
  border: 1px solid var(--border);
  background: var(--background);
  display: grid;
  gap: 0.85rem;
  text-align: left;
}

.ingestion-panel__hints-header {
  display: grid;
  gap: 0.25rem;
}

.ingestion-panel__hints-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-dark);
  margin: 0;
}

.ingestion-panel__hints-subtitle {
  font-size: 0.82rem;
  color: var(--text-light);
  margin: 0;
}

.ingestion-panel__fields-grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: 1fr;
}

.ingestion-panel__field {
  display: grid;
  gap: 0.35rem;
  text-align: left !important;
  width: 100% !important;
}

.ingestion-panel__field span,
.ingestion-panel__genre-field :deep(.genre-combobox__label) {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-dark);
}

.ingestion-panel__genre-field {
  width: 100% !important;
}

.ingestion-panel__dropzone {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  width: min(100%, 34rem);
  box-sizing: border-box;
  padding: 1.15rem;
  border: 1px dashed rgba(240, 85, 55, 0.28);
  border-radius: 1.25rem;
  background:
    linear-gradient(135deg, rgba(53, 211, 153, 0.08), rgba(240, 85, 55, 0.08)),
    var(--card-bg);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease;
}

.ingestion-panel__dropzone:hover,
.ingestion-panel__dropzone:focus-visible,
.ingestion-panel__dropzone--active {
  border-color: rgba(240, 85, 55, 0.65);
  box-shadow:
    0 16px 40px rgba(31, 41, 51, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.7);
  transform: translateY(-1px);
}

.ingestion-panel__dropzone--filled {
  border-style: solid;
}

.ingestion-panel__file-input {
  display: none;
}

.ingestion-panel__dropzone-copy,
.ingestion-panel__dropzone-meta {
  display: grid;
  gap: 0.35rem;
  text-align: left;
}

.ingestion-panel__dropzone-eyebrow,
.ingestion-panel__dropzone-title,
.ingestion-panel__dropzone-subtitle {
  margin: 0;
}

.ingestion-panel__dropzone-eyebrow {
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ingestion-panel__dropzone-title {
  color: var(--text-dark);
  font-size: 1rem;
  font-weight: 700;
}

.ingestion-panel__dropzone-subtitle {
  color: var(--text-light);
  font-size: 0.92rem;
  line-height: 1.45;
}

.ingestion-panel__dropzone-meta {
  align-items: center;
}

.ingestion-panel__file-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 2rem;
  padding: 0.2rem 0.75rem;
  border-radius: 999px;
  background: rgba(53, 211, 153, 0.12);
  color: #0f766e;
  font-size: 0.82rem;
  font-weight: 700;
}

.ingestion-panel__file-button {
  width: fit-content;
  min-height: 2.75rem;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(240, 85, 55, 0.25);
  border-radius: 999px;
  background: #fff;
  color: var(--text-dark);
  font-weight: 700;
}

.ingestion-panel__file-button:hover {
  color: var(--accent);
  border-color: rgba(240, 85, 55, 0.5);
}

.ingestion-panel__form span {
  font-size: 0.9rem;
  font-weight: 600;
}

.ingestion-panel__form input,
.ingestion-panel__form select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.85rem;
  background: #fff;
  color: var(--text-dark);
  font: inherit;
}

.ingestion-panel__form input::placeholder {
  color: #7a8378;
  opacity: 1;
}

.ingestion-panel__field-help {
  color: var(--text-light);
  font-size: 0.82rem;
  line-height: 1.4;
}

.ingestion-panel__actions {
  display: flex;
  justify-content: center;
}

.ingestion-panel__submit {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #fff;
  border-radius: 999px;
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.ingestion-panel__submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ingestion-panel__message {
  padding: 0.8rem 0.9rem;
  border-radius: 0.85rem;
  font-size: 0.9rem;
}

.ingestion-panel__message--success {
  background: #ecfdf3;
  color: #027a48;
}

.ingestion-panel__message--error {
  background: #fef3f2;
  color: #b42318;
}

.ingestion-panel__summary {
  padding: 0.95rem;
  border-radius: 0.85rem;
  background: var(--background);
  border: 1px solid var(--border);
}

.ingestion-panel__progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 0.95rem;
  border-radius: 0.85rem;
  background: var(--background);
  border: 1px solid var(--border);
  text-align: left;
}

.ingestion-panel__progress-title,
.ingestion-panel__progress-copy {
  margin: 0;
}

.ingestion-panel__progress-title {
  font-weight: 700;
}

.ingestion-panel__progress-copy {
  margin-top: 0.2rem;
  color: var(--text-light);
}

.ingestion-panel__spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 999px;
  animation: ingestion-spin 0.75s linear infinite;
}

@keyframes ingestion-spin {
  to {
    transform: rotate(360deg);
  }
}

.ingestion-panel__summary-title {
  font-weight: 700;
}

.ingestion-panel__details {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.ingestion-panel__details dt {
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-light);
}

.ingestion-panel__details dd {
  margin-top: 0.2rem;
  word-break: break-word;
}

@media (min-width: 720px) {
  .ingestion-panel {
    padding: 1.5rem;
  }

  .ingestion-panel__dropzone {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 1.35rem 1.4rem;
  }

  .ingestion-panel__header {
    grid-template-columns: 1fr;
  }

  .ingestion-panel__details {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
