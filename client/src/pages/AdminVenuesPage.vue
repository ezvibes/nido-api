<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import {
  fetchVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  type VenueListItem,
  type VenueVerificationState,
} from '../composables/useApi';

const { user } = useAuth();

const venues = ref<VenueListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Search & Status Filtering
const searchQuery = ref('');
const statusFilter = ref<string>('all');

const filteredVenues = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  const filter = statusFilter.value;

  return venues.value.filter((v) => {
    const matchesStatus =
      filter === 'all' ||
      (v.verificationState || 'unverified') === filter;

    if (!matchesStatus) return false;
    if (!q) return true;

    return (
      v.name.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      v.region.toLowerCase().includes(q) ||
      v.address?.toLowerCase().includes(q) ||
      v.postalCode?.toLowerCase().includes(q)
    );
  });
});

// Verification State Count Metrics
const statusCounts = computed(() => {
  const counts = {
    all: venues.value.length,
    canonical: 0,
    verified: 0,
    unverified: 0,
    flagged: 0,
  };
  for (const v of venues.value) {
    const s = v.verificationState || 'unverified';
    if (s in counts) {
      counts[s as keyof typeof counts]++;
    }
  }
  return counts;
});

// Helper to generate slugs
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

// Create Venue Form
const newVenue = ref({
  name: '',
  address: '',
  postalCode: '',
  city: '',
  citySlug: '',
  region: 'North Carolina',
  regionSlug: 'nc',
  capacity: '' as string | number,
  verificationState: 'unverified' as VenueVerificationState,
});

watch(
  () => newVenue.value.city,
  (newCity) => {
    newVenue.value.citySlug = slugify(newCity);
  },
);

// Inline Editing state
const editingId = ref<string | null>(null);
const editForm = ref({
  name: '',
  address: '',
  postalCode: '',
  city: '',
  citySlug: '',
  region: '',
  regionSlug: '',
  capacity: '' as string | number,
  verificationState: 'unverified' as VenueVerificationState,
});

watch(
  () => editForm.value.city,
  (newCity) => {
    editForm.value.citySlug = slugify(newCity);
  },
);

const load = async () => {
  if (!user.value) return;
  loading.value = true;
  error.value = null;
  try {
    const token = await user.value.getIdToken();
    venues.value = await fetchVenues(token);
  } catch (err: any) {
    console.error('Failed to load venues:', err);
    error.value =
      err.response?.data?.message || 'Failed to fetch venues from API.';
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
    const capacityNum =
      newVenue.value.capacity !== ''
        ? Number(newVenue.value.capacity)
        : undefined;

    const payload = {
      name: newVenue.value.name,
      address: newVenue.value.address || undefined,
      postalCode: newVenue.value.postalCode || undefined,
      city: newVenue.value.city,
      citySlug: newVenue.value.citySlug || slugify(newVenue.value.city),
      region: newVenue.value.region,
      regionSlug: newVenue.value.regionSlug || slugify(newVenue.value.region),
      capacity: capacityNum && capacityNum > 0 ? capacityNum : undefined,
      verificationState: newVenue.value.verificationState || 'unverified',
    };

    const created = await createVenue(token, payload);
    venues.value.unshift(created);
    successMessage.value = `Successfully created venue "${created.name}"`;

    // Reset form
    newVenue.value = {
      name: '',
      address: '',
      postalCode: '',
      city: '',
      citySlug: '',
      region: 'North Carolina',
      regionSlug: 'nc',
      capacity: '',
      verificationState: 'unverified',
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
    postalCode: venue.postalCode || '',
    city: venue.city,
    citySlug: venue.citySlug,
    region: venue.region,
    regionSlug: venue.regionSlug,
    capacity: venue.capacity ? String(venue.capacity) : '',
    verificationState: venue.verificationState || 'unverified',
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
    const capacityNum =
      editForm.value.capacity !== ''
        ? Number(editForm.value.capacity)
        : null;

    const payload = {
      name: editForm.value.name,
      address: editForm.value.address || undefined,
      postalCode: editForm.value.postalCode || null,
      city: editForm.value.city,
      citySlug: editForm.value.citySlug || slugify(editForm.value.city),
      region: editForm.value.region,
      regionSlug: editForm.value.regionSlug || slugify(editForm.value.region),
      capacity: capacityNum && capacityNum > 0 ? capacityNum : null,
      verificationState: editForm.value.verificationState,
    };

    const updated = await updateVenue(token, id, payload);
    const index = venues.value.findIndex((v) => v.id === id);
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

const handlePromoteState = async (
  venue: VenueListItem,
  targetState: VenueVerificationState,
) => {
  if (!user.value) return;
  error.value = null;
  successMessage.value = null;

  try {
    const token = await user.value.getIdToken();
    const updated = await updateVenue(token, venue.id, {
      verificationState: targetState,
    });
    const index = venues.value.findIndex((v) => v.id === venue.id);
    if (index !== -1) {
      venues.value[index] = updated;
    }
    successMessage.value = `Promoted venue "${venue.name}" to ${targetState}`;
  } catch (err: any) {
    console.error('Failed to change venue state:', err);
    error.value = err.response?.data?.message || 'Failed to update venue state.';
  }
};

const handleDelete = async (venue: VenueListItem) => {
  if (!user.value) return;
  if (
    !confirm(
      `Are you sure you want to delete the venue "${venue.name}"? This cannot be undone.`,
    )
  ) {
    return;
  }

  error.value = null;
  successMessage.value = null;

  try {
    const token = await user.value.getIdToken();
    await deleteVenue(token, venue.id);
    venues.value = venues.value.filter((v) => v.id !== venue.id);
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
        <h2 class="admin-venues__title">Venue Management & Inspection</h2>
        <p class="admin-venues__subtitle">
          Canonical catalog moderation, room capacity, postal codes, and verification audit.
        </p>
      </div>
      <div class="admin-venues__controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search name, city, postal code..."
          class="admin-venues__search"
          data-testid="venue-search-input"
        />
        <select
          v-model="statusFilter"
          class="admin-venues__select-filter"
          data-testid="venue-status-filter"
        >
          <option value="all">All Statuses ({{ statusCounts.all }})</option>
          <option value="canonical">👑 Canonical ({{ statusCounts.canonical }})</option>
          <option value="verified">✅ Verified ({{ statusCounts.verified }})</option>
          <option value="unverified">⏳ Unverified ({{ statusCounts.unverified }})</option>
          <option value="flagged">⚠️ Flagged ({{ statusCounts.flagged }})</option>
        </select>
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

    <!-- Metrics Badges Ribbon -->
    <div class="admin-venues__metrics-ribbon">
      <button
        type="button"
        class="admin-venues__metric-pill"
        :class="{ 'admin-venues__metric-pill--active': statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        <span>All</span>
        <strong>{{ statusCounts.all }}</strong>
      </button>
      <button
        type="button"
        class="admin-venues__metric-pill admin-venues__metric-pill--canonical"
        :class="{ 'admin-venues__metric-pill--active': statusFilter === 'canonical' }"
        @click="statusFilter = 'canonical'"
      >
        <span>👑 Canonical</span>
        <strong>{{ statusCounts.canonical }}</strong>
      </button>
      <button
        type="button"
        class="admin-venues__metric-pill admin-venues__metric-pill--verified"
        :class="{ 'admin-venues__metric-pill--active': statusFilter === 'verified' }"
        @click="statusFilter = 'verified'"
      >
        <span>✅ Verified</span>
        <strong>{{ statusCounts.verified }}</strong>
      </button>
      <button
        type="button"
        class="admin-venues__metric-pill admin-venues__metric-pill--unverified"
        :class="{ 'admin-venues__metric-pill--active': statusFilter === 'unverified' }"
        @click="statusFilter = 'unverified'"
      >
        <span>⏳ Unverified</span>
        <strong>{{ statusCounts.unverified }}</strong>
      </button>
      <button
        type="button"
        class="admin-venues__metric-pill admin-venues__metric-pill--flagged"
        :class="{ 'admin-venues__metric-pill--active': statusFilter === 'flagged' }"
        @click="statusFilter = 'flagged'"
      >
        <span>⚠️ Flagged</span>
        <strong>{{ statusCounts.flagged }}</strong>
      </button>
    </div>

    <div
      v-if="successMessage"
      class="admin-venues__alert admin-venues__alert--success"
      data-testid="alert-success"
    >
      {{ successMessage }}
      <button class="admin-venues__alert-close" @click="successMessage = null">×</button>
    </div>

    <div
      v-if="error"
      class="admin-venues__alert admin-venues__alert--error"
      data-testid="alert-error"
    >
      {{ error }}
      <button class="admin-venues__alert-close" @click="error = null">×</button>
    </div>

    <!-- Add Venue Form Panel -->
    <div class="admin-venues__form-card">
      <h3 class="admin-venues__form-title">Add New Catalog Venue</h3>
      <form @submit.prevent="handleCreate" class="admin-venues__form">
        <div class="admin-venues__form-grid">
          <label class="admin-venues__field">
            <span>Venue Name *</span>
            <input
              v-model="newVenue.name"
              type="text"
              placeholder="e.g. The Pour House Music Hall"
              required
            />
          </label>
          <label class="admin-venues__field">
            <span>Street Address</span>
            <input
              v-model="newVenue.address"
              type="text"
              placeholder="e.g. 224 S Blount St"
            />
          </label>
          <label class="admin-venues__field">
            <span>Postal Code</span>
            <input
              v-model="newVenue.postalCode"
              type="text"
              placeholder="e.g. 27601"
            />
          </label>
          <label class="admin-venues__field">
            <span>City *</span>
            <input
              v-model="newVenue.city"
              type="text"
              placeholder="e.g. Raleigh"
              required
            />
          </label>
          <label class="admin-venues__field">
            <span>City Slug</span>
            <input
              v-model="newVenue.citySlug"
              type="text"
              placeholder="Auto-generated"
            />
          </label>
          <label class="admin-venues__field">
            <span>State/Region *</span>
            <input
              v-model="newVenue.region"
              type="text"
              placeholder="e.g. North Carolina"
              required
            />
          </label>
          <label class="admin-venues__field">
            <span>State Slug *</span>
            <input
              v-model="newVenue.regionSlug"
              type="text"
              placeholder="e.g. nc"
              required
            />
          </label>
          <label class="admin-venues__field">
            <span>Capacity (Guests)</span>
            <input
              v-model="newVenue.capacity"
              type="number"
              min="1"
              placeholder="e.g. 289"
            />
          </label>
          <label class="admin-venues__field">
            <span>Verification State</span>
            <select v-model="newVenue.verificationState" class="admin-venues__select">
              <option value="unverified">⏳ Unverified</option>
              <option value="verified">✅ Verified</option>
              <option value="canonical">👑 Canonical</option>
              <option value="flagged">⚠️ Flagged</option>
            </select>
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
        No venues match the selected filters.
      </div>
      <div v-else class="admin-venues__table-container">
        <table class="admin-venues__table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Address / Postal Code</th>
              <th>City / Region</th>
              <th>Capacity</th>
              <th>Slugs</th>
              <th class="admin-venues__th--actions">Actions / Review</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="venue in filteredVenues"
              :key="venue.id"
              :class="{ 'admin-venues__tr--editing': editingId === venue.id }"
              :data-testid="`venue-row-${venue.id}`"
            >
              <!-- Verification State Badge -->
              <td>
                <template v-if="editingId === venue.id">
                  <select
                    v-model="editForm.verificationState"
                    class="admin-venues__table-select"
                  >
                    <option value="unverified">⏳ Unverified</option>
                    <option value="verified">✅ Verified</option>
                    <option value="canonical">👑 Canonical</option>
                    <option value="flagged">⚠️ Flagged</option>
                  </select>
                </template>
                <template v-else>
                  <span
                    class="admin-venues__badge"
                    :class="`admin-venues__badge--${venue.verificationState || 'unverified'}`"
                    :data-testid="`badge-${venue.verificationState || 'unverified'}`"
                  >
                    <span v-if="(venue.verificationState || 'unverified') === 'canonical'">👑 Canonical</span>
                    <span v-else-if="venue.verificationState === 'verified'">✅ Verified</span>
                    <span v-else-if="venue.verificationState === 'flagged'">⚠️ Flagged</span>
                    <span v-else>⏳ Unverified</span>
                  </span>
                </template>
              </td>

              <!-- Name -->
              <td>
                <template v-if="editingId === venue.id">
                  <input
                    v-model="editForm.name"
                    type="text"
                    class="admin-venues__table-input"
                    required
                  />
                </template>
                <template v-else>
                  <strong>{{ venue.name }}</strong>
                </template>
              </td>

              <!-- Address & Postal Code -->
              <td>
                <template v-if="editingId === venue.id">
                  <input
                    v-model="editForm.address"
                    type="text"
                    placeholder="Street Address"
                    class="admin-venues__table-input admin-venues__table-input--sub"
                  />
                  <input
                    v-model="editForm.postalCode"
                    type="text"
                    placeholder="ZIP / Postal Code"
                    class="admin-venues__table-input"
                  />
                </template>
                <template v-else>
                  <div>{{ venue.address || '—' }}</div>
                  <small v-if="venue.postalCode" class="admin-venues__subtext">
                    📮 {{ venue.postalCode }}
                  </small>
                  <small v-else class="admin-venues__subtext admin-venues__subtext--warning">
                    ⚠️ Missing postal code
                  </small>
                </template>
              </td>

              <!-- City / Region -->
              <td>
                <template v-if="editingId === venue.id">
                  <input
                    v-model="editForm.city"
                    type="text"
                    placeholder="City"
                    class="admin-venues__table-input admin-venues__table-input--sub"
                    required
                  />
                  <input
                    v-model="editForm.region"
                    type="text"
                    placeholder="Region"
                    class="admin-venues__table-input"
                    required
                  />
                </template>
                <template v-else>
                  {{ venue.city }}, {{ venue.region }}
                </template>
              </td>

              <!-- Capacity -->
              <td>
                <template v-if="editingId === venue.id">
                  <input
                    v-model="editForm.capacity"
                    type="number"
                    min="1"
                    placeholder="Capacity"
                    class="admin-venues__table-input"
                  />
                </template>
                <template v-else>
                  <span v-if="venue.capacity" class="admin-venues__capacity">
                    👥 {{ venue.capacity }}
                  </span>
                  <span v-else class="admin-venues__subtext admin-venues__subtext--muted">
                    —
                  </span>
                </template>
              </td>

              <!-- Slugs -->
              <td>
                <template v-if="editingId === venue.id">
                  <input
                    v-model="editForm.citySlug"
                    type="text"
                    placeholder="city-slug"
                    class="admin-venues__table-input admin-venues__table-input--sub"
                    required
                  />
                  <input
                    v-model="editForm.regionSlug"
                    type="text"
                    placeholder="region-slug"
                    class="admin-venues__table-input"
                    required
                  />
                </template>
                <template v-else>
                  <code class="admin-venues__code">{{ venue.citySlug }}</code>
                  <code class="admin-venues__code">{{ venue.regionSlug }}</code>
                </template>
              </td>

              <!-- Actions & Promote Buttons -->
              <td class="admin-venues__td--actions">
                <template v-if="editingId === venue.id">
                  <button
                    type="button"
                    class="admin-venues__btn admin-venues__btn--save"
                    data-testid="save-btn"
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
                  <!-- Quick Review / Promote Actions -->
                  <div class="admin-venues__quick-actions">
                    <button
                      v-if="(venue.verificationState || 'unverified') === 'unverified'"
                      type="button"
                      class="admin-venues__btn-quick admin-venues__btn-quick--verify"
                      title="Promote to Verified"
                      data-testid="promote-verified-btn"
                      @click="handlePromoteState(venue, 'verified')"
                    >
                      Verify
                    </button>
                    <button
                      v-if="venue.verificationState === 'verified'"
                      type="button"
                      class="admin-venues__btn-quick admin-venues__btn-quick--canonical"
                      title="Promote to Canonical"
                      data-testid="promote-canonical-btn"
                      @click="handlePromoteState(venue, 'canonical')"
                    >
                      👑 Canonical
                    </button>
                    <button
                      v-if="venue.verificationState !== 'flagged'"
                      type="button"
                      class="admin-venues__btn-quick admin-venues__btn-quick--flag"
                      title="Flag Venue for Review"
                      data-testid="flag-venue-btn"
                      @click="handlePromoteState(venue, 'flagged')"
                    >
                      Flag
                    </button>
                    <button
                      v-if="venue.verificationState === 'flagged'"
                      type="button"
                      class="admin-venues__btn-quick admin-venues__btn-quick--unflag"
                      title="Reset to Unverified"
                      data-testid="unflag-venue-btn"
                      @click="handlePromoteState(venue, 'unverified')"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      class="admin-venues__btn admin-venues__btn--edit"
                      data-testid="edit-btn"
                      @click="startEdit(venue)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="admin-venues__btn admin-venues__btn--delete"
                      data-testid="delete-btn"
                      @click="handleDelete(venue)"
                    >
                      Delete
                    </button>
                  </div>
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
  margin-bottom: 1.5rem;
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

.admin-venues__select-filter,
.admin-venues__select {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  background-color: var(--surface);
  color: var(--text);
}

/* Metrics Ribbon */
.admin-venues__metrics-ribbon {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.admin-venues__metric-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.85rem;
  border-radius: 999px;
  font-size: 0.85rem;
  background-color: var(--surface-soft);
  border: 1px solid var(--border);
  cursor: pointer;
  color: var(--text);
  transition: all 0.2s;
}

.admin-venues__metric-pill:hover {
  background-color: var(--border);
}

.admin-venues__metric-pill--active {
  border-color: var(--primary);
  font-weight: 600;
  box-shadow: 0 0 0 1px var(--primary);
}

.admin-venues__metric-pill--canonical strong {
  color: #6d28d9;
}
.admin-venues__metric-pill--verified strong {
  color: #047857;
}
.admin-venues__metric-pill--unverified strong {
  color: #b45309;
}
.admin-venues__metric-pill--flagged strong {
  color: #b91c1c;
}

/* Verification Badges */
.admin-venues__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.admin-venues__badge--canonical {
  background-color: #f3e8ff;
  color: #6b21a8;
  border: 1px solid #d8b4fe;
}

.admin-venues__badge--verified {
  background-color: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.admin-venues__badge--unverified {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.admin-venues__badge--flagged {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
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

.admin-venues__field input,
.admin-venues__field select {
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  background-color: var(--surface-soft);
  color: var(--text);
  transition: border-color 0.2s, background-color 0.2s;
}

.admin-venues__field input:focus,
.admin-venues__field select:focus {
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
  padding: 1rem 1.15rem;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-venues__table td {
  padding: 0.9rem 1.15rem;
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

.admin-venues__table-input--sub {
  margin-bottom: 0.35rem;
}

.admin-venues__table-select {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--primary);
  border-radius: 4px;
  font-size: 0.85rem;
}

.admin-venues__subtext {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

.admin-venues__subtext--warning {
  color: #b45309;
}

.admin-venues__capacity {
  font-weight: 500;
  font-size: 0.85rem;
}

.admin-venues__code {
  font-family: monospace;
  background-color: var(--surface-soft);
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  font-size: 0.8rem;
  border: 1px solid var(--border);
  color: var(--text-muted);
  display: inline-block;
  margin-right: 0.3rem;
}

/* Quick review buttons */
.admin-venues__quick-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.admin-venues__btn-quick {
  padding: 0.3rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.admin-venues__btn-quick--verify {
  background-color: #ecfdf5;
  color: #065f46;
  border-color: #a7f3d0;
}
.admin-venues__btn-quick--verify:hover {
  background-color: #d1fae5;
}

.admin-venues__btn-quick--canonical {
  background-color: #f3e8ff;
  color: #6b21a8;
  border-color: #d8b4fe;
}
.admin-venues__btn-quick--canonical:hover {
  background-color: #e9d5ff;
}

.admin-venues__btn-quick--flag {
  background-color: #fef2f2;
  color: #b91c1c;
  border-color: #fca5a5;
}
.admin-venues__btn-quick--flag:hover {
  background-color: #fee2e2;
}

.admin-venues__btn-quick--unflag {
  background-color: #fef3c7;
  color: #92400e;
  border-color: #fde68a;
}
.admin-venues__btn-quick--unflag:hover {
  background-color: #fde68a;
}

/* Buttons */
.admin-venues__btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
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
  padding: 0.5rem 1.1rem;
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
