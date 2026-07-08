<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import {
  fetchVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  type VenueListItem
} from '../composables/useApi';

const { user } = useAuth();

const venues = ref<VenueListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Search & Filtering
const searchQuery = ref('');

const filteredVenues = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return venues.value;
  return venues.value.filter(v =>
    v.name.toLowerCase().includes(q) ||
    v.city.toLowerCase().includes(q) ||
    v.region.toLowerCase().includes(q) ||
    v.address?.toLowerCase().includes(q)
  );
});

// Create Venue Form
const newVenue = ref({
  name: '',
  address: '',
  city: '',
  citySlug: '',
  region: 'North Carolina',
  regionSlug: 'nc',
  lat: null as number | null,
  lng: null as number | null,
});

// Helper to generate slugs
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
};

watch(() => newVenue.value.city, (newCity) => {
  newVenue.value.citySlug = slugify(newCity);
});

// Inline Editing state
const editingId = ref<string | null>(null);
const editForm = ref({
  name: '',
  address: '',
  city: '',
  citySlug: '',
  region: '',
  regionSlug: '',
  lat: null as number | null,
  lng: null as number | null,
});

watch(() => editForm.value.city, (newCity) => {
  editForm.value.citySlug = slugify(newCity);
});

const load = async () => {
  if (!user.value) return;
  loading.value = true;
  error.value = null;
  try {
    const token = await user.value.getIdToken();
    venues.value = await fetchVenues(token);
  } catch (err: any) {
    console.error('Failed to load venues:', err);
    error.value = err.response?.data?.message || 'Failed to fetch venues from API.';
  } finally {
    loading.value = false;
  }
};

const handleCreate = async () => {
  if (!user.value) return;
  if (!newVenue.value.name || !newVenue.value.city || !newVenue.value.region) {
    error.value = 'Please provide name, city, and region.';
    return;
  }

  error.value = null;
  successMessage.value = null;

  try {
    const token = await user.value.getIdToken();
    const payload = {
      name: newVenue.value.name,
      address: newVenue.value.address || undefined,
      city: newVenue.value.city,
      citySlug: newVenue.value.citySlug || slugify(newVenue.value.city),
      region: newVenue.value.region,
      regionSlug: newVenue.value.regionSlug || slugify(newVenue.value.region),
      lat: newVenue.value.lat ? Number(newVenue.value.lat) : undefined,
      lng: newVenue.value.lng ? Number(newVenue.value.lng) : undefined,
    };

    const created = await createVenue(token, payload);
    venues.value.unshift(created);
    successMessage.value = `Successfully created venue "${created.name}"`;
    
    // Reset form
    newVenue.value = {
      name: '',
      address: '',
      city: '',
      citySlug: '',
      region: 'North Carolina',
      regionSlug: 'nc',
      lat: null,
      lng: null,
    };
  } catch (err: any) {
    console.error('Failed to create venue:', err);
    error.value = err.response?.data?.message || 'Failed to create venue.';
  }
};

const startEdit = (venue: VenueListItem) => {
  editingId.value = venue.id;
  editForm.value = {
    name: venue.name,
    address: venue.address || '',
    city: venue.city,
    citySlug: venue.citySlug,
    region: venue.region,
    regionSlug: venue.regionSlug,
    lat: venue.lat ? Number(venue.lat) : null,
    lng: venue.lng ? Number(venue.lng) : null,
  };
};

const cancelEdit = () => {
  editingId.value = null;
};

const handleUpdate = async (id: string) => {
  if (!user.value) return;
  error.value = null;
  successMessage.value = null;

  try {
    const token = await user.value.getIdToken();
    const payload = {
      name: editForm.value.name,
      address: editForm.value.address || undefined,
      city: editForm.value.city,
      citySlug: editForm.value.citySlug || slugify(editForm.value.city),
      region: editForm.value.region,
      regionSlug: editForm.value.regionSlug || slugify(editForm.value.region),
      lat: editForm.value.lat ? Number(editForm.value.lat) : undefined,
      lng: editForm.value.lng ? Number(editForm.value.lng) : undefined,
    };

    const updated = await updateVenue(token, id, payload);
    const index = venues.value.findIndex(v => v.id === id);
    if (index !== -1) {
      venues.value[index] = updated;
    }
    editingId.value = null;
    successMessage.value = `Successfully updated venue "${updated.name}"`;
  } catch (err: any) {
    console.error('Failed to update venue:', err);
    error.value = err.response?.data?.message || 'Failed to update venue.';
  }
};

const handleDelete = async (venue: VenueListItem) => {
  if (!user.value) return;
  if (!confirm(`Are you sure you want to delete the venue "${venue.name}"? This cannot be undone.`)) {
    return;
  }

  error.value = null;
  successMessage.value = null;

  try {
    const token = await user.value.getIdToken();
    await deleteVenue(token, venue.id);
    venues.value = venues.value.filter(v => v.id !== venue.id);
    successMessage.value = `Successfully deleted venue "${venue.name}"`;
  } catch (err: any) {
    console.error('Failed to delete venue:', err);
    error.value = err.response?.data?.message || 'Failed to delete venue.';
  }
};

onMounted(() => {
  load();
});
</script>

<template>
  <section class="admin-venues">
    <header class="admin-venues__header">
      <div>
        <h2 class="admin-venues__title">Venue Management (POC)</h2>
        <p class="admin-venues__subtitle">
          Manage and populate North Carolina music venue profiles for concert matching.
        </p>
      </div>
      <div class="admin-venues__controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by name, city, state..."
          class="admin-venues__search"
        />
        <button
          type="button"
          class="admin-venues__btn admin-venues__btn--refresh"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div v-if="successMessage" class="admin-venues__alert admin-venues__alert--success">
      {{ successMessage }}
      <button class="admin-venues__alert-close" @click="successMessage = null">×</button>
    </div>

    <div v-if="error" class="admin-venues__alert admin-venues__alert--error">
      {{ error }}
      <button class="admin-venues__alert-close" @click="error = null">×</button>
    </div>

    <!-- Add Venue Form Panel -->
    <div class="admin-venues__form-card">
      <h3 class="admin-venues__form-title">Add New Venue</h3>
      <form @submit.prevent="handleCreate" class="admin-venues__form">
        <div class="admin-venues__form-grid">
          <label class="admin-venues__field">
            <span>Venue Name *</span>
            <input v-model="newVenue.name" type="text" placeholder="e.g. The Pour House Music Hall" required />
          </label>
          <label class="admin-venues__field">
            <span>Street Address</span>
            <input v-model="newVenue.address" type="text" placeholder="e.g. 224 S Blount St" />
          </label>
          <label class="admin-venues__field">
            <span>City *</span>
            <input v-model="newVenue.city" type="text" placeholder="e.g. Raleigh" required />
          </label>
          <label class="admin-venues__field">
            <span>City Slug</span>
            <input v-model="newVenue.citySlug" type="text" placeholder="Auto-generated" />
          </label>
          <label class="admin-venues__field">
            <span>State/Region *</span>
            <input v-model="newVenue.region" type="text" placeholder="e.g. North Carolina" required />
          </label>
          <label class="admin-venues__field">
            <span>State Slug *</span>
            <input v-model="newVenue.regionSlug" type="text" placeholder="e.g. nc" required />
          </label>
          <label class="admin-venues__field">
            <span>Latitude</span>
            <input v-model="newVenue.lat" type="number" step="any" placeholder="e.g. 35.776" />
          </label>
          <label class="admin-venues__field">
            <span>Longitude</span>
            <input v-model="newVenue.lng" type="number" step="any" placeholder="e.g. -78.636" />
          </label>
        </div>
        <div class="admin-venues__form-actions">
          <button type="submit" class="admin-venues__btn admin-venues__btn--primary">
            Create Venue
          </button>
        </div>
      </form>
    </div>

    <!-- Venues Table -->
    <div class="admin-venues__card">
      <div v-if="loading && venues.length === 0" class="admin-venues__loading">
        Loading venues...
      </div>
      <div v-else-if="filteredVenues.length === 0" class="admin-venues__empty">
        No venues found.
      </div>
      <div v-else class="admin-venues__table-container">
        <table class="admin-venues__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Address</th>
              <th>City</th>
              <th>City Slug</th>
              <th>State</th>
              <th>State Slug</th>
              <th>Lat / Lng</th>
              <th class="admin-venues__th--actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="venue in filteredVenues"
              :key="venue.id"
              :class="{ 'admin-venues__tr--editing': editingId === venue.id }"
            >
              <!-- Name -->
              <td>
                <template v-if="editingId === venue.id">
                  <input v-model="editForm.name" type="text" class="admin-venues__table-input" required />
                </template>
                <template v-else>
                  <strong>{{ venue.name }}</strong>
                </template>
              </td>

              <!-- Address -->
              <td>
                <template v-if="editingId === venue.id">
                  <input v-model="editForm.address" type="text" class="admin-venues__table-input" />
                </template>
                <template v-else>
                  {{ venue.address || '—' }}
                </template>
              </td>

              <!-- City -->
              <td>
                <template v-if="editingId === venue.id">
                  <input v-model="editForm.city" type="text" class="admin-venues__table-input" required />
                </template>
                <template v-else>
                  {{ venue.city }}
                </template>
              </td>

              <!-- City Slug -->
              <td>
                <template v-if="editingId === venue.id">
                  <input v-model="editForm.citySlug" type="text" class="admin-venues__table-input" required />
                </template>
                <template v-else>
                  <code class="admin-venues__code">{{ venue.citySlug }}</code>
                </template>
              </td>

              <!-- State -->
              <td>
                <template v-if="editingId === venue.id">
                  <input v-model="editForm.region" type="text" class="admin-venues__table-input" required />
                </template>
                <template v-else>
                  {{ venue.region }}
                </template>
              </td>

              <!-- State Slug -->
              <td>
                <template v-if="editingId === venue.id">
                  <input v-model="editForm.regionSlug" type="text" class="admin-venues__table-input" required />
                </template>
                <template v-else>
                  <code class="admin-venues__code">{{ venue.regionSlug }}</code>
                </template>
              </td>

              <!-- Lat / Lng -->
              <td>
                <template v-if="editingId === venue.id">
                  <div class="admin-venues__table-coords">
                    <input v-model="editForm.lat" type="number" step="any" placeholder="Lat" class="admin-venues__table-input admin-venues__table-input--coord" />
                    <input v-model="editForm.lng" type="number" step="any" placeholder="Lng" class="admin-venues__table-input admin-venues__table-input--coord" />
                  </div>
                </template>
                <template v-else>
                  <span v-if="venue.lat && venue.lng" class="admin-venues__coords">
                    {{ Number(venue.lat).toFixed(4) }}, {{ Number(venue.lng).toFixed(4) }}
                  </span>
                  <span v-else class="admin-venues__coords admin-venues__coords--missing">
                    Missing coords
                  </span>
                </template>
              </td>

              <!-- Actions -->
              <td class="admin-venues__td--actions">
                <template v-if="editingId === venue.id">
                  <button
                    type="button"
                    class="admin-venues__btn admin-venues__btn--save"
                    @click="handleUpdate(venue.id)"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="admin-venues__btn admin-venues__btn--cancel"
                    @click="cancelEdit"
                  >
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="admin-venues__btn admin-venues__btn--edit"
                    @click="startEdit(venue)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="admin-venues__btn admin-venues__btn--delete"
                    @click="handleDelete(venue)"
                  >
                    Delete
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-venues {
  padding: 1.5rem 0 3rem;
}

.admin-venues__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.admin-venues__title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--text-dark);
  margin: 0 0 0.5rem;
}

.admin-venues__subtitle {
  color: var(--text-muted);
  margin: 0;
  font-size: 0.95rem;
}

.admin-venues__controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.admin-venues__search {
  padding: 0.6rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9rem;
  min-width: 250px;
  outline: none;
  background-color: var(--surface);
  color: var(--text);
  transition: border-color 0.2s;
}

.admin-venues__search:focus {
  border-color: var(--primary);
}

.admin-venues__alert {
  padding: 1rem 1.25rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  animation: fadeIn 0.2s ease-out;
}

.admin-venues__alert--success {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.admin-venues__alert--error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}

.admin-venues__alert-close {
  background: transparent;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: inherit;
  font-weight: bold;
}

/* Card layout */
.admin-venues__form-card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);
}

.admin-venues__form-title {
  margin: 0 0 1.25rem;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-dark);
}

.admin-venues__form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

.admin-venues__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.admin-venues__field span {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-muted);
}

.admin-venues__field input {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  background-color: var(--surface-soft);
  color: var(--text);
  transition: border-color 0.2s, background-color 0.2s;
}

.admin-venues__field input:focus {
  border-color: var(--primary);
  background-color: var(--surface);
}

.admin-venues__form-actions {
  display: flex;
  justify-content: flex-end;
}

/* Table Card */
.admin-venues__card {
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.admin-venues__loading,
.admin-venues__empty {
  padding: 3rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 1rem;
}

.admin-venues__table-container {
  overflow-x: auto;
}

.admin-venues__table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.admin-venues__table th {
  background-color: var(--surface-soft);
  padding: 1rem 1.25rem;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-venues__table td {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: middle;
}

.admin-venues__tr--editing td {
  background-color: #fafaf9;
}

.admin-venues__table-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--primary);
  border-radius: 4px;
  font-size: 0.85rem;
  outline: none;
  box-sizing: border-box;
}

.admin-venues__table-coords {
  display: flex;
  gap: 0.4rem;
}

.admin-venues__table-input--coord {
  width: 50%;
}

.admin-venues__code {
  font-family: monospace;
  background-color: var(--surface-soft);
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  color: var(--text-muted);
}

.admin-venues__coords {
  font-size: 0.85rem;
  color: var(--text);
}

.admin-venues__coords--missing {
  color: var(--text-muted);
  font-style: italic;
}

/* Buttons */
.admin-venues__btn {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.admin-venues__btn--primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.admin-venues__btn--primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.admin-venues__btn--refresh {
  background: var(--surface-soft);
  color: var(--text);
}

.admin-venues__btn--refresh:hover {
  background: var(--border);
}

.admin-venues__td--actions,
.admin-venues__th--actions {
  text-align: right !important;
  white-space: nowrap;
}

.admin-venues__td--actions .admin-venues__btn {
  margin-left: 0.5rem;
}

.admin-venues__btn--edit {
  border-color: #cbd5e1;
  color: #334155;
}

.admin-venues__btn--edit:hover {
  background-color: #f1f5f9;
}

.admin-venues__btn--delete {
  border-color: #fca5a5;
  color: #dc2626;
}

.admin-venues__btn--delete:hover {
  background-color: #fef2f2;
}

.admin-venues__btn--save {
  background-color: #10b981;
  color: white;
  border-color: #10b981;
}

.admin-venues__btn--save:hover {
  background-color: #059669;
}

.admin-venues__btn--cancel {
  border-color: #cbd5e1;
  color: #64748b;
}

.admin-venues__btn--cancel:hover {
  background-color: #f1f5f9;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
