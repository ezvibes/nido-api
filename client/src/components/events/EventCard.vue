<template>
  <article class="event-card">
    <div class="event-card__poster">
      <img :src="event.posterUrl" :alt="`${event.title} poster`" loading="lazy" />
    </div>

    <div class="event-card__body">
      <h3 class="event-card__title">{{ event.title }}</h3>
      <p class="event-card__venue">{{ primaryVenueName }}</p>
      <p class="event-card__location">{{ locationLabel }}</p>
      <p class="event-card__time">{{ formattedStartTime }}</p>

      <p v-if="event.description" class="event-card__description">{{ event.description }}</p>

      <button class="event-card__tickets" type="button" disabled>Tickets</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EventListItem } from '../../types/events';

const props = defineProps<{
  event: EventListItem;
}>();

const primaryVenue = computed(() => props.event.venues[0]);

const primaryVenueName = computed(() => primaryVenue.value?.name ?? 'Venue TBD');

const locationLabel = computed(() => {
  if (!primaryVenue.value) {
    return 'Location TBD';
  }

  const pieces = [primaryVenue.value.city, primaryVenue.value.state].filter(Boolean);
  return pieces.length ? pieces.join(', ') : 'Location TBD';
});

const formattedStartTime = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(props.event.startsAt))
);
</script>

<style scoped>
.event-card {
  display: grid;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 14px 30px rgba(31, 41, 55, 0.08);
}

.event-card__poster {
  background: #dfe6dc;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.event-card__poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.event-card__body {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
}

.event-card__title,
.event-card__venue,
.event-card__location,
.event-card__time,
.event-card__description {
  margin: 0;
}

.event-card__title {
  font-size: 1.2rem;
  line-height: 1.2;
}

.event-card__venue,
.event-card__time {
  font-weight: 600;
}

.event-card__location,
.event-card__description {
  color: var(--text-light);
}

.event-card__tickets {
  justify-self: start;
  margin-top: 0.35rem;
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-light);
  cursor: not-allowed;
  font-weight: 600;
}

@media (min-width: 720px) {
  .event-card {
    grid-template-columns: 220px 1fr;
  }

  .event-card__poster {
    aspect-ratio: auto;
    min-height: 100%;
  }

  .event-card__body {
    padding: 1.2rem;
  }

  .event-card__title {
    font-size: 1.35rem;
  }
}
</style>
