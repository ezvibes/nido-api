<template>
  <section class="filters-bar" aria-label="Event filters">
    <label class="filters-bar__field filters-bar__field--search">
      <span class="filters-bar__label">Search</span>
      <input
        :value="searchText"
        type="search"
        placeholder="Search city, band, venue, or genre"
        @input="onSearchInput"
      />
    </label>

    <label class="filters-bar__field">
      <span class="filters-bar__label">Date Range</span>
      <select :value="dateRange" @change="onDateRangeChange">
        <option value="7">Next 7 days</option>
        <option value="30">Next 30 days</option>
        <option value="all">All upcoming</option>
      </select>
    </label>

    <label class="filters-bar__field">
      <span class="filters-bar__label">Sort</span>
      <select :value="sort" @change="onSortChange">
        <option value="soonest">Soonest</option>
        <option value="featured">Featured</option>
      </select>
    </label>
  </section>
</template>

<script setup lang="ts">
import type { DateRangeOption, SortOption } from '../../composables/useEventFilters';

defineProps<{
  searchText: string;
  dateRange: DateRangeOption;
  sort: SortOption;
}>();

const emit = defineEmits<{
  (event: 'update:searchText', value: string): void;
  (event: 'update:dateRange', value: DateRangeOption): void;
  (event: 'update:sort', value: SortOption): void;
}>();

const onSearchInput = (event: Event) => {
  emit('update:searchText', (event.target as HTMLInputElement).value);
};

const onDateRangeChange = (event: Event) => {
  emit('update:dateRange', (event.target as HTMLSelectElement).value as DateRangeOption);
};

const onSortChange = (event: Event) => {
  emit('update:sort', (event.target as HTMLSelectElement).value as SortOption);
};
</script>

<style scoped>
.filters-bar {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 32px rgba(31, 41, 55, 0.06);
}

.filters-bar__field {
  display: grid;
  gap: 0.4rem;
}

.filters-bar__label {
  font-size: 0.8rem;
  color: var(--text-light);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.filters-bar input,
.filters-bar select {
  width: 100%;
  min-width: 0;
  padding: 0.75rem 0.9rem;
  border-radius: 0.7rem;
  border: 1px solid var(--border);
  background: white;
  font-size: 0.95rem;
  color: var(--text-dark);
  box-sizing: border-box;
}

.filters-bar input:focus,
.filters-bar select:focus {
  outline: 2px solid rgba(58, 79, 57, 0.14);
  border-color: var(--primary);
}

@media (min-width: 760px) {
  .filters-bar {
    grid-template-columns: minmax(0, 1.8fr) minmax(180px, 0.8fr) minmax(180px, 0.8fr);
    align-items: end;
  }
}
</style>
