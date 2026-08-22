<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import GenreCombobox from '../components/GenreCombobox.vue';
import { useAuth } from '../composables/useAuth';
import {
  createConcert,
  fetchAdminConcerts,
  fetchConcertGenres,
  fetchVenues,
  setConcertApproval,
  updateAdminConcert,
  uploadConcertPoster,
  type AdminConcertCatalogStatus,
  type CreateConcertPayload,
  type UpdateAdminConcertPayload,
  type VenueListItem,
} from '../composables/useApi';
import { resolvePosterUrl, type ConcertApiItem } from '../types/concerts';

const { user } = useAuth();
const concerts = ref<ConcertApiItem[]>([]);
const venues = ref<VenueListItem[]>([]);
const genres = ref<string[]>([]);
const loading = ref(false);
const savingId = ref<string | null>(null);
const error = ref('');
const notice = ref('');
const search = ref('');
const catalogStatus = ref<AdminConcertCatalogStatus | 'all'>('active');
const featuredOnly = ref(false);
const page = ref(1);
const pageSize = 25;
const total = ref(0);
const editing = ref<ConcertApiItem | null>(null);
const archiveCandidate = ref<ConcertApiItem | null>(null);
const closeEditorButton = ref<HTMLButtonElement | null>(null);
const archiveCancelButton = ref<HTMLButtonElement | null>(null);
const editPosterFile = ref<File | null>(null);

// Create Concert Modal State
const isCreating = ref(false);
const closeCreateButton = ref<HTMLButtonElement | null>(null);
const isSavingNew = ref(false);
const createPosterFile = ref<File | null>(null);
const createForm = reactive({
  title: '',
  genre: '',
  startsAt: '',
  endsAt: '',
  venueId: '',
  description: '',
});

let editorTrigger: HTMLElement | null = null;
let createTrigger: HTMLElement | null = null;
let archiveTrigger: HTMLElement | null = null;
let latestLoadRequest = 0;

const form = reactive({
  title: '',
  genre: '',
  startsAt: '',
  endsAt: '',
  venueId: '',
  description: '',
});

const statusOptions: Array<{
  value: AdminConcertCatalogStatus | 'all';
  label: string;
}> = [
  { value: 'active', label: 'Active' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
];

const resultSummary = computed(() => {
  if (!total.value) return '0 concerts';
  const first = (page.value - 1) * pageSize + 1;
  const last = Math.min(first + concerts.value.length - 1, total.value);
  return `${first}-${last} of ${total.value} concerts`;
});
const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize)),
);

function toLocalInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getMessage(reason: unknown, fallback: string) {
  const response = reason as {
    response?: { status?: number; data?: { message?: string | string[] } };
  };
  const message = response.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message || fallback;
}

async function token() {
  if (!user.value) throw new Error('Sign in is required.');
  return user.value.getIdToken();
}

async function load() {
  const requestId = ++latestLoadRequest;
  loading.value = true;
  error.value = '';
  try {
    const authToken = await token();
    const response = await fetchAdminConcerts(authToken, {
      q: search.value.trim() || undefined,
      catalogStatus: catalogStatus.value,
      isFeatured: featuredOnly.value || undefined,
      page: page.value,
      pageSize,
    });
    if (requestId !== latestLoadRequest) return;

    if (!response.data.length && page.value > 1 && response.total > 0) {
      page.value = Math.max(1, Math.ceil(response.total / pageSize));
      await load();
      return;
    }

    concerts.value = response.data;
    total.value = response.total;
  } catch (reason) {
    if (requestId !== latestLoadRequest) return;
    error.value = getMessage(reason, 'Unable to load the concert catalog.');
  } finally {
    if (requestId === latestLoadRequest) loading.value = false;
  }
}

async function applyFilters() {
  page.value = 1;
  await load();
}

async function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return;
  }
  page.value = nextPage;
  await load();
}

async function loadReferences() {
  try {
    const authToken = await token();
    const [genreResponse, venueResponse] = await Promise.all([
      fetchConcertGenres(),
      fetchVenues(authToken),
    ]);
    genres.value = genreResponse.genres;
    venues.value = venueResponse;
  } catch (reason) {
    error.value = getMessage(reason, 'Unable to load editing options.');
  }
}

function openCreateModal() {
  createTrigger = document.activeElement as HTMLElement | null;
  const now = new Date();
  now.setMinutes(0, 0, 0);
  createForm.title = '';
  createForm.genre = genres.value[0] || 'Rock';
  createForm.startsAt = toLocalInput(now.toISOString());
  createForm.endsAt = '';
  createForm.venueId = venues.value[0]?.id || '';
  createForm.description = '';
  createPosterFile.value = null;
  isCreating.value = true;
  void nextTick(() => closeCreateButton.value?.focus());
}

function closeCreateModal() {
  isCreating.value = false;
  createPosterFile.value = null;
  void nextTick(() => createTrigger?.focus());
}

function handleCreatePosterSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  createPosterFile.value = target.files?.[0] || null;
}

function handleEditPosterSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  editPosterFile.value = target.files?.[0] || null;
}

const createPosterPreviewUrl = computed(() => {
  if (createPosterFile.value) {
    return URL.createObjectURL(createPosterFile.value);
  }
  return '';
});

const editPosterPreviewUrl = computed(() => {
  if (editPosterFile.value) {
    return URL.createObjectURL(editPosterFile.value);
  }
  return resolvePosterUrl(editing.value?.posterUrl);
});

async function saveCreateConcert() {
  if (!createForm.title.trim() || !createForm.startsAt || !createForm.venueId) {
    error.value = 'Title, start time, and venue are required.';
    return;
  }

  isSavingNew.value = true;
  error.value = '';
  notice.value = '';

  try {
    const authToken = await token();
    const payload: CreateConcertPayload = {
      title: createForm.title.trim(),
      genre: createForm.genre.trim(),
      startsAt: new Date(createForm.startsAt).toISOString(),
      endsAt: createForm.endsAt ? new Date(createForm.endsAt).toISOString() : null,
      venueId: createForm.venueId,
      description: createForm.description.trim() || null,
    };

    const created = await createConcert(authToken, payload);

    if (createPosterFile.value && created?.id) {
      try {
        await uploadConcertPoster(authToken, created.id, createPosterFile.value);
      } catch (uploadErr) {
        console.warn('Concert created but poster upload failed:', uploadErr);
      }
    }

    notice.value = `Successfully created ${createForm.title.trim()}!`;
    closeCreateModal();
    await load();
  } catch (reason) {
    error.value = getMessage(reason, 'Unable to create concert.');
  } finally {
    isSavingNew.value = false;
  }
}

function openEditor(concert: ConcertApiItem) {
  editorTrigger = document.activeElement as HTMLElement | null;
  editing.value = concert;
  editPosterFile.value = null;
  form.title = concert.title;
  form.genre = concert.genre;
  form.startsAt = toLocalInput(concert.startsAt);
  form.endsAt = toLocalInput(concert.endsAt);
  form.venueId = concert.venue?.id || '';
  form.description = concert.description || '';
  void nextTick(() => closeEditorButton.value?.focus());
}

function closeEditor() {
  editing.value = null;
  editPosterFile.value = null;
  void nextTick(() => editorTrigger?.focus());
}

function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeEditor();
    return;
  }

  trapDialogFocus(event);
}

function handleCreateDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCreateModal();
    return;
  }

  trapDialogFocus(event);
}

function trapDialogFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget as HTMLElement;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openArchiveDialog(concert: ConcertApiItem) {
  archiveTrigger = document.activeElement as HTMLElement | null;
  archiveCandidate.value = concert;
  void nextTick(() => archiveCancelButton.value?.focus());
}

function closeArchiveDialog() {
  archiveCandidate.value = null;
  void nextTick(() => archiveTrigger?.focus());
}

function handleArchiveDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeArchiveDialog();
    return;
  }

  trapDialogFocus(event);
}

async function confirmArchive() {
  const concert = archiveCandidate.value;
  if (!concert) return;

  const updated = await update(
    concert,
    { catalogStatus: 'archived' },
    `${concert.title} is now archived.`,
  );
  if (updated) closeArchiveDialog();
}

async function update(
  concert: ConcertApiItem,
  payload: Omit<UpdateAdminConcertPayload, 'expectedVersion'>,
  successMessage: string,
) {
  savingId.value = concert.id;
  error.value = '';
  notice.value = '';
  try {
    const updated = await updateAdminConcert(await token(), concert.id, {
      expectedVersion: concert.version ?? 1,
      ...payload,
    });
    notice.value = successMessage;
    await load();
    return updated;
  } catch (reason) {
    const status = (reason as { response?: { status?: number } }).response
      ?.status;
    if (status === 409) {
      await load();
      closeEditor();
      error.value =
        'This concert changed in another session. The editor was closed and the latest version was loaded.';
    } else {
      error.value = getMessage(reason, 'Unable to update this concert.');
    }
    return null;
  } finally {
    savingId.value = null;
  }
}

async function saveEditor() {
  if (!editing.value) return;
  const currentConcertId = editing.value.id;

  const updated = await update(
    editing.value,
    {
      title: form.title.trim(),
      genre: form.genre.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      venueId: form.venueId || null,
      description: form.description.trim() || null,
    },
    `Saved changes to ${form.title.trim()}.`,
  );

  if (updated) {
    if (editPosterFile.value) {
      try {
        const authToken = await token();
        await uploadConcertPoster(authToken, currentConcertId, editPosterFile.value);
        notice.value = `Saved changes and uploaded new poster for ${form.title.trim()}.`;
        await load();
      } catch (posterErr) {
        error.value = getMessage(posterErr, 'Concert updated, but poster upload failed.');
      }
    }
    closeEditor();
  }
}

async function toggleApproval(concert: ConcertApiItem) {
  savingId.value = concert.id;
  error.value = '';
  notice.value = '';
  const nextApproved = !concert.isAdminApproved;
  try {
    const authToken = await token();
    await setConcertApproval(authToken, concert.id, nextApproved);
    concert.isAdminApproved = nextApproved;
    notice.value = `${concert.title} is now ${nextApproved ? 'approved' : 'unapproved'} for Top Picks.`;
  } catch (reason) {
    error.value = getMessage(reason, 'Unable to update approval status.');
  } finally {
    savingId.value = null;
  }
}

async function setStatus(
  concert: ConcertApiItem,
  nextStatus: AdminConcertCatalogStatus,
) {
  await update(
    concert,
    { catalogStatus: nextStatus },
    `${concert.title} is now ${nextStatus}.`,
  );
}

async function toggleFeatured(concert: ConcertApiItem) {
  await update(
    concert,
    { isFeatured: !concert.isFeatured },
    `${concert.title} ${concert.isFeatured ? 'removed from' : 'added to'} Featured.`,
  );
}

async function selectStatus(value: AdminConcertCatalogStatus | 'all') {
  catalogStatus.value = value;
  await applyFilters();
}

onMounted(async () => {
  await Promise.all([load(), loadReferences()]);
});
</script>

<template>
  <section class="catalog-admin">
    <header class="catalog-admin__header">
      <div>
        <p class="catalog-admin__eyebrow">Catalog operations</p>
        <h2>Concert catalog</h2>
        <p>
          Review listings, control public visibility, and protect editorial
          changes.
        </p>
      </div>
      <div class="catalog-admin__header-actions">
        <button
          type="button"
          class="button button--secondary"
          :disabled="loading"
          @click="load"
        >
          Refresh
        </button>
        <button
          type="button"
          class="button button--primary"
          @click="openCreateModal"
        >
          + Add Concert
        </button>
      </div>
    </header>

    <form
      class="catalog-admin__toolbar"
      role="search"
      @submit.prevent="applyFilters"
    >
      <label class="search-field">
        <span>Search catalog</span>
        <input
          v-model="search"
          type="search"
          placeholder="Title, artist, venue, or description"
        />
      </label>
      <button type="submit" class="button">Search</button>
      <label class="featured-filter">
        <input v-model="featuredOnly" type="checkbox" @change="applyFilters" />
        Featured only
      </label>
    </form>

    <div class="status-tabs" aria-label="Catalog status filter">
      <button
        v-for="option in statusOptions"
        :key="option.value"
        type="button"
        :class="{ active: catalogStatus === option.value }"
        :aria-pressed="catalogStatus === option.value"
        @click="selectStatus(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <p v-if="error" class="message message--error" role="alert">{{ error }}</p>
    <p v-if="notice" class="message message--success" role="status">
      {{ notice }}
    </p>

    <div class="catalog-admin__result-heading">
      <strong>{{ resultSummary }}</strong>
      <span v-if="loading">Loading latest catalog...</span>
    </div>

    <div v-if="!loading && !concerts.length" class="empty-state">
      No concerts match these filters.
    </div>

    <div v-else class="concert-table">
      <article
        v-for="concert in concerts"
        :key="concert.id"
        class="concert-row"
      >
        <div class="concert-row__date">
          <strong>{{
            new Date(concert.startsAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })
          }}</strong>
          <span>{{
            new Date(concert.startsAt).toLocaleDateString(undefined, {
              year: 'numeric',
            })
          }}</span>
        </div>
        <div class="concert-row__main">
          <div class="concert-row__title-line">
            <h3>{{ concert.title }}</h3>
            <span
              class="status"
              :class="`status--${concert.catalogStatus || 'active'}`"
            >
              {{ concert.catalogStatus || 'active' }}
            </span>
            <span v-if="concert.isFeatured" class="status status--featured"
              >Featured</span
            >
            <span
              v-if="concert.isAdminApproved"
              class="status status--approved"
              title="Approved for Top Picks Weekly newsletter"
            >
              Top Pick Approved
            </span>
            <span
              v-if="concert.syncSource"
              class="status status--synced"
              title="Ingested via Sync Doctor / Calendar feed"
            >
              Synced
            </span>
          </div>
          <p>
            {{ formatDate(concert.startsAt) }} |
            {{ concert.venue?.name || 'Venue not set' }} | {{ concert.genre }}
          </p>
        </div>
        <div class="concert-row__actions">
          <button
            type="button"
            class="button button--secondary"
            :disabled="savingId === concert.id"
            @click="toggleApproval(concert)"
          >
            {{ concert.isAdminApproved ? 'Unapprove Top Pick' : 'Approve Top Pick' }}
          </button>
          <button
            type="button"
            class="button button--secondary"
            @click="openEditor(concert)"
          >
            Edit
          </button>
          <button
            type="button"
            class="button button--secondary"
            :disabled="savingId === concert.id"
            @click="
              setStatus(
                concert,
                concert.catalogStatus === 'hidden' ? 'active' : 'hidden',
              )
            "
          >
            {{ concert.catalogStatus === 'hidden' ? 'Restore' : 'Hide' }}
          </button>
          <button
            type="button"
            class="button button--secondary"
            :disabled="savingId === concert.id"
            @click="toggleFeatured(concert)"
          >
            {{ concert.isFeatured ? 'Unfeature' : 'Feature' }}
          </button>
          <button
            type="button"
            class="button button--danger"
            :disabled="savingId === concert.id"
            @click="openArchiveDialog(concert)"
          >
            Archive
          </button>
        </div>
      </article>
    </div>

    <nav
      v-if="totalPages > 1"
      class="catalog-pagination"
      aria-label="Concert catalog pages"
    >
      <button
        type="button"
        class="button button--secondary"
        :disabled="loading || page === 1"
        @click="changePage(page - 1)"
      >
        Previous
      </button>
      <span aria-live="polite">Page {{ page }} of {{ totalPages }}</span>
      <button
        type="button"
        class="button button--secondary"
        :disabled="loading || page === totalPages"
        @click="changePage(page + 1)"
      >
        Next
      </button>
    </nav>

    <!-- Add Concert Modal -->
    <div v-if="isCreating" class="dialog-backdrop" @click.self="closeCreateModal">
      <form
        class="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-dialog-title"
        @submit.prevent="saveCreateConcert"
        @keydown="handleCreateDialogKeydown"
      >
        <header>
          <div>
            <p class="catalog-admin__eyebrow">Manual curation</p>
            <h3 id="create-dialog-title">Add new concert</h3>
          </div>
          <button
            ref="closeCreateButton"
            type="button"
            class="close-button"
            aria-label="Close create dialog"
            @click="closeCreateModal"
          >
            &times;
          </button>
        </header>
        <div class="editor__grid">
          <label class="field field--wide">
            <span>Concert Title *</span>
            <input
              v-model="createForm.title"
              placeholder="e.g. Dr. Bacon & Friends"
              required
            />
          </label>
          <GenreCombobox
            v-model="createForm.genre"
            :options="genres"
            allow-custom
            label="Genre"
          />
          <label class="field">
            <span>Venue *</span>
            <select v-model="createForm.venueId" required>
              <option value="" disabled>Select venue</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.name }} - {{ venue.city }}, {{ venue.region }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>Starts *</span>
            <input v-model="createForm.startsAt" type="datetime-local" required />
          </label>
          <label class="field">
            <span>Ends (Optional)</span>
            <input v-model="createForm.endsAt" type="datetime-local" />
          </label>
          <div class="field field--wide poster-field">
            <span>Poster / Flyer Image (Optional)</span>
            <div v-if="createPosterPreviewUrl" class="poster-preview">
              <img :src="createPosterPreviewUrl" alt="Concert poster preview" class="poster-thumbnail" />
              <p class="poster-hint">Selected artwork for this new concert.</p>
            </div>
            <input type="file" accept="image/*" @change="handleCreatePosterSelect" />
            <p v-if="createPosterFile" class="file-selected-name">Selected: {{ createPosterFile.name }}</p>
          </div>
          <label class="field field--wide">
            <span>Description / Lineup Notes</span>
            <textarea v-model="createForm.description" rows="4" placeholder="Doors 7 PM, ticket link, bio, etc."></textarea>
          </label>
        </div>
        <footer>
          <button
            type="button"
            class="button button--secondary"
            @click="closeCreateModal"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="button button--primary"
            :disabled="isSavingNew"
          >
            {{ isSavingNew ? 'Creating...' : 'Create Concert' }}
          </button>
        </footer>
      </form>
    </div>

    <!-- Edit Concert Modal -->
    <div v-if="editing" class="dialog-backdrop" @click.self="closeEditor">
      <form
        class="editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="concert-editor-title"
        @submit.prevent="saveEditor"
        @keydown="handleDialogKeydown"
      >
        <header>
          <div>
            <p class="catalog-admin__eyebrow">Editorial override</p>
            <h3 id="concert-editor-title">Edit concert</h3>
          </div>
          <button
            ref="closeEditorButton"
            type="button"
            class="close-button"
            aria-label="Close editor"
            @click="closeEditor"
          >
            &times;
          </button>
        </header>
        <div class="editor__grid">
          <label class="field field--wide"
            ><span>Title</span><input v-model="form.title" required
          /></label>
          <GenreCombobox
            v-model="form.genre"
            :options="genres"
            allow-custom
            label="Genre"
          />
          <label class="field"
            ><span>Venue</span
            ><select v-model="form.venueId">
              <option value="">No venue</option>
              <option v-for="venue in venues" :key="venue.id" :value="venue.id">
                {{ venue.name }} - {{ venue.city }}
              </option>
            </select></label
          >
          <label class="field"
            ><span>Starts</span
            ><input v-model="form.startsAt" type="datetime-local" required
          /></label>
          <label class="field"
            ><span>Ends</span
            ><input v-model="form.endsAt" type="datetime-local"
          /></label>
          <div class="field field--wide poster-field">
            <span>Poster / Flyer Image</span>
            <div v-if="editPosterPreviewUrl" class="poster-preview">
              <img :src="editPosterPreviewUrl" alt="Concert poster preview" class="poster-thumbnail" />
              <p class="poster-hint">
                {{ editPosterFile ? 'New image selected for upload.' : 'Current artwork. Choose a file below to replace.' }}
              </p>
            </div>
            <input type="file" accept="image/*" @change="handleEditPosterSelect" />
            <p v-if="editPosterFile" class="file-selected-name">Selected: {{ editPosterFile.name }}</p>
          </div>
          <label class="field field--wide"
            ><span>Description</span
            ><textarea v-model="form.description" rows="5"></textarea>
          </label>
        </div>
        <footer>
          <button
            type="button"
            class="button button--secondary"
            @click="closeEditor"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="button"
            :disabled="savingId === editing.id"
          >
            {{ savingId === editing.id ? 'Saving...' : 'Save changes' }}
          </button>
        </footer>
      </form>
    </div>

    <!-- Archive Confirmation Dialog -->
    <div
      v-if="archiveCandidate"
      class="dialog-backdrop"
      @click.self="closeArchiveDialog"
    >
      <section
        class="archive-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="archive-dialog-title"
        aria-describedby="archive-dialog-description"
        @keydown="handleArchiveDialogKeydown"
      >
        <h3 id="archive-dialog-title">Archive concert?</h3>
        <p id="archive-dialog-description">
          <strong>{{ archiveCandidate.title }}</strong> will leave the public
          catalog but can be restored later.
        </p>
        <footer>
          <button
            ref="archiveCancelButton"
            type="button"
            class="button button--secondary"
            @click="closeArchiveDialog"
          >
            Cancel
          </button>
          <button
            type="button"
            class="button button--danger button--danger-filled"
            :disabled="savingId === archiveCandidate.id"
            @click="confirmArchive"
          >
            {{ savingId === archiveCandidate.id ? 'Archiving...' : 'Archive' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>


<style scoped>
.catalog-admin {
  padding: 2rem 0 4rem;
}
.catalog-admin__header,
.catalog-admin__toolbar,
.catalog-admin__result-heading,
.concert-row,
.editor header,
.editor footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.catalog-admin__header {
  align-items: flex-start;
  margin-bottom: 1.5rem;
}
.catalog-admin h2 {
  margin: 0.15rem 0 0.35rem;
  font-size: 1.75rem;
}
.catalog-admin__header p,
.concert-row p {
  margin: 0;
  color: var(--text-muted);
}
.catalog-admin__eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
}
.catalog-admin__toolbar {
  justify-content: flex-start;
  padding: 1rem 0;
  border-top: 1px solid var(--border);
}
.search-field {
  flex: 1;
  max-width: 34rem;
}
.search-field span,
.field span,
.genre-combobox :deep(.genre-combobox__label) {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
}
input,
select,
textarea {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #cbd1d7;
  border-radius: 4px;
  background: white;
  color: var(--text);
  font: inherit;
  padding: 0.65rem 0.75rem;
}
.featured-filter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}
.featured-filter input {
  width: 1rem;
  height: 1rem;
}
.status-tabs {
  display: flex;
  gap: 0.25rem;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
}
.status-tabs button {
  border: 0;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-weight: 700;
  padding: 0.75rem 1rem;
  cursor: pointer;
}
.status-tabs button.active {
  border-bottom-color: var(--accent);
  color: var(--text);
}
.message {
  padding: 0.75rem 1rem;
  border-left: 4px solid;
}
.message--error {
  background: #fff1f0;
  border-color: #c9362b;
  color: #7a211b;
}
.message--success {
  background: #effaf5;
  border-color: #1f9367;
  color: #146247;
}
.catalog-admin__result-heading {
  min-height: 3rem;
  font-size: 0.9rem;
}
.catalog-admin__result-heading span {
  color: var(--text-muted);
}
.concert-table {
  border-top: 1px solid var(--border);
}
.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  min-height: 4rem;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
}
.concert-row {
  align-items: flex-start;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}
.concert-row__date {
  width: 3.5rem;
  flex: 0 0 3.5rem;
  text-align: center;
}
.concert-row__date strong,
.concert-row__date span {
  display: block;
}
.concert-row__date span {
  color: var(--text-muted);
  font-size: 0.75rem;
}
.concert-row__main {
  flex: 1;
  min-width: 12rem;
}
.concert-row__title-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.concert-row h3 {
  margin: 0;
  font-size: 1rem;
}
.concert-row__main > p {
  margin-top: 0.4rem;
  font-size: 0.85rem;
}
.status {
  border: 1px solid #bfc6cc;
  border-radius: 999px;
  padding: 0.15rem 0.45rem;
  color: #47515b;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
}
.status--hidden {
  border-color: #d39b25;
  color: #76520a;
}
.status--archived {
  border-color: #8b949e;
  color: #59616a;
}
.status--featured {
  border-color: #1f9367;
  color: #146247;
}
.status--approved {
  border-color: #0284c7;
  color: #0369a1;
  background: rgba(2, 132, 199, 0.08);
}
.status--synced {
  border-color: #6366f1;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.08);
}
.catalog-admin__header-actions {
  display: flex;
  gap: 0.5rem;
}
.poster-field {
  margin-top: 0.25rem;
}
.poster-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.poster-thumbnail {
  width: 54px;
  height: 72px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.poster-hint,
.file-selected-name {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.file-selected-name {
  color: var(--accent);
  font-weight: 600;
  margin-top: 0.25rem;
}
.concert-row__actions {
  display: flex;
  flex: 0 0 22rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.4rem;
}
.button {
  min-height: 2.35rem;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--accent);
  color: white;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 750;
  padding: 0.45rem 0.8rem;
  cursor: pointer;
}
.button--primary {
  background: var(--accent);
  color: white;
}
.button--secondary {
  border-color: #cbd1d7;
  background: white;
  color: var(--text);
}
.button--danger {
  border-color: #c9362b;
  background: white;
  color: #a32c23;
}
.button--danger-filled {
  background: #a32c23;
  color: white;
}
.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.empty-state {
  border-block: 1px solid var(--border);
  padding: 3rem 1rem;
  color: var(--text-muted);
  text-align: center;
}
.dialog-backdrop {
  position: fixed;
  z-index: 30;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(20, 25, 30, 0.55);
}
.editor {
  width: min(42rem, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  border-radius: 6px;
  background: white;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
}
.archive-dialog {
  width: min(28rem, 100%);
  border-radius: 6px;
  background: white;
  padding: 1.25rem;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
}
.archive-dialog h3 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}
.archive-dialog p {
  margin: 0;
  color: var(--text-muted);
}
.archive-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}
.editor header,
.editor footer {
  padding: 1rem 1.25rem;
}
.editor header {
  border-bottom: 1px solid var(--border);
}
.editor h3 {
  margin: 0.15rem 0 0;
}
.close-button {
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.6rem;
  cursor: pointer;
}
.editor__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.25rem;
}
.field--wide {
  grid-column: 1 / -1;
}
.editor footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border);
}
@media (max-width: 760px) {
  .catalog-admin__header,
  .catalog-admin__toolbar,
  .concert-row {
    align-items: stretch;
    flex-direction: column;
  }
  .catalog-admin__toolbar .button {
    align-self: flex-start;
  }
  .concert-row__date {
    width: auto;
    text-align: left;
  }
  .concert-row__date strong,
  .concert-row__date span {
    display: inline;
    margin-right: 0.25rem;
  }
  .concert-row__actions {
    flex-basis: auto;
    justify-content: flex-start;
  }
  .catalog-pagination {
    justify-content: space-between;
  }
  .editor__grid {
    grid-template-columns: 1fr;
  }
  .field--wide {
    grid-column: auto;
  }
}
</style>
