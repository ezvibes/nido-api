<template>
  <section class="events-page">
    <header class="events-page__hero">
      <div class="events-page__hero-overlay">
        <p class="events-page__eyebrow">EZ Vibes intake</p>
        <h2>Add Your Concert Poster</h2>
      </div>
    </header>

    <p v-if="pageMessage" :class="pageMessageClass">{{ pageMessage }}</p>

    <section v-if="showAddForm" class="add-show-panel">
      <div class="add-show-panel__header">
        <h2>Add a show</h2>
        <p>
          Create a concert for your account and preview it here in the concert
          feed.
        </p>
      </div>

      <form class="add-show-panel__form" @submit.prevent="handleSubmit">
        <label>
          <span>Title</span>
          <input
            v-model="form.title"
            type="text"
            placeholder="Artist or lineup name"
          />
        </label>
        <label>
          <span>Genre</span>
          <input
            v-model="form.genre"
            type="text"
            placeholder="rock, indie, jazz"
          />
        </label>
        <label>
          <span>Artist / Lineup</span>
          <input v-model="form.artistName" type="text" placeholder="Duck" />
        </label>
        <label>
          <span>Venue</span>
          <input
            v-model="form.venueName"
            type="text"
            placeholder="Venue name"
          />
        </label>
        <label>
          <span>City</span>
          <input v-model="form.city" type="text" placeholder="Raleigh" />
        </label>
        <label>
          <span>State</span>
          <select v-model="form.state">
            <option value="NC">NC</option>
            <option value="SC">SC</option>
          </select>
        </label>
        <label>
          <span>Date</span>
          <input v-model="form.date" type="date" />
        </label>
        <label>
          <span>Time</span>
          <input v-model="form.time" type="time" />
        </label>
        <label>
          <span>Poster URL</span>
          <input
            v-model="form.posterUrl"
            type="url"
            placeholder="https://..."
          />
        </label>
        <label class="add-show-panel__full">
          <span>Description</span>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Optional notes for the event card"
          ></textarea>
        </label>
        <p v-if="submitMessage" :class="submitMessageClass">
          {{ submitMessage }}
        </p>
        <div class="add-show-panel__actions">
          <button type="button" class="button-secondary" @click="toggleAddForm">
            Cancel
          </button>
          <button
            type="submit"
            class="button-primary"
            :disabled="isSubmitDisabled"
          >
            {{ isSubmitting ? 'Saving…' : 'Save show' }}
          </button>
        </div>
      </form>
    </section>

    <IngestionUploadPanel />

    <EventFiltersBar
      :search-text="searchText"
      :date-range="dateRange"
      :sort="sort"
      :source="source"
      @update:search-text="searchText = $event"
      @update:date-range="dateRange = $event"
      @update:sort="sort = $event"
      @update:source="source = $event"
    />

    <section class="events-page__results">
      <div>
        <p class="events-page__results-label">
          {{ filteredEvents.length }} shows
        </p>
        <p class="events-page__results-subtitle">
          {{
            isLoadingEvents
              ? 'Loading saved concerts from the database…'
              : sortSummary
          }}
        </p>
      </div>
      <button class="button-secondary" type="button" @click="clearFilters">
        Reset filters
      </button>
    </section>

    <section v-if="filteredEvents.length" class="events-page__list">
      <EventCard
        v-for="event in filteredEvents"
        :key="event.id"
        :event="event"
        :is-upvoting="upvotingEventIds.has(event.id)"
        :can-upvote="isPersistedConcert(event)"
        @toggle-upvote="handleToggleUpvote"
      />
    </section>

    <section v-else class="events-page__empty">
      <template v-if="eventsLoadError">
        <h2>Unable to load concerts.</h2>
        <p>{{ eventsLoadError }}</p>
      </template>
      <template v-else>
        <h2>No shows match those filters.</h2>
        <p>Try a different city, band, venue, or date range.</p>
      </template>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import EventCard from '../components/events/EventCard.vue';
import EventFiltersBar from '../components/events/EventFiltersBar.vue';
import IngestionUploadPanel from '../components/ingestion/IngestionUploadPanel.vue';
import { useEventFilters } from '../composables/useEventFilters';
import {
  createConcert,
  fetchConcerts,
  removeConcertUpvote,
  upvoteConcert,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';
import { mapConcertToEventListItem, type EventListItem } from '../types/events';

const { user } = useAuth();

const persistedEvents = ref<EventListItem[]>([]);
const upvotingEventIds = ref(new Set<string>());
const hasLoadedPersistedEvents = ref(false);
const isLoadingEvents = ref(false);
const eventsLoadError = ref('');
const { searchText, dateRange, sort, source, filteredEvents, clearFilters } =
  useEventFilters(persistedEvents);

const showAddForm = ref(false);
const isSubmitting = ref(false);
const submitMessage = ref('');
const submitMessageType = ref<'success' | 'error'>('success');
const pageMessage = ref('');
const pageMessageType = ref<'success' | 'error'>('success');

const form = reactive({
  title: '',
  genre: '',
  artistName: '',
  venueName: '',
  city: '',
  state: 'NC',
  date: '',
  time: '19:00',
  posterUrl: '',
  description: '',
});

const sortSummary = computed(() =>
  sort.value === 'soonest'
    ? 'Sorted by earliest upcoming start time.'
    : sort.value === 'trending_week'
      ? 'Sorted by upvotes from the last seven days.'
      : 'Sorted by featured priority.',
);

const isSubmitDisabled = computed(
  () =>
    isSubmitting.value ||
    !form.title.trim() ||
    !form.genre.trim() ||
    !form.artistName.trim() ||
    !form.venueName.trim() ||
    !form.date ||
    !form.time,
);

const submitMessageClass = computed(() =>
  submitMessageType.value === 'success'
    ? 'add-show-panel__message add-show-panel__message--success'
    : 'add-show-panel__message add-show-panel__message--error',
);

const pageMessageClass = computed(() =>
  pageMessageType.value === 'success'
    ? 'events-page__message events-page__message--success'
    : 'events-page__message events-page__message--error',
);

const toggleAddForm = () => {
  showAddForm.value = !showAddForm.value;
  submitMessage.value = '';
};

const resetForm = () => {
  form.title = '';
  form.genre = '';
  form.artistName = '';
  form.venueName = '';
  form.city = '';
  form.state = 'NC';
  form.date = '';
  form.time = '19:00';
  form.posterUrl = '';
  form.description = '';
};

const buildStartsAt = () => {
  const localDate = new Date(`${form.date}T${form.time}`);
  return localDate.toISOString();
};

const isPersistedConcert = (event: EventListItem) =>
  !event.id.startsWith('evt-');

const setUpvoting = (eventId: string, isUpvoting: boolean) => {
  const next = new Set(upvotingEventIds.value);
  if (isUpvoting) {
    next.add(eventId);
  } else {
    next.delete(eventId);
  }
  upvotingEventIds.value = next;
};

const updateEventEngagement = (
  eventId: string,
  engagement: Pick<
    EventListItem,
    'upvoteCount' | 'upvotedByMe' | 'trendingWeekUpvotes'
  >,
) => {
  const applyEngagement = (event: EventListItem): EventListItem =>
    event.id === eventId
      ? {
          ...event,
          upvoteCount: engagement.upvoteCount,
          upvotedByMe: engagement.upvotedByMe,
          trendingWeekUpvotes: engagement.trendingWeekUpvotes,
        }
      : event;

  persistedEvents.value = persistedEvents.value.map(applyEngagement);
};

const loadPersistedEvents = async () => {
  if (!user.value) {
    persistedEvents.value = [];
    hasLoadedPersistedEvents.value = false;
    isLoadingEvents.value = false;
    eventsLoadError.value = '';
    return;
  }

  isLoadingEvents.value = true;
  pageMessage.value = '';
  eventsLoadError.value = '';

  try {
    const token = await user.value.getIdToken();
    const response = await fetchConcerts(token, {
      sort: sort.value,
      startsAfter: new Date().toISOString(),
      pageSize: 100,
    });
    const concerts = Array.isArray(response?.data) ? response.data : [];
    persistedEvents.value = concerts.map((concert) =>
      mapConcertToEventListItem(concert, {
        posterUrl: concert.posterUrl ?? 'https://placehold.co/720x900/e6ece4/31453a?text=DB+Show',
        sourceLabel: 'Concerts DB',
        displayTags: [concert.genre, 'saved'],
      }),
    );
    hasLoadedPersistedEvents.value = true;
  } catch {
    persistedEvents.value = [];
    hasLoadedPersistedEvents.value = true;
    eventsLoadError.value =
      'Unable to load saved concerts from the database right now.';
  } finally {
    isLoadingEvents.value = false;
  }
};

const handleConcertsChanged = () => {
  void loadPersistedEvents();
};

const handleToggleUpvote = async (event: EventListItem) => {
  if (
    !user.value ||
    !isPersistedConcert(event) ||
    upvotingEventIds.value.has(event.id)
  ) {
    return;
  }

  const nextEngagement = {
    upvoteCount: Math.max(
      0,
      (event.upvoteCount ?? 0) + (event.upvotedByMe ? -1 : 1),
    ),
    upvotedByMe: !event.upvotedByMe,
    trendingWeekUpvotes: Math.max(
      0,
      (event.trendingWeekUpvotes ?? 0) + (event.upvotedByMe ? -1 : 1),
    ),
  };

  updateEventEngagement(event.id, nextEngagement);

  setUpvoting(event.id, true);

  try {
    const token = await user.value.getIdToken();
    const engagement = event.upvotedByMe
      ? await removeConcertUpvote(token, event.id)
      : await upvoteConcert(token, event.id);
    updateEventEngagement(event.id, engagement);
  } catch {
    updateEventEngagement(event.id, {
      upvoteCount: event.upvoteCount ?? 0,
      upvotedByMe: event.upvotedByMe ?? false,
      trendingWeekUpvotes: event.trendingWeekUpvotes ?? 0,
    });
    pageMessageType.value = 'error';
    pageMessage.value = 'Unable to update your upvote right now.';
  } finally {
    setUpvoting(event.id, false);
  }
};

const handleSubmit = async () => {
  if (!user.value || isSubmitDisabled.value) {
    return;
  }

  isSubmitting.value = true;
  submitMessage.value = '';
  pageMessage.value = '';

  try {
    const token = await user.value.getIdToken();
    const concert = await createConcert(token, {
      title: form.title.trim(),
      genre: form.genre.trim(),
      startsAt: buildStartsAt(),
      venues: [
        {
          name: form.venueName.trim(),
          city: form.city.trim() || undefined,
          state: form.state || undefined,
        },
      ],
      artists: [
        {
          name: form.artistName.trim(),
          role: 'headliner',
          genre: form.genre.trim(),
        },
      ],
      description: form.description.trim() || undefined,
    });

    persistedEvents.value = [
      mapConcertToEventListItem(concert, {
        posterUrl:
          form.posterUrl.trim() ||
          'https://placehold.co/720x900/e6ece4/31453a?text=New+Show',
        sourceLabel: 'Your submission',
        displayTags: [form.genre.trim(), 'new', 'my concert'],
      }),
      ...persistedEvents.value,
    ];

    submitMessageType.value = 'success';
    submitMessage.value =
      'Show saved. It should also appear on your My Concerts home feed.';
    pageMessageType.value = 'success';
    pageMessage.value = 'New show saved and added to the concert feed.';
    window.dispatchEvent(new CustomEvent('concerts:changed'));
    resetForm();
    showAddForm.value = false;
  } catch {
    submitMessageType.value = 'error';
    submitMessage.value = 'Unable to save the show right now.';
    pageMessageType.value = 'error';
    pageMessage.value = 'Unable to save the show right now.';
  } finally {
    isSubmitting.value = false;
  }
};

watch(
  user,
  () => {
    void loadPersistedEvents();
  },
  { immediate: true },
);

watch(sort, (nextSort) => {
  if (nextSort === 'trending_week' && hasLoadedPersistedEvents.value) {
    void loadPersistedEvents();
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
.events-page {
  display: grid;
  gap: 1.5rem;
}

.events-page__hero {
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

.events-page__hero-overlay {
  width: 100%;
  box-sizing: border-box;
  padding: 1.25rem;
  color: #fff;
  text-align: center;
}

.events-page__hero h2 {
  margin: 0;
  font-family: 'Avenir Next', 'Helvetica Neue', Helvetica, sans-serif;
  font-size: clamp(1.75rem, 4.4vw, 3.35rem);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

/*
  Secondary form styles stay intentionally plain while the page hero carries
  the visual weight for ingestion.
*/
.add-show-panel {
  background:
    radial-gradient(
      circle at top left,
      rgba(255, 255, 255, 0.95),
      rgba(255, 255, 255, 0.74)
    ),
    linear-gradient(
      135deg,
      rgba(229, 231, 235, 0.75),
      rgba(244, 246, 244, 0.95)
    );
  border: 1px solid var(--border);
}

.events-page__results p,
.events-page__empty h2,
.events-page__empty p,
.add-show-panel__header h2,
.add-show-panel__header p {
  margin: 0;
}

.events-page__eyebrow {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.76);
  margin: 0 0 0.45rem;
}

.events-page__intro {
  max-width: 52rem;
  color: var(--text-light);
  margin-top: 0.8rem;
}

.events-page__toggle,
.button-primary,
.button-secondary {
  border-radius: 999px;
  padding: 0.75rem 1.1rem;
  font-weight: 600;
}

.events-page__toggle,
.button-primary {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: white;
}

.button-secondary {
  border: 1px solid var(--border);
  background: white;
  color: var(--text-dark);
}

.add-show-panel {
  padding: 1.4rem;
  border-radius: 1rem;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.88);
}

.add-show-panel__header {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.add-show-panel__header p {
  color: var(--text-light);
}

.add-show-panel__form {
  display: grid;
  gap: 1rem;
}

.add-show-panel__form label {
  display: grid;
  gap: 0.35rem;
}

.add-show-panel__form span {
  font-size: 0.8rem;
  color: var(--text-light);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.add-show-panel__form input,
.add-show-panel__form select,
.add-show-panel__form textarea {
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: white;
  font: inherit;
  color: var(--text-dark);
  box-sizing: border-box;
}

.add-show-panel__message {
  margin: 0;
  font-size: 0.95rem;
}

.add-show-panel__message--success {
  color: #285d33;
}

.add-show-panel__message--error {
  color: #b42318;
}

.add-show-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.events-page__results {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.events-page__results-label {
  font-size: 0.95rem;
  font-weight: 700;
}

.events-page__message {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 0.8rem;
  border: 1px solid var(--border);
}

.events-page__message--success {
  background: rgba(40, 93, 51, 0.08);
  color: #285d33;
}

.events-page__message--error {
  background: rgba(180, 35, 24, 0.08);
  color: #b42318;
}

.events-page__results-subtitle {
  color: var(--text-light);
}

.events-page__list {
  display: grid;
  gap: 1.25rem;
}

.events-page__empty {
  padding: 2.5rem 1.5rem;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.6);
}

.events-page__empty p {
  margin-top: 0.45rem;
  color: var(--text-light);
}

@media (min-width: 760px) {
  .events-page__hero h2 {
    font-size: clamp(2.05rem, 4.1vw, 3.25rem);
    white-space: nowrap;
  }

  .add-show-panel__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .add-show-panel__full,
  .add-show-panel__actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 759px) {
  .events-page__results {
    flex-direction: column;
    align-items: stretch;
  }

  .add-show-panel__actions {
    flex-direction: column;
  }
}
</style>
