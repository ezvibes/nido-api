<template>
  <div
    class="onboarding-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
  >
    <div class="onboarding-modal">
      <p class="onboarding-modal__eyebrow">Welcome to EZ Vibes</p>
      <h2 id="onboarding-title">
        Are you posting shows for a venue or discovering live music?
      </h2>
      <p class="onboarding-modal__subtitle">
        Claim your venue to pre-fill poster uploads and highlight your partner
        submissions, or continue as a fan.
      </p>

      <div class="onboarding-modal__search-block">
        <label for="venue-claim-search">Find your venue</label>
        <input
          id="venue-claim-search"
          v-model="searchQuery"
          type="search"
          placeholder="Search venues (e.g. Bowstring)"
          :disabled="isSubmitting"
        />

        <p v-if="isLoadingVenues" class="onboarding-modal__status">
          Loading venues…
        </p>
        <p v-else-if="loadError" class="onboarding-modal__error">
          {{ loadError }}
        </p>
        <ul v-else-if="filteredVenues.length" class="onboarding-modal__list">
          <li v-for="venue in filteredVenues" :key="venue.id">
            <button
              type="button"
              class="onboarding-modal__venue-option"
              :class="{
                'onboarding-modal__venue-option--selected':
                  selectedVenueId === venue.id,
              }"
              :disabled="isSubmitting"
              @click="selectedVenueId = venue.id"
            >
              <strong>{{ venue.name }}</strong>
              <span>{{ venue.city }}, {{ venue.region }}</span>
            </button>
          </li>
        </ul>
        <p v-else class="onboarding-modal__status">
          No matching venues found. Try another search or skip as a fan.
        </p>
      </div>

      <p v-if="submitError" class="onboarding-modal__error">
        {{ submitError }}
      </p>

      <div class="onboarding-modal__actions">
        <button
          type="button"
          class="btn-claim"
          :disabled="!selectedVenueId || isSubmitting"
          @click="handleClaimVenue"
        >
          {{ isSubmitting ? 'Saving…' : 'Claim Venue & Continue' }}
        </button>
        <button
          type="button"
          class="btn-skip"
          :disabled="isSubmitting"
          @click="handleSkipAsFan"
        >
          I'm discovering live music (Skip)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchVenues, type VenueListItem } from '../../composables/useApi';
import { useAuth } from '../../composables/useAuth';

const { completeOnboarding, getIdToken } = useAuth();

const venues = ref<VenueListItem[]>([]);
const searchQuery = ref('');
const selectedVenueId = ref<string | null>(null);
const isLoadingVenues = ref(false);
const loadError = ref('');
const isSubmitting = ref(false);
const submitError = ref('');

const filteredVenues = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const list = query
    ? venues.value.filter(
        (venue) =>
          venue.name.toLowerCase().includes(query) ||
          venue.city.toLowerCase().includes(query),
      )
    : venues.value;
  return list.slice(0, 8);
});

const loadVenues = async () => {
  isLoadingVenues.value = true;
  loadError.value = '';
  try {
    const token = await getIdToken();
    venues.value = await fetchVenues(token);
  } catch (error) {
    console.error('Failed to load venues for onboarding:', error);
    loadError.value = 'Unable to load venues right now. You can still skip and continue.';
  } finally {
    isLoadingVenues.value = false;
  }
};

const handleClaimVenue = async () => {
  if (!selectedVenueId.value) {
    return;
  }
  isSubmitting.value = true;
  submitError.value = '';
  try {
    await completeOnboarding({ claimedVenueId: selectedVenueId.value });
  } catch (error) {
    console.error('Failed to claim venue:', error);
    submitError.value = 'Could not save your venue claim. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

const handleSkipAsFan = async () => {
  isSubmitting.value = true;
  submitError.value = '';
  try {
    await completeOnboarding({ skipAsFan: true });
  } catch (error) {
    console.error('Failed to complete onboarding:', error);
    submitError.value = 'Could not complete onboarding. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  void loadVenues();
});
</script>

<style scoped>
.onboarding-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.onboarding-modal {
  width: 100%;
  max-width: 520px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 1rem;
  padding: 1.75rem;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
}

.onboarding-modal__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primary, #2563eb);
}

.onboarding-modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  line-height: 1.25;
}

.onboarding-modal__subtitle {
  margin: 0 0 1.25rem;
  color: var(--text-light, #475569);
  line-height: 1.5;
}

.onboarding-modal__search-block label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}

.onboarding-modal__search-block input {
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 0.5rem;
  font-size: 0.95rem;
  box-sizing: border-box;
}

.onboarding-modal__list {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  display: grid;
  gap: 0.45rem;
}

.onboarding-modal__venue-option {
  width: 100%;
  text-align: left;
  padding: 0.65rem 0.85rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border, #e2e8f0);
  background: var(--background, #f8fafc);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.onboarding-modal__venue-option--selected {
  border-color: var(--primary, #2563eb);
  background: rgba(37, 99, 235, 0.08);
}

.onboarding-modal__venue-option span {
  color: var(--text-light, #64748b);
  font-size: 0.85rem;
}

.onboarding-modal__status {
  margin: 0.75rem 0 0;
  color: var(--text-light, #64748b);
  font-size: 0.9rem;
}

.onboarding-modal__error {
  margin: 0.75rem 0 0;
  color: #b91c1c;
  font-size: 0.9rem;
}

.onboarding-modal__actions {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-claim {
  padding: 0.8rem 1.25rem;
  border-radius: 9999px;
  border: none;
  background: var(--primary, #2563eb);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.btn-claim:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-skip {
  padding: 0.75rem 1.25rem;
  border-radius: 9999px;
  border: 1px solid var(--border, #cbd5e1);
  background: transparent;
  color: var(--text-dark, #0f172a);
  font-weight: 600;
  cursor: pointer;
}
</style>
