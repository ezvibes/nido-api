<template>
  <section class="events-page">
    <header class="page-header">
      <div>
        <h1>Carolina Live Music</h1>
        <p>Upcoming shows in the Carolinas</p>
      </div>
      <button class="add-show-button" type="button" @click="toggleAddForm">
        {{ showAddForm ? 'Close form' : 'Add a show' }}
      </button>
    </header>

    <section v-if="showAddForm" class="add-show-form">
      <h2>Add a new show</h2>
      <form class="form-grid" @submit.prevent>
        <label class="field">
          <span class="label">Event title</span>
          <input type="text" placeholder="Artist or show name" />
        </label>
        <label class="field">
          <span class="label">Venue name</span>
          <input type="text" placeholder="Venue name" />
        </label>
        <label class="field">
          <span class="label">City</span>
          <input type="text" placeholder="City" />
        </label>
        <label class="field">
          <span class="label">State</span>
          <select>
            <option value="NC">NC</option>
            <option value="SC">SC</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Date</span>
          <input type="date" />
        </label>
        <label class="field">
          <span class="label">Time</span>
          <input type="time" />
        </label>
        <label class="field">
          <span class="label">Image URL</span>
          <input type="url" placeholder="https://..." />
        </label>
        <label class="field">
          <span class="label">Genres (comma separated)</span>
          <input type="text" placeholder="jam, rock" />
        </label>
        <label class="field">
          <span class="label">Vibe tags (comma separated)</span>
          <input type="text" placeholder="chill, indie" />
        </label>
        <label class="field full">
          <span class="label">Description</span>
          <textarea rows="3" placeholder="Optional description"></textarea>
        </label>
        <div class="form-actions">
          <button type="button" class="secondary" @click="toggleAddForm">Cancel</button>
          <button type="submit" class="primary" disabled>Save show</button>
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

    <div class="results-row">
      <span class="count">{{ filteredEvents.length }} shows</span>
      <span class="hint">Sorted by {{ sortLabel }}</span>
    </div>

    <div v-if="filteredEvents.length" class="events-list">
      <EventCard v-for="event in filteredEvents" :key="event.id" :event="event" />
    </div>

    <div v-else class="empty-state">
      <h2>No shows match your filters</h2>
      <p>Try a different city, genre, or date range to see what's coming up.</p>
      <button class="btn-clear" @click="clearFilters">Clear filters</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import EventCard from '../components/events/EventCard.vue';
import EventFiltersBar from '../components/events/EventFiltersBar.vue';
import { sampleEvents } from '../data/sampleEvents';
import { useEventFilters } from '../composables/useEventFilters';

const {
  searchText,
  dateRange,
  sort,
  filteredEvents,
  clearFilters,
} = useEventFilters(sampleEvents);

const sortLabel = computed(() => (sort.value === 'soonest' ? 'soonest' : 'trending'));

// TODO: swap sampleEvents with API fetch (src/services/eventsService.ts).
const showAddForm = ref(false);

const toggleAddForm = () => {
  showAddForm.value = !showAddForm.value;
};
</script>

<style scoped>
.events-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
}

.page-header h1 {
  font-size: 2.25rem;
  font-weight: 600;
  margin: 0;
  font-family: "Georgia", "Palatino", serif;
}

.page-header p {
  margin: 0.4rem 0 0;
  color: var(--text-light);
}

.add-show-button {
  border: 1px solid var(--primary);
  background: var(--primary);
  color: #ffffff;
  padding: 0.6rem 1.5rem;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
}

.add-show-button:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.add-show-form {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.add-show-form h2 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field.full {
  grid-column: 1 / -1;
}

input,
select,
textarea {
  padding: 0.65rem 0.8rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border);
  background: white;
  font-size: 0.95rem;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.form-actions .primary {
  border: 1px solid var(--border);
  background: var(--primary);
  color: white;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-weight: 600;
}

.form-actions .secondary {
  border: 1px solid var(--border);
  background: transparent;
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-weight: 600;
}

.results-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--text-light);
  font-size: 0.95rem;
}

.events-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.75rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.6);
}

.empty-state h2 {
  margin: 0 0 0.75rem;
}

.btn-clear {
  margin-top: 1rem;
  padding: 0.65rem 1.5rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 720px) {
  .results-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4rem;
  }
}
</style>
