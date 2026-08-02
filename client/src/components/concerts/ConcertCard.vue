<template>
  <article class="concert-card">
    <div class="concert-card__poster">
      <img
        :src="concert.posterUrl"
        :alt="`${concert.title} poster`"
        loading="lazy"
      />
    </div>

    <div class="concert-card__body">
      <time class="concert-card__time" :datetime="concert.startsAt">
        {{ formattedStartTime }}
      </time>
      <h3 class="concert-card__artist">{{ artistLabel }}</h3>
      <p v-if="eventLabel" class="concert-card__event">{{ eventLabel }}</p>
      <p class="concert-card__venue">{{ primaryVenueName }}</p>
      <p class="concert-card__location">{{ locationLabel }}</p>
      <div
        v-if="cardTags.length"
        class="concert-card__badges"
        aria-label="Concert details"
      >
        <span
          v-for="tag in cardTags"
          :key="tag"
          class="concert-card__badge"
        >
          {{ tag }}
        </span>
      </div>
      <p v-if="concert.description" class="concert-card__description">
        {{ concert.description }}
      </p>

      <div class="concert-card__actions">
        <button
          class="concert-card__upvote"
          :class="{ 'concert-card__upvote--active': concert.upvotedByMe }"
          type="button"
          :aria-pressed="concert.upvotedByMe"
          :disabled="isUpvoting || !canUpvote"
          @click="$emit('toggle-upvote', concert)"
        >
          <span class="concert-card__upvote-icon" aria-hidden="true">♥</span>
          <span>{{ concert.upvoteCount ?? 0 }}</span>
        </button>
        <button class="concert-card__tickets" type="button" disabled>
          Tickets
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ConcertListItem } from '../../types/concerts';

const props = defineProps<{
  concert: ConcertListItem;
  isUpvoting?: boolean;
  canUpvote?: boolean;
}>();

defineEmits<{
  (event: 'toggle-upvote', value: ConcertListItem): void;
}>();

const primaryVenue = computed(() => props.concert.venue);
const isSynced = computed(
  () => props.concert.syncSource?.source === 'google_calendar',
);
const cardTags = computed(() => {
  const tags = [
    ...props.concert.displayTags,
    ...(isSynced.value ? ['Google Calendar Sync'] : []),
  ];
  const seen = new Set<string>();

  return tags.filter((tag) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
});

const artistNames = computed(() =>
  [...props.concert.lineup]
    .sort((left, right) => left.performanceOrder - right.performanceOrder)
    .map((entry) => entry.band.name)
    .filter((name, index, names) => names.indexOf(name) === index),
);

const artistLabel = computed(() =>
  artistNames.value.length
    ? artistNames.value.join(' · ')
    : props.concert.title,
);

const eventLabel = computed(() => {
  if (!artistNames.value.length) return '';

  const normalizedTitle = normalizeDisplayText(props.concert.title);
  const titleAddsInformation = artistNames.value.some(
    (name) => !normalizedTitle.includes(normalizeDisplayText(name)),
  );

  return titleAddsInformation ? props.concert.title : '';
});

function normalizeDisplayText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

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
  }).format(new Date(props.concert.startsAt)),
);
</script>

<style scoped>
.concert-card {
  display: grid;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 14px 30px rgba(31, 41, 55, 0.08);
}

.concert-card__poster {
  background: #111827; /* Dark charcoal/black framing */
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 4; /* Portrait ratio matching standard show posters */
  overflow: hidden;
}

.concert-card__poster img {
  width: 100%;
  height: 100%;
  object-fit: contain; /* Ensure text/lineups are never cropped */
  display: block;
}

.concert-card__body {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
}

.concert-card__artist,
.concert-card__event,
.concert-card__venue,
.concert-card__location,
.concert-card__time,
.concert-card__description {
  margin: 0;
}

.concert-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.15rem;
}

.concert-card__badge {
  justify-self: start;
  width: fit-content;
  padding: 0.28rem 0.55rem;
  border: 1px solid rgba(44, 102, 74, 0.22);
  border-radius: 999px;
  background: rgba(44, 102, 74, 0.1);
  color: #285d33;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.concert-card__artist {
  font-size: 1.2rem;
  line-height: 1.2;
}

.concert-card__time {
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
}

.concert-card__event,
.concert-card__venue {
  font-weight: 600;
}

.concert-card__location,
.concert-card__description {
  color: var(--text-light);
}

.concert-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.35rem;
}

.concert-card__upvote,
.concert-card__tickets {
  justify-self: start;
  padding: 0.6rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-weight: 600;
}

.concert-card__upvote {
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

.concert-card__upvote:hover:not(:disabled) {
  border-color: var(--primary);
}

.concert-card__upvote:disabled {
  cursor: wait;
  opacity: 0.7;
}

.concert-card__upvote--active {
  border-color: #2f8f45;
  background: rgba(47, 143, 69, 0.14);
  color: #1f7a38;
  box-shadow:
    0 0 0 3px rgba(47, 143, 69, 0.12),
    0 0 18px rgba(47, 143, 69, 0.42);
}

.concert-card__upvote-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.concert-card__upvote--active .concert-card__upvote-icon {
  filter: drop-shadow(0 0 6px rgba(47, 143, 69, 0.72));
}

.concert-card__tickets {
  background: transparent;
  color: var(--text-light);
  cursor: not-allowed;
}

@media (min-width: 720px) {
  .concert-card {
    grid-template-columns: 220px 1fr;
  }

  .concert-card__poster {
    aspect-ratio: auto;
    min-height: 100%;
  }

  .concert-card__body {
    padding: 1.2rem;
  }

  .concert-card__artist {
    font-size: 1.35rem;
  }
}
</style>
