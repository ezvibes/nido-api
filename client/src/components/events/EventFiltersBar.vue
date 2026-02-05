<template>
  <div class="filters-bar">
    <label class="field search">
      <span class="label">Search</span>
      <input
        type="search"
        :value="searchText"
        placeholder="Search city, band, venue (e.g. rock in raleigh)"
        aria-label="Search city, band, venue"
        @input="onSearch"
      />
    </label>

    <label class="field">
      <span class="label">Date range</span>
      <select :value="dateRange" aria-label="Filter by date range" @change="onDateRange">
        <option value="7">Next 7 days</option>
        <option value="30">Next 30 days</option>
        <option value="all">All upcoming</option>
      </select>
    </label>

    <label class="field">
      <span class="label">Sort</span>
      <select :value="sort" aria-label="Sort events" @change="onSort">
        <option value="soonest">Soonest</option>
        <option value="trending">Trending</option>
      </select>
    </label>
  </div>
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

const onSearch = (event: Event) => {
  emit('update:searchText', (event.target as HTMLInputElement).value);
};

const onDateRange = (event: Event) => {
  emit('update:dateRange', (event.target as HTMLSelectElement).value as DateRangeOption);
};

const onSort = (event: Event) => {
  emit('update:sort', (event.target as HTMLSelectElement).value as SortOption);
};
</script>

<style scoped>
.filters-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 1rem;
  border: 1px solid var(--border);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.06);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field.search {
  grid-column: span 2;
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-light);
}

input,
select {
  padding: 0.65rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background: white;
  font-size: 0.95rem;
  color: var(--text-dark);
}

input:focus,
select:focus {
  outline: 2px solid rgba(58, 79, 57, 0.2);
  border-color: var(--primary);
}

input::placeholder {
  color: var(--text-light);
}

select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem;
  padding-right: 2.25rem;
}

.field select {
  border-radius: 0.5rem;
}

@media (max-width: 720px) {
  .field.search {
    grid-column: span 1;
  }
}
</style>
