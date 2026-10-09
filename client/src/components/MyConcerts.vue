<template>
  <div class="my-concerts-container">
    <h2>My Concerts</h2>

    <p v-if="loading" class="state-text">Loading your concerts...</p>
    <p v-else-if="error" class="state-text state-text--error">{{ error }}</p>

    <div v-else-if="concerts.length" class="concert-list">
      <article
        v-for="concert in concerts"
        :key="concert.id"
        class="concert-card"
      >
        <div class="concert-card__header">
          <h3>{{ concert.title }}</h3>
          <span class="genre-chip">{{ concert.genre }}</span>
        </div>
        <p class="concert-meta">
          {{ concert.isAdminApproved ? 'Approved' : 'Pending approval' }}
        </p>
        <p class="concert-meta">{{ formatDate(concert.startsAt) }}</p>
        <p class="concert-meta">{{ formatVenue(concert.venue) }}</p>
        <p v-if="concert.lineup.length" class="concert-meta">
          {{ formatLineup(concert.lineup) }}
        </p>
        <p v-if="concert.description" class="concert-description">
          {{ concert.description }}
        </p>
      </article>
      <button
        v-if="concerts.length < total"
        type="button"
        class="load-more"
        :disabled="loadingMore"
        @click="loadConcerts(page + 1)"
      >
        {{ loadingMore ? 'Loading...' : 'Load more' }}
      </button>
      <p v-if="loadMoreError" class="state-text state-text--error">
        {{ loadMoreError }}
      </p>
    </div>

    <p v-else class="state-text">
      No concerts yet. Once you add one, it will show up here after you log in.
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { fetchUserConcerts } from '../composables/useApi';
import type {
  ConcertApiItem,
  ConcertLineupEntry,
  ConcertVenue,
} from '../types/concerts';

const { user } = useAuth();

const concerts = ref<ConcertApiItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const loadMoreError = ref('');
const page = ref(1);
const total = ref(0);
let requestGeneration = 0;

const loadConcerts = async (nextPage = 1) => {
  const currentUser = user.value;
  if (!currentUser) return;
  const append = nextPage > 1;
  if (append && (loading.value || loadingMore.value)) return;
  const requestId = ++requestGeneration;
  if (append) loadingMore.value = true;
  else {
    loading.value = true;
    loadingMore.value = false;
    loadMoreError.value = '';
  }
  if (append) loadMoreError.value = '';
  else error.value = '';

  try {
    const token = await currentUser.getIdToken();
    if (requestId !== requestGeneration || user.value !== currentUser) return;
    const response = await fetchUserConcerts(token, {
      sort: 'recently_added',
      page: nextPage,
      pageSize: 20,
    });
    if (requestId !== requestGeneration || user.value !== currentUser) return;
    const results = Array.isArray(response?.data) ? response.data : [];
    concerts.value = append ? [...concerts.value, ...results] : results;
    page.value = response.page;
    total.value = response.total;
  } catch {
    if (requestId !== requestGeneration) return;
    if (append) loadMoreError.value = 'Unable to load more concerts right now.';
    else error.value = 'Unable to load your concerts right now.';
  } finally {
    if (requestId === requestGeneration) {
      if (append) loadingMore.value = false;
      else loading.value = false;
    }
  }
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const formatVenue = (venue?: ConcertVenue | null) => {
  if (!venue) {
    return 'Venue TBD';
  }

  const location = [venue.city, venue.region].filter(Boolean).join(', ');
  return location ? `${venue.name} • ${location}` : venue.name;
};

const formatLineup = (lineup: ConcertLineupEntry[]) =>
  lineup
    .slice(0, 3)
    .map((entry) => entry.band.name)
    .join(', ');

const handleConcertsChanged = () => {
  void loadConcerts();
};

watch(
  user,
  () => {
    requestGeneration += 1;
    concerts.value = [];
    total.value = 0;
    page.value = 1;
    loading.value = false;
    loadingMore.value = false;
    error.value = '';
    loadMoreError.value = '';
    void loadConcerts();
  },
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('concerts:changed', handleConcertsChanged);
});

onBeforeUnmount(() => {
  window.removeEventListener('concerts:changed', handleConcertsChanged);
});
</script>

<style scoped>
.my-concerts-container {
  margin-top: 2rem;
  padding: 2rem;
  background-color: var(--card-bg);
  border-radius: 0.75rem;
  border: 1px solid var(--border);
}

.concert-list {
  display: grid;
  gap: 1rem;
  margin-top: 1.5rem;
}

.concert-card {
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--background);
}

.concert-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.concert-card__header h3 {
  margin: 0;
}

.genre-chip {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--secondary-bg);
  font-size: 0.8rem;
  text-transform: uppercase;
}

.concert-meta {
  margin: 0.5rem 0 0;
  color: var(--text-light);
}

.concert-description {
  margin: 0.75rem 0 0;
}

.load-more {
  justify-self: start;
  padding: 0.65rem 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  color: inherit;
  cursor: pointer;
}

.load-more:disabled {
  cursor: wait;
  opacity: 0.65;
}

.state-text {
  margin-top: 1rem;
  color: var(--text-light);
}

.state-text--error {
  color: #b42318;
}
</style>
