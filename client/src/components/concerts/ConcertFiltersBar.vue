<template>
  <section class="filters-bar" aria-label="Concert filters">
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
      <span class="filters-bar__label">City</span>
      <select
        :value="selectedCityOption"
        aria-label="City"
        data-testid="city-filter-select"
        @change="onCityChange"
      >
        <option value="">All cities</option>
        <option
          v-for="cityOption in cityOptions"
          :key="cityOption"
          :value="cityOption"
        >
          {{ cityOption }}
        </option>
      </select>
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
        <option value="trending_week">Trending this week</option>
      </select>
    </label>

    <label class="filters-bar__field">
      <span class="filters-bar__label">Source</span>
      <select :value="source" @change="onSourceChange">
        <option value="all">All sources</option>
        <option value="synced">Synced only</option>
      </select>
    </label>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
  DateRangeOption,
  SortOption,
  SourceOption,
} from '../../composables/useConcertFilters';

const CORE_NC_CITIES = [
  'Raleigh',
  'Durham',
  'Chapel Hill',
  'Carrboro',
  'Charlotte',
  'Wilmington',
  'Asheville',
  'Boone',
  'Greensboro',
  'Winston-Salem',
] as const;

const props = withDefaults(
  defineProps<{
    searchText: string;
    city?: string;
    dateRange: DateRangeOption;
    sort: SortOption;
    source: SourceOption;
  }>(),
  {
    city: '',
  },
);

const emit = defineEmits<{
  (event: 'update:searchText', value: string): void;
  (event: 'update:city', value: string): void;
  (event: 'update:dateRange', value: DateRangeOption): void;
  (event: 'update:sort', value: SortOption): void;
  (event: 'update:source', value: SourceOption): void;
}>();

const findMatchingCoreCity = (raw: string) => {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return (
    CORE_NC_CITIES.find(
      (c) =>
        c.toLowerCase() === normalized ||
        c.toLowerCase().replace(/\s+/g, '-') === normalized,
    ) ?? null
  );
};

const cityOptions = computed(() => {
  const current = (props.city || '').trim();
  if (!current || findMatchingCoreCity(current)) {
    return [...CORE_NC_CITIES];
  }
  return [current, ...CORE_NC_CITIES];
});

const selectedCityOption = computed(() => {
  const current = (props.city || '').trim();
  if (!current) return '';
  return findMatchingCoreCity(current) ?? current;
});

const onSearchInput = (event: Event) => {
  emit('update:searchText', (event.target as HTMLInputElement).value);
};

const onCityChange = (event: Event) => {
  emit('update:city', (event.target as HTMLSelectElement).value);
};

const onDateRangeChange = (event: Event) => {
  emit(
    'update:dateRange',
    (event.target as HTMLSelectElement).value as DateRangeOption,
  );
};

const onSortChange = (event: Event) => {
  emit('update:sort', (event.target as HTMLSelectElement).value as SortOption);
};

const onSourceChange = (event: Event) => {
  emit(
    'update:source',
    (event.target as HTMLSelectElement).value as SourceOption,
  );
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
    grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(130px, 0.8fr));
    align-items: end;
  }
}
</style>
