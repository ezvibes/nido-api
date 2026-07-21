<template>
  <article class="event-card">
    <div class="event-card__poster">
      <img
        :src="event.posterUrl"
        :alt="`${event.title} poster`"
        loading="lazy"
      />
    </div>

    <div class="event-card__body">
      <div v-if="isSynced" class="event-card__badges" aria-label="Event source">
        <span class="event-card__badge">Google Calendar Sync</span>
      </div>
      <h3 class="event-card__title">{{ event.title }}</h3>
      <p class="event-card__venue">{{ primaryVenueName }}</p>
      <p class="event-card__location">{{ locationLabel }}</p>
      <p v-if="lineupLabel" class="event-card__lineup">{{ lineupLabel }}</p>
      <p class="event-card__time">{{ formattedStartTime }}</p>

      <p v-if="event.description" class="event-card__description">
        {{ event.description }}
      </p>

      <div class="event-card__actions">
        <button
          class="event-card__upvote"
          :class="{ 'event-card__upvote--active': event.upvotedByMe }"
          type="button"
          :aria-pressed="event.upvotedByMe"
          :disabled="isUpvoting || !canUpvote"
          @click="$emit('toggle-upvote', event)"
        >
          <span class="event-card__upvote-icon" aria-hidden="true">♥</span>
          <span>{{ event.upvoteCount ?? 0 }}</span>
        </button>
        <button class="event-card__tickets" type="button" disabled>
          Tickets
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EventListItem } from '../../types/events';

const props = defineProps<{
  event: EventListItem;
  isUpvoting?: boolean;
  canUpvote?: boolean;
}>();

defineEmits<{
  (event: 'toggle-upvote', value: EventListItem): void;
}>();

const primaryVenue = computed(() => props.event.venue);
const isSynced = computed(
  () => props.event.syncSource?.source === 'google_calendar',
);
const lineupLabel = computed(() =>
  [...props.event.lineup]
    .sort((left, right) => left.performanceOrder - right.performanceOrder)
    .map((entry) => entry.band.name)
    .join(' · '),
);

const primaryVenueName = computed(
  () => primaryVenue.value?.name ?? 'Venue TBD',
);

const locationLabel = computed(() => {
  if (!primaryVenue.value) {
    return 'Location TBD';
  }

  const pieces = [primaryVenue.value.city, primaryVenue.value.region].filter(
    Boolean,
  );
  return pieces.length ? pieces.join(', ') : 'Location TBD';
});

const formattedStartTime = computed(() =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(props.event.startsAt)),
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
  background: #111827; /* Dark charcoal/black framing */
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 4; /* Portrait ratio matching standard show posters */
  overflow: hidden;
}

.event-card__poster img {
  width: 100%;
  height: 100%;
  object-fit: contain; /* Ensure text/lineups are never cropped */
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

.event-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.event-card__badge {
  justify-self: start;
  width: fit-content;
  padding: 0.28rem 0.55rem;
  border: 1px solid rgba(44, 102, 74, 0.22);
  border-radius: 999px;
  background: rgba(44, 102, 74, 0.1);
  color: #285d33;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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
.event-card__lineup,
.event-card__description {
  color: var(--text-light);
}

.event-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.35rem;
}

.event-card__upvote,
.event-card__tickets {
  justify-self: start;
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-weight: 600;
}

.event-card__upvote {
  display: inline-flex;
  gap: 0.4rem;
  align-items: center;
  background: transparent;
  color: var(--text-dark);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease;
}

.event-card__upvote:hover:not(:disabled) {
  border-color: var(--primary);
}

.event-card__upvote:disabled {
  cursor: wait;
  opacity: 0.7;
}

.event-card__upvote--active {
  border-color: #2f8f45;
  background: rgba(47, 143, 69, 0.14);
  color: #1f7a38;
  box-shadow:
    0 0 0 3px rgba(47, 143, 69, 0.12),
    0 0 18px rgba(47, 143, 69, 0.42);
}

.event-card__upvote-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.event-card__upvote--active .event-card__upvote-icon {
  filter: drop-shadow(0 0 6px rgba(47, 143, 69, 0.72));
}

.event-card__tickets {
  background: transparent;
  color: var(--text-light);
  cursor: not-allowed;
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
