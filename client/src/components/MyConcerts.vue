<template>
  <div class="my-concerts-container">
    <h2>My Concerts</h2>

    <p v-if="loading" class="state-text">Loading your concerts...</p>
    <p v-else-if="error" class="state-text state-text--error">{{ error }}</p>

    <div v-else-if="concerts.length" class="concert-list">
      <article v-for="concert in concerts" :key="concert.id" class="concert-card">
        <div class="concert-card__header">
          <h3>{{ concert.title }}</h3>
          <span class="genre-chip">{{ concert.genre }}</span>
        </div>
        <p class="concert-meta">{{ formatDate(concert.startsAt) }}</p>
        <p class="concert-meta">{{ formatVenue(concert.venues) }}</p>
        <p v-if="concert.artists.length" class="concert-meta">
          {{ formatArtists(concert.artists) }}
        </p>
        <p v-if="concert.description" class="concert-description">{{ concert.description }}</p>
      </article>
    </div>

    <p v-else class="state-text">
      No concerts yet. Once you add one, it will show up here after you log in.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { fetchUserConcerts } from '../composables/useApi';

interface ConcertVenue {
  name: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ConcertArtist {
  name: string;
  role?: string;
  genre?: string;
}

interface ConcertItem {
  id: string;
  title: string;
  genre: string;
  startsAt: string;
  endsAt?: string | null;
  venues: ConcertVenue[];
  artists: ConcertArtist[];
  description?: string | null;
}

const { user } = useAuth();

const concerts = ref<ConcertItem[]>([]);
const loading = ref(false);
const error = ref('');

const loadConcerts = async () => {
  if (!user.value) {
    concerts.value = [];
    error.value = '';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const token = await user.value.getIdToken();
    const response = await fetchUserConcerts(token);
    concerts.value = Array.isArray(response?.data) ? response.data : [];
  } catch {
    error.value = 'Unable to load your concerts right now.';
  } finally {
    loading.value = false;
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

const formatVenue = (venues: ConcertVenue[]) => {
  const primaryVenue = venues[0];
  if (!primaryVenue) {
    return 'Venue TBD';
  }

  const location = [primaryVenue.city, primaryVenue.state].filter(Boolean).join(', ');
  return location ? `${primaryVenue.name} • ${location}` : primaryVenue.name;
};

const formatArtists = (artists: ConcertArtist[]) =>
  artists.slice(0, 3).map((artist) => artist.name).join(', ');

watch(user, () => {
  void loadConcerts();
}, { immediate: true });
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

.state-text {
  margin-top: 1rem;
  color: var(--text-light);
}

.state-text--error {
  color: #b42318;
}
</style>
