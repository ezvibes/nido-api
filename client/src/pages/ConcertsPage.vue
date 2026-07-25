<template>
  <section class="concerts-page">
    <header class="concerts-page__hero">
      <div class="concerts-page__hero-overlay">
        <p class="concerts-page__eyebrow">EZ Vibes live music discovery</p>
        <h2>Concerts</h2>
      </div>
    </header>

    <p v-if="pageMessage" :class="pageMessageClass">{{ pageMessage }}</p>

    <IngestionUploadPanel v-if="user" />

    <ConcertFiltersBar
      :search-text="searchText"
      :date-range="dateRange"
      :sort="sort"
      :source="source"
      @update:search-text="searchText = $event"
      @update:date-range="dateRange = $event"
      @update:sort="sort = $event"
      @update:source="source = $event"
    />

    <section class="concerts-page__results">
      <div>
        <p class="concerts-page__results-label">
          {{ filteredConcerts.length }} concerts
        </p>
        <p class="concerts-page__results-subtitle">
          {{ isLoadingConcerts ? 'Loading upcoming concerts…' : sortSummary }}
        </p>
      </div>
      <button class="button-secondary" type="button" @click="clearFilters">
        Reset filters
      </button>
    </section>

    <section v-if="filteredConcerts.length" class="concerts-page__list">
      <ConcertCard
        v-for="concert in filteredConcerts"
        :key="concert.id"
        :concert="concert"
        :is-upvoting="upvotingConcertIds.has(concert.id)"
        :can-upvote="Boolean(user) && isPersistedConcert(concert)"
        @toggle-upvote="handleToggleUpvote"
      />
    </section>

    <section v-else class="concerts-page__empty">
      <template v-if="concertsLoadError">
        <h2>Unable to load concerts.</h2>
        <p>{{ concertsLoadError }}</p>
        <button
          class="button-secondary"
          type="button"
          @click="loadPersistedConcerts"
        >
          Try again
        </button>
      </template>
      <template v-else>
        <h2>No shows match those filters.</h2>
        <p>Try a different city, band, venue, or date range.</p>
      </template>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ConcertCard from '../components/concerts/ConcertCard.vue';
import ConcertFiltersBar from '../components/concerts/ConcertFiltersBar.vue';
import IngestionUploadPanel from '../components/ingestion/IngestionUploadPanel.vue';
import { useConcertFilters } from '../composables/useConcertFilters';
import {
  fetchConcerts,
  removeConcertUpvote,
  upvoteConcert,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';
import { mapConcertToListItem, type ConcertListItem } from '../types/concerts';

const { user } = useAuth();

const persistedConcerts = ref<ConcertListItem[]>([]);
const upvotingConcertIds = ref(new Set<string>());
const hasLoadedPersistedConcerts = ref(false);
const isLoadingConcerts = ref(false);
const concertsLoadError = ref('');
let latestConcertsRequest = 0;
const { searchText, dateRange, sort, source, filteredConcerts, clearFilters } =
  useConcertFilters(persistedConcerts);

const pageMessage = ref('');
const pageMessageType = ref<'success' | 'error'>('success');

const sortSummary = computed(() =>
  sort.value === 'soonest'
    ? 'Sorted by earliest upcoming start time.'
    : sort.value === 'trending_week'
      ? 'Sorted by upvotes from the last seven days.'
      : 'Sorted by featured priority.',
);

const pageMessageClass = computed(() =>
  pageMessageType.value === 'success'
    ? 'concerts-page__message concerts-page__message--success'
    : 'concerts-page__message concerts-page__message--error',
);

const isPersistedConcert = (concert: ConcertListItem) =>
  !concert.id.startsWith('concert-preview-');

const setUpvoting = (concertId: string, isUpvoting: boolean) => {
  const next = new Set(upvotingConcertIds.value);
  if (isUpvoting) {
    next.add(concertId);
  } else {
    next.delete(concertId);
  }
  upvotingConcertIds.value = next;
};

const updateConcertEngagement = (
  concertId: string,
  engagement: Pick<
    ConcertListItem,
    'upvoteCount' | 'upvotedByMe' | 'trendingWeekUpvotes'
  >,
) => {
  const applyEngagement = (concert: ConcertListItem): ConcertListItem =>
    concert.id === concertId
      ? {
          ...concert,
          upvoteCount: engagement.upvoteCount,
          upvotedByMe: engagement.upvotedByMe,
          trendingWeekUpvotes: engagement.trendingWeekUpvotes,
        }
      : concert;

  persistedConcerts.value = persistedConcerts.value.map(applyEngagement);
};

const loadPersistedConcerts = async () => {
  const requestId = ++latestConcertsRequest;
  isLoadingConcerts.value = true;
  pageMessage.value = '';
  concertsLoadError.value = '';

  try {
    const token = user.value ? await user.value.getIdToken() : undefined;

    if (requestId !== latestConcertsRequest) {
      return;
    }

    const response = await fetchConcerts(token, {
      sort: sort.value,
      startsAfter: new Date().toISOString(),
      pageSize: 100,
    });

    if (requestId !== latestConcertsRequest) {
      return;
    }

    const concerts = Array.isArray(response?.data) ? response.data : [];
    persistedConcerts.value = concerts.map((concert) =>
      mapConcertToListItem(concert, {
        posterUrl:
          concert.posterUrl ??
          'https://placehold.co/720x900/e6ece4/31453a?text=Concert',
        sourceLabel: 'Concerts DB',
        displayTags: [concert.genre, 'saved'],
      }),
    );
    hasLoadedPersistedConcerts.value = true;
  } catch {
    if (requestId !== latestConcertsRequest) {
      return;
    }

    persistedConcerts.value = [];
    hasLoadedPersistedConcerts.value = true;
    concertsLoadError.value =
      'Unable to load upcoming concerts right now. Please try again.';
  } finally {
    if (requestId === latestConcertsRequest) {
      isLoadingConcerts.value = false;
    }
  }
};

const handleConcertsChanged = () => {
  void loadPersistedConcerts();
};

const handleToggleUpvote = async (concert: ConcertListItem) => {
  if (
    !user.value ||
    !isPersistedConcert(concert) ||
    upvotingConcertIds.value.has(concert.id)
  ) {
    return;
  }

  const nextEngagement = {
    upvoteCount: Math.max(
      0,
      (concert.upvoteCount ?? 0) + (concert.upvotedByMe ? -1 : 1),
    ),
    upvotedByMe: !concert.upvotedByMe,
    trendingWeekUpvotes: Math.max(
      0,
      (concert.trendingWeekUpvotes ?? 0) + (concert.upvotedByMe ? -1 : 1),
    ),
  };

  updateConcertEngagement(concert.id, nextEngagement);

  setUpvoting(concert.id, true);

  try {
    const token = await user.value.getIdToken();
    const engagement = concert.upvotedByMe
      ? await removeConcertUpvote(token, concert.id)
      : await upvoteConcert(token, concert.id);
    updateConcertEngagement(concert.id, engagement);
  } catch {
    updateConcertEngagement(concert.id, {
      upvoteCount: concert.upvoteCount ?? 0,
      upvotedByMe: concert.upvotedByMe ?? false,
      trendingWeekUpvotes: concert.trendingWeekUpvotes ?? 0,
    });
    pageMessageType.value = 'error';
    pageMessage.value = 'Unable to update your upvote right now.';
  } finally {
    setUpvoting(concert.id, false);
  }
};

watch(
  user,
  () => {
    void loadPersistedConcerts();
  },
  { immediate: true },
);

watch(sort, (nextSort) => {
  if (nextSort === 'trending_week' && hasLoadedPersistedConcerts.value) {
    void loadPersistedConcerts();
  }
});

onMounted(() => {
  window.addEventListener('concerts:changed', handleConcertsChanged);
});

onBeforeUnmount(() => {
  window.removeEventListener('concerts:changed', handleConcertsChanged);
});
</script>

<style scoped>
.concerts-page {
  display: grid;
  gap: 1.5rem;
}

.concerts-page__hero {
  display: grid;
  place-items: center;
  min-height: clamp(19rem, 38vw, 30rem);
  overflow: hidden;
  border-radius: 1.2rem;
  background:
    linear-gradient(135deg, rgba(16, 28, 21, 0.28), rgba(16, 28, 21, 0.72)),
    url('https://cb68d5340ef83a9d76eb.cdn6.editmysite.com/uploads/b/cb68d5340ef83a9d76eb36aa80e24b2ce574c25effd71d09013454911b4684ee/IMG_0418%202_1755022409.jpg?width=2400&optimize=medium');
  background-position: center;
  background-size: cover;
  box-shadow: inset 0 0 8rem rgba(0, 0, 0, 0.38);
  border: 1px solid var(--border);
}

.concerts-page__hero-overlay {
  width: 100%;
  box-sizing: border-box;
  padding: 1.25rem;
  color: #fff;
  text-align: center;
}

.concerts-page__hero h2 {
  margin: 0;
  font-family: 'Avenir Next', 'Helvetica Neue', Helvetica, sans-serif;
  font-size: clamp(1.75rem, 4.4vw, 3.35rem);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.concerts-page__results p,
.concerts-page__empty h2,
.concerts-page__empty p {
  margin: 0;
}

.concerts-page__eyebrow {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.76);
  margin: 0 0 0.45rem;
}

.button-secondary {
  border-radius: 999px;
  padding: 0.75rem 1.1rem;
  font-weight: 600;
}

.button-secondary {
  border: 1px solid var(--border);
  background: white;
  color: var(--text-dark);
}

.concerts-page__results {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.concerts-page__results-label {
  font-size: 0.95rem;
  font-weight: 700;
}

.concerts-page__message {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 0.8rem;
  border: 1px solid var(--border);
}

.concerts-page__message--success {
  background: rgba(40, 93, 51, 0.08);
  color: #285d33;
}

.concerts-page__message--error {
  background: rgba(180, 35, 24, 0.08);
  color: #b42318;
}

.concerts-page__results-subtitle {
  color: var(--text-light);
}

.concerts-page__list {
  display: grid;
  gap: 1.25rem;
}

.concerts-page__empty {
  padding: 2.5rem 1.5rem;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.6);
}

.concerts-page__empty p {
  margin-top: 0.45rem;
  color: var(--text-light);
}

@media (min-width: 760px) {
  .concerts-page__hero h2 {
    font-size: clamp(2.05rem, 4.1vw, 3.25rem);
    white-space: nowrap;
  }
}

@media (max-width: 759px) {
  .concerts-page__results {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
