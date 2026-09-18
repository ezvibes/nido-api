<template>
  <article class="concert-card">
    <div class="concert-card__poster">
      <img
        v-if="hasPoster"
        :src="concert.posterUrl!"
        :alt="`${concert.title} poster`"
        loading="lazy"
        @error="handleImageError"
      />
      <div
        v-else
        class="concert-card__fallback"
        :class="genreThemeClass"
        aria-hidden="true"
      >
        <div class="concert-card__fallback-pattern">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            class="concert-card__fallback-svg"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              stroke-width="0.5"
              fill="none"
              opacity="0.2"
            />
            <circle
              cx="50"
              cy="50"
              r="28"
              stroke="currentColor"
              stroke-width="0.5"
              fill="none"
              opacity="0.25"
            />
            <circle
              cx="50"
              cy="50"
              r="16"
              stroke="currentColor"
              stroke-width="0.5"
              fill="none"
              opacity="0.3"
            />
            <path
              d="M10 50 Q 50 20, 90 50 T 10 50"
              stroke="currentColor"
              stroke-width="0.5"
              fill="none"
              opacity="0.15"
            />
          </svg>
        </div>
        <div class="concert-card__fallback-content">
          <span class="concert-card__fallback-badge">{{ posterBadgeText }}</span>
          <div class="concert-card__fallback-initials">{{ artistInitials }}</div>
          <div class="concert-card__fallback-footer">
            <span class="concert-card__fallback-brand">NIDO</span>
          </div>
        </div>
      </div>
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
import { computed, ref, watch } from 'vue';
import type { ConcertListItem } from '../../types/concerts';

const props = defineProps<{
  concert: ConcertListItem;
  isUpvoting?: boolean;
  canUpvote?: boolean;
}>();

defineEmits<{
  (event: 'toggle-upvote', value: ConcertListItem): void;
}>();

const imageError = ref(false);

watch(
  () => props.concert.posterUrl,
  () => {
    imageError.value = false;
  },
);

const hasPoster = computed(
  () => Boolean(props.concert.posterUrl) && !imageError.value,
);

const handleImageError = () => {
  imageError.value = true;
};

const normalizedGenre = computed(() =>
  (props.concert.genre || '').toLowerCase().trim(),
);

const genreThemeClass = computed(() => {
  const g = normalizedGenre.value;
  if (
    g.includes('electronic') ||
    g.includes('edm') ||
    g.includes('dance') ||
    g.includes('dj') ||
    g.includes('house') ||
    g.includes('techno')
  ) {
    return 'concert-card__fallback--electronic';
  }
  if (
    g.includes('rock') ||
    g.includes('metal') ||
    g.includes('punk') ||
    g.includes('alternative') ||
    g.includes('indie')
  ) {
    return 'concert-card__fallback--rock';
  }
  if (
    g.includes('jazz') ||
    g.includes('blues') ||
    g.includes('soul') ||
    g.includes('r&b') ||
    g.includes('funk')
  ) {
    return 'concert-card__fallback--jazz';
  }
  if (
    g.includes('country') ||
    g.includes('folk') ||
    g.includes('acoustic') ||
    g.includes('bluegrass')
  ) {
    return 'concert-card__fallback--acoustic';
  }
  if (g.includes('hip hop') || g.includes('rap') || g.includes('urban')) {
    return 'concert-card__fallback--hiphop';
  }
  return 'concert-card__fallback--default';
});

const posterBadgeText = computed(() => props.concert.genre || 'Live Show');

const artistInitials = computed(() => {
  const label = artistLabel.value || props.concert.title || 'EZ';
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'EZ';
  }
  if (parts.length === 1) {
    return (parts[0] || 'EZ').slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] || 'E';
  const second = parts[1]?.[0] || 'Z';
  return (first + second).toUpperCase();
});

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

.concert-card__fallback {
  width: 100%;
  height: 100%;
  min-height: 220px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.25rem 1rem;
  box-sizing: border-box;
  overflow: hidden;
  user-select: none;
}

.concert-card__fallback--electronic {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #065f46 100%);
  color: #34d399;
}

.concert-card__fallback--rock {
  background: linear-gradient(135deg, #18181b 0%, #450a0a 50%, #27272a 100%);
  color: #f87171;
}

.concert-card__fallback--jazz {
  background: linear-gradient(135deg, #0c1a30 0%, #311b92 50%, #4a148c 100%);
  color: #fbbf24;
}

.concert-card__fallback--acoustic {
  background: linear-gradient(135deg, #14281d 0%, #1c3d28 50%, #3d2d1c 100%);
  color: #fcd34d;
}

.concert-card__fallback--hiphop {
  background: linear-gradient(135deg, #111827 0%, #581c87 50%, #1f2937 100%);
  color: #c084fc;
}

.concert-card__fallback--default {
  background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #064e3b 100%);
  color: #34d399;
}

.concert-card__fallback-pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.concert-card__fallback-svg {
  width: 100%;
  height: 100%;
}

.concert-card__fallback-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  text-align: center;
}

.concert-card__fallback-badge {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(4px);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.concert-card__fallback-initials {
  font-size: 2.8rem;
  font-weight: 900;
  letter-spacing: -0.03em;
  line-height: 1;
  color: #ffffff;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  margin: auto 0;
}

.concert-card__fallback-footer {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.concert-card__fallback-brand {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  opacity: 0.75;
  color: #ffffff;
  text-transform: uppercase;
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
.concert-card__time {
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
  color: #34d399;
  font-size: 0.82rem;
  font-weight: 800;
  text-transform: uppercase;
}

.concert-card__event,
.concert-card__venue {
  font-weight: 600;
}

.concert-card__location {
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
