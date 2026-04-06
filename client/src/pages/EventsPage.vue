<template>
  <section class="events-page">
    <header class="events-page__hero">
      <div class="events-page__hero-copy">
        <p class="events-page__eyebrow">Demo Discovery Feed</p>
        <p class="events-page__intro">
          This demo route previews a browseable event feed using a frontend model that can later
          map cleanly onto the existing concerts API.
        </p>
      </div>

      <button class="events-page__toggle" type="button" @click="toggleAddForm">
        {{ showAddForm ? 'Close form' : 'Add a show' }}
      </button>
    </header>

    <p v-if="pageMessage" :class="pageMessageClass">{{ pageMessage }}</p>

    <section v-if="showAddForm" class="add-show-panel">
      <div class="add-show-panel__header">
        <h2>Add a show</h2>
        <p>Create a concert for your account and preview it here in the demo feed.</p>
      </div>

      <form class="add-show-panel__form" @submit.prevent="handleSubmit">
        <label>
          <span>Title</span>
          <input v-model="form.title" type="text" placeholder="Artist or lineup name" />
        </label>
        <label>
          <span>Genre</span>
          <input v-model="form.genre" type="text" placeholder="rock, indie, jazz" />
        </label>
        <label>
          <span>Artist / Lineup</span>
          <input v-model="form.artistName" type="text" placeholder="Duck" />
        </label>
        <label>
          <span>Venue</span>
          <input v-model="form.venueName" type="text" placeholder="Venue name" />
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
          <input v-model="form.posterUrl" type="url" placeholder="https://..." />
        </label>
        <label class="add-show-panel__full">
          <span>Description</span>
          <textarea
            v-model="form.description"
            rows="3"
            placeholder="Optional notes for the event card"
          ></textarea>
        </label>
        <p v-if="submitMessage" :class="submitMessageClass">{{ submitMessage }}</p>
        <div class="add-show-panel__actions">
          <button type="button" class="button-secondary" @click="toggleAddForm">Cancel</button>
          <button type="submit" class="button-primary" :disabled="isSubmitDisabled">
            {{ isSubmitting ? 'Saving…' : 'Save show' }}
          </button>
        </div>
      </form>
    </section>

    <EventFiltersBar
      :search-text="searchText"
      :date-range="dateRange"
      :sort="sort"
      @update:search-text="searchText = $event"
      @update:date-range="dateRange = $event"
      @update:sort="sort = $event"
    />

    <section class="events-page__results">
      <div>
        <p class="events-page__results-label">{{ filteredEvents.length }} shows</p>
        <p class="events-page__results-subtitle">{{ sortSummary }}</p>
      </div>
      <button class="button-secondary" type="button" @click="clearFilters">Reset filters</button>
    </section>

    <section v-if="filteredEvents.length" class="events-page__list">
      <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" />
    </section>

    <section v-else class="events-page__empty">
      <h2>No shows match those filters.</h2>
      <p>Try a different city, band, venue, or date range.</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import EventCard from '../components/events/EventCard.vue';
import EventFiltersBar from '../components/events/EventFiltersBar.vue';
import { useEventFilters } from '../composables/useEventFilters';
import { sampleEvents } from '../data/sampleEvents';
import { createConcert } from '../composables/useApi';
import { useAuth } from '../composables/useAuth';
import { mapConcertToEventListItem, type EventListItem } from '../types/events';

const { user } = useAuth();

const createdEvents = ref<EventListItem[]>([]);
const demoEvents = computed(() => [...createdEvents.value, ...sampleEvents]);
const { searchText, dateRange, sort, filteredEvents, clearFilters } = useEventFilters(demoEvents);

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
  sort.value === 'soonest' ? 'Sorted by earliest upcoming start time.' : 'Sorted by featured demo priority.'
);

const isSubmitDisabled = computed(
  () =>
    isSubmitting.value ||
    !form.title.trim() ||
    !form.genre.trim() ||
    !form.artistName.trim() ||
    !form.venueName.trim() ||
    !form.date ||
    !form.time
);

const submitMessageClass = computed(() =>
  submitMessageType.value === 'success'
    ? 'add-show-panel__message add-show-panel__message--success'
    : 'add-show-panel__message add-show-panel__message--error'
);

const pageMessageClass = computed(() =>
  pageMessageType.value === 'success'
    ? 'events-page__message events-page__message--success'
    : 'events-page__message events-page__message--error'
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

    createdEvents.value = [
      mapConcertToEventListItem(concert, {
        posterUrl:
          form.posterUrl.trim() ||
          'https://placehold.co/720x900/e6ece4/31453a?text=New+Show',
        sourceLabel: 'Your submission',
        displayTags: [form.genre.trim(), 'new', 'my concert'],
        demoRank: 100,
      }),
      ...createdEvents.value,
    ];

    submitMessageType.value = 'success';
    submitMessage.value = 'Show saved. It should also appear on your My Concerts home feed.';
    pageMessageType.value = 'success';
    pageMessage.value = 'New show saved and added to the demo feed.';
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
</script>

<style scoped>
.events-page {
  display: grid;
  gap: 1.5rem;
}

.events-page__hero {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.75rem;
  border-radius: 1.2rem;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.74)),
    linear-gradient(135deg, rgba(229, 231, 235, 0.75), rgba(244, 246, 244, 0.95));
  border: 1px solid var(--border);
}

.events-page__hero-copy p,
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
  color: var(--text-light);
  margin-bottom: 0.45rem;
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
  .events-page__hero {
    grid-template-columns: 1fr auto;
    align-items: end;
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
