<template>
  <section class="ingestion-panel">
    <div class="ingestion-panel__header">
      <p class="ingestion-panel__intro">
        Upload a show poster
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

      <label>
        <span>City</span>
        <input v-model="city" type="text" placeholder="Raleigh" />
      </label>

      <label>
        <span>State</span>
        <input v-model="state" type="text" maxlength="2" placeholder="NC" />
      </label>

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
import { computed, ref } from 'vue';
import { AxiosError } from 'axios';
import {
  createIngestionJob,
  fetchIngestionJob,
  type IngestionJobResponse,
  type IngestionUploadResult,
  uploadIngestionImage,
} from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';

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
const city = ref('');
const state = ref('NC');
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
const acceptedFileTypes = acceptedMimeTypes.join(',');
const formattedFileSize = computed(() => {
  if (!selectedFile.value) {
    return '';
  }

  const fileSizeMb = selectedFile.value.size / (1024 * 1024);
  return `${fileSizeMb.toFixed(fileSizeMb >= 10 ? 0 : 1)} MB`;
});
const isSubmitDisabled = computed(() => !user.value || !selectedFile.value || isSubmitting.value);
const messageClass = computed(() =>
  messageType.value === 'success'
    ? 'ingestion-panel__message ingestion-panel__message--success'
    : 'ingestion-panel__message ingestion-panel__message--error',
);

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
  if (!user.value || !selectedFile.value || isSubmitDisabled.value) {
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
  gap: 0.9rem;
  justify-items: center;
  text-align: center;
}

.ingestion-panel__intro {
  max-width: 36rem;
  color: var(--text-light);
}

.ingestion-panel__form {
  display: grid;
  gap: 0.9rem;
  justify-items: center;
}

.ingestion-panel__form label {
  display: grid;
  gap: 0.35rem;
  text-align: center;
  width: min(100%, 34rem);
}

.ingestion-panel__dropzone {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  width: min(100%, 34rem);
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
