<template>
  <section class="concert-detail-page">
    <nav class="concert-detail-page__nav" aria-label="Breadcrumb">
      <router-link to="/concerts" class="concert-detail-page__back">
        ← All Concerts
      </router-link>
    </nav>

    <div
      v-if="loading"
      class="concert-detail-page__state"
      data-testid="concert-detail-loading"
    >
      Loading concert details…
    </div>

    <div
      v-else-if="error || !concert"
      class="concert-detail-page__state concert-detail-page__state--error"
      data-testid="concert-detail-error"
    >
      <h2>Concert not found</h2>
      <p>
        {{
          error ||
          'This concert may have been removed or is not yet publicly available.'
        }}
      </p>
      <router-link to="/concerts" class="concert-detail-page__cta-btn">
        Browse Upcoming Concerts
      </router-link>
    </div>

    <article
      v-else
      class="concert-detail"
      data-testid="concert-detail-article"
    >
      <div class="concert-detail__hero">
        <div class="concert-detail__poster-col">
          <div
            class="concert-detail__poster"
            :class="{ 'concert-detail__poster--zoomable': hasPoster }"
            :role="hasPoster ? 'button' : undefined"
            :tabindex="hasPoster ? 0 : undefined"
            :aria-label="hasPoster ? 'View full-size poster' : undefined"
            @click="hasPoster && (lightboxOpen = true)"
            @keydown.enter="hasPoster && (lightboxOpen = true)"
          >
            <img
              v-if="hasPoster"
              :src="resolvedPoster"
              :alt="`${concert.title} poster`"
              class="concert-detail__poster-img"
              @error="handleImageError"
            />
            <div
              v-else
              class="concert-detail__fallback"
              :class="genreThemeClass"
              aria-hidden="true"
            >
              <div class="concert-detail__fallback-pattern">
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  class="concert-detail__fallback-svg"
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
                </svg>
              </div>
              <div class="concert-detail__fallback-content">
                <span class="concert-detail__fallback-badge">{{
                  concert.genre || 'Live Show'
                }}</span>
                <div class="concert-detail__fallback-initials">
                  {{ artistInitials }}
                </div>
                <span class="concert-detail__fallback-brand">NIDO</span>
              </div>
            </div>
            <span v-if="hasPoster" class="concert-detail__zoom-hint">
              Click to enlarge
            </span>
          </div>
        </div>

        <div class="concert-detail__main">
          <div class="concert-detail__badges">
            <span
              v-if="concert.isFeatured"
              class="concert-detail__badge concert-detail__badge--featured"
            >
              Featured
            </span>
            <span
              v-if="concert.isTopPick"
              class="concert-detail__badge concert-detail__badge--top-pick"
            >
              Top Pick
            </span>
            <span v-if="concert.genre" class="concert-detail__badge">
              {{ concert.genre }}
            </span>
          </div>

          <time class="concert-detail__datetime" :datetime="concert.startsAt">
            {{ formattedDateRange }}
          </time>

          <h1 class="concert-detail__artist">{{ artistHeadline }}</h1>
          <p v-if="distinctEventTitle" class="concert-detail__subtitle">
            {{ distinctEventTitle }}
          </p>

          <p v-if="concert.venue" class="concert-detail__venue-summary">
            <strong>{{ concert.venue.name }}</strong>
            <span v-if="venueCityState"> · {{ venueCityState }}</span>
          </p>

          <p v-if="concert.description" class="concert-detail__description">
            {{ concert.description }}
          </p>

          <div
            class="concert-detail__actions"
            aria-label="Concert actions"
          >
            <a
              v-if="safeTicketUrl"
              :href="safeTicketUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="concert-detail__btn concert-detail__btn--primary"
              data-testid="ticket-link"
            >
              Get Tickets ↗
            </a>

            <button
              type="button"
              class="concert-detail__btn concert-detail__btn--upvote"
              :class="{
                'concert-detail__btn--upvoted': concert.upvotedByMe,
              }"
              :aria-pressed="Boolean(concert.upvotedByMe)"
              :disabled="upvoting || !user"
              :title="
                user ? 'Upvote this show' : 'Sign in to upvote this show'
              "
              data-testid="upvote-button"
              @click="handleToggleUpvote"
            >
              <span aria-hidden="true">♥</span>
              <span>{{ concert.upvoteCount ?? 0 }}</span>
            </button>

            <a
              :href="googleCalendarUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="concert-detail__btn"
              data-testid="google-calendar-link"
            >
              + Google Calendar
            </a>

            <button
              type="button"
              class="concert-detail__btn"
              data-testid="download-ics-button"
              @click="handleDownloadIcs"
            >
              Download .ics
            </button>

            <button
              type="button"
              class="concert-detail__btn"
              data-testid="share-button"
              @click="handleShare"
            >
              {{ shareConfirmed ? 'Link copied!' : 'Share Show' }}
            </button>
          </div>
        </div>
      </div>

      <div class="concert-detail__sections">
        <section
          v-if="sortedLineup.length > 0 || sortedSets.length > 0"
          class="concert-detail__card"
          aria-labelledby="lineup-heading"
        >
          <h2 id="lineup-heading" class="concert-detail__section-title">
            Lineup &amp; Set Times
          </h2>

          <ul v-if="sortedLineup.length > 0" class="concert-detail__lineup">
            <li
              v-for="entry in sortedLineup"
              :key="entry.band.id"
              class="concert-detail__lineup-item"
            >
              <div class="concert-detail__lineup-info">
                <span class="concert-detail__band-name">{{
                  entry.band.name
                }}</span>
                <span
                  class="concert-detail__role-pill"
                  :class="`concert-detail__role-pill--${entry.performanceRole || 'support'}`"
                >
                  {{
                    entry.performanceRole === 'headliner'
                      ? 'Headliner'
                      : 'Support'
                  }}
                </span>
              </div>
              <div
                v-if="entry.band.genres && entry.band.genres.length > 0"
                class="concert-detail__band-genres"
              >
                <span
                  v-for="g in entry.band.genres"
                  :key="g"
                  class="concert-detail__genre-tag"
                >
                  {{ g }}
                </span>
              </div>
            </li>
          </ul>

          <div v-if="sortedSets.length > 0" class="concert-detail__sets">
            <h3 class="concert-detail__subsection-title">Schedule</h3>
            <ul class="concert-detail__set-list">
              <li
                v-for="set in sortedSets"
                :key="set.id"
                class="concert-detail__set-item"
              >
                <strong>{{ set.band?.name || 'Set' }}</strong>
                <span v-if="set.stageName"> · {{ set.stageName }}</span>
                <span class="concert-detail__set-time">
                  {{ formatTimeOnly(set.startsAt) }}
                  <template v-if="set.endsAt">
                    – {{ formatTimeOnly(set.endsAt) }}
                  </template>
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section
          v-if="concert.venue"
          class="concert-detail__card"
          aria-labelledby="venue-heading"
          data-testid="venue-section"
        >
          <h2 id="venue-heading" class="concert-detail__section-title">
            Venue &amp; Directions
          </h2>
          <p class="concert-detail__venue-name">{{ concert.venue.name }}</p>
          <p v-if="fullVenueAddress" class="concert-detail__venue-address">
            {{ fullVenueAddress }}
          </p>
          <p
            v-if="concert.venue.capacity"
            class="concert-detail__venue-capacity"
          >
            Capacity: {{ concert.venue.capacity.toLocaleString() }}
          </p>
          <a
            :href="googleMapsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="concert-detail__btn concert-detail__maps-link"
            data-testid="google-maps-link"
          >
            Directions in Google Maps ↗
          </a>
        </section>
      </div>

      <NewsletterSignupBanner utm-source="nido_concert_detail" />
    </article>

    <div
      v-if="lightboxOpen && hasPoster"
      class="concert-detail__lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Full-size concert poster"
      data-testid="poster-lightbox"
      @click.self="lightboxOpen = false"
    >
      <div class="concert-detail__lightbox-inner">
        <button
          type="button"
          class="concert-detail__lightbox-close"
          aria-label="Close poster preview"
          @click="lightboxOpen = false"
        >
          ✕ Close
        </button>
        <img
          :src="resolvedPoster"
          :alt="`${concert?.title || 'Concert'} full-size poster`"
          class="concert-detail__lightbox-img"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  fetchConcertById,
  removeConcertUpvote,
  upvoteConcert,
} from '../composables/useApi';
import { useAuth } from '../composables/useAuth';
import { resolvePosterUrl, type ConcertApiItem } from '../types/concerts';
import NewsletterSignupBanner from '../components/newsletter/NewsletterSignupBanner.vue';
import { useDocumentMeta } from '../composables/useDocumentMeta';
import {
  buildConcertIcsContent,
  buildConcertMetaSummary,
  buildConcertStructuredData,
  buildGoogleCalendarTemplateUrl,
  buildGoogleMapsVenueUrl,
  buildOutboundTicketUrl,
  computeArtistInitials,
  extractOrderedArtistNames,
  formatFullVenueAddress,
  resolveDistinctEventTitle,
  resolveGenreThemeVariant,
} from '../utils/concert-presentation';

const route = useRoute();
const { user } = useAuth();

const concert = ref<ConcertApiItem | null>(null);
const loading = ref(true);
const error = ref('');
const imageError = ref(false);
const lightboxOpen = ref(false);
const upvoting = ref(false);
const shareConfirmed = ref(false);

const concertId = computed(() => String(route.params.id || '').trim());

const resolvedPoster = computed(() =>
  resolvePosterUrl(concert.value?.posterUrl),
);

const hasPoster = computed(
  () => Boolean(resolvedPoster.value) && !imageError.value,
);

const handleImageError = () => {
  imageError.value = true;
};

const safeTicketUrl = computed(() =>
  buildOutboundTicketUrl(concert.value?.ticketUrl),
);

const sortedLineup = computed(() => {
  if (!concert.value?.lineup) return [];
  return [...concert.value.lineup].sort(
    (a, b) => a.performanceOrder - b.performanceOrder,
  );
});

const sortedSets = computed(() => {
  if (!concert.value?.sets) return [];
  return [...concert.value.sets].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
});

const artistNames = computed(() =>
  extractOrderedArtistNames(concert.value?.lineup),
);

const artistHeadline = computed(() => {
  if (!concert.value) return '';
  return artistNames.value.length > 0
    ? artistNames.value.join(' · ')
    : concert.value.title;
});

const distinctEventTitle = computed(() =>
  concert.value
    ? resolveDistinctEventTitle(concert.value.title, artistNames.value)
    : '',
);

const artistInitials = computed(() =>
  computeArtistInitials(artistHeadline.value || concert.value?.title),
);

const genreThemeClass = computed(
  () =>
    `concert-detail__fallback--${resolveGenreThemeVariant(concert.value?.genre)}`,
);

const formattedDateRange = computed(() => {
  if (!concert.value?.startsAt) return '';
  const start = new Date(concert.value.startsAt);
  const startStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(start);

  if (!concert.value.endsAt) return startStr;
  const end = new Date(concert.value.endsAt);
  const endStr = formatTimeOnly(concert.value.endsAt);
  return Number.isNaN(end.getTime()) ? startStr : `${startStr} – ${endStr}`;
});

function formatTimeOnly(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

const venueCityState = computed(() => {
  const v = concert.value?.venue;
  if (!v) return '';
  return [v.city, v.region].filter(Boolean).join(', ');
});

const fullVenueAddress = computed(() =>
  formatFullVenueAddress(concert.value?.venue),
);

const googleMapsUrl = computed(() =>
  buildGoogleMapsVenueUrl(concert.value?.venue),
);

const googleCalendarUrl = computed(() =>
  concert.value
    ? buildGoogleCalendarTemplateUrl(concert.value)
    : 'https://calendar.google.com/calendar/render',
);

const canonicalConcertUrl = computed(() => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://nido-api-9ed65.web.app';
  return concert.value?.id
    ? `${origin}/concerts/${encodeURIComponent(concert.value.id)}`
    : `${origin}/concerts`;
});

useDocumentMeta(() => {
  if (!concert.value) {
    return {
      title: error.value
        ? 'Concert Not Found | EZ Vibes Concerts'
        : 'EZ Vibes Concerts',
      canonicalUrl: canonicalConcertUrl.value,
      jsonLd: null,
    };
  }

  const { title, description } = buildConcertMetaSummary(concert.value);
  const posterImage = hasPoster.value ? resolvedPoster.value : null;
  return {
    title,
    description,
    canonicalUrl: canonicalConcertUrl.value,
    ogType: 'event',
    ogImage: posterImage,
    jsonLd: buildConcertStructuredData(
      concert.value,
      canonicalConcertUrl.value,
      posterImage,
    ),
  };
});

const handleDownloadIcs = () => {
  if (!concert.value) return;
  const ics = buildConcertIcsContent(concert.value);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug =
    concert.value.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'concert';
  link.href = url;
  link.download = `${slug}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const handleShare = async () => {
  if (!concert.value) return;
  const shareUrl = window.location.href;
  const shareData = {
    title: concert.value.title,
    text: `${artistHeadline.value}${concert.value.venue?.name ? ` at ${concert.value.venue.name}` : ''}`,
    url: shareUrl,
  };

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(shareData);
      return;
    } catch {
      // Fall back to clipboard if user cancels or share fails
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareUrl);
    shareConfirmed.value = true;
    window.setTimeout(() => {
      shareConfirmed.value = false;
    }, 2500);
  }
};

const handleToggleUpvote = async () => {
  if (!concert.value || !user.value || upvoting.value) return;
  upvoting.value = true;
  try {
    const token = await user.value.getIdToken();
    const response = concert.value.upvotedByMe
      ? await removeConcertUpvote(token, concert.value.id)
      : await upvoteConcert(token, concert.value.id);
    concert.value = {
      ...concert.value,
      upvoteCount: response.upvoteCount,
      upvotedByMe: response.upvotedByMe,
      trendingWeekUpvotes: response.trendingWeekUpvotes,
    };
  } catch (err) {
    console.error('Failed to update concert upvote:', err);
  } finally {
    upvoting.value = false;
  }
};

const loadConcert = async () => {
  if (!concertId.value) {
    error.value = 'Missing concert ID.';
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  imageError.value = false;
  try {
    const token = user.value ? await user.value.getIdToken() : undefined;
    concert.value = await fetchConcertById(concertId.value, token);
  } catch {
    concert.value = null;
    error.value =
      'This concert could not be found or is awaiting editorial approval.';
  } finally {
    loading.value = false;
  }
};

watch(concertId, () => {
  void loadConcert();
});

onMounted(() => {
  void loadConcert();
});
</script>

<style scoped>
.concert-detail-page {
  display: grid;
  gap: 1.5rem;
  max-width: 1080px;
  margin: 0 auto;
  padding: 1rem 0 3rem;
}

.concert-detail-page__nav {
  display: flex;
  align-items: center;
}

.concert-detail-page__back {
  color: var(--text-light);
  text-decoration: none;
  font-weight: 700;
  font-size: 0.92rem;
}

.concert-detail-page__back:hover {
  color: var(--primary);
}

.concert-detail-page__state {
  padding: 3rem 1.5rem;
  text-align: center;
  border: 1px dashed var(--border);
  border-radius: 1rem;
  background: var(--card-bg);
  color: var(--text-light);
}

.concert-detail-page__state--error h2 {
  margin: 0 0 0.5rem;
  color: var(--text-dark);
}

.concert-detail-page__cta-btn {
  display: inline-flex;
  margin-top: 1rem;
  padding: 0.65rem 1.25rem;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}

.concert-detail {
  display: grid;
  gap: 1.75rem;
}

.concert-detail__hero {
  display: grid;
  gap: 1.75rem;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 14px 30px rgba(31, 41, 55, 0.08);
}

.concert-detail__poster {
  position: relative;
  background: #111827;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.concert-detail__poster--zoomable {
  cursor: zoom-in;
}

.concert-detail__poster-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.concert-detail__zoom-hint {
  position: absolute;
  bottom: 0.65rem;
  right: 0.65rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.78);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}

.concert-detail__fallback {
  width: 100%;
  height: 100%;
  min-height: 280px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  box-sizing: border-box;
}

.concert-detail__fallback--electronic {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #065f46 100%);
  color: #34d399;
}

.concert-detail__fallback--rock {
  background: linear-gradient(135deg, #18181b 0%, #450a0a 50%, #27272a 100%);
  color: #f87171;
}

.concert-detail__fallback--jazz {
  background: linear-gradient(135deg, #0c1a30 0%, #311b92 50%, #4a148c 100%);
  color: #fbbf24;
}

.concert-detail__fallback--acoustic {
  background: linear-gradient(135deg, #14281d 0%, #1c3d28 50%, #3d2d1c 100%);
  color: #fcd34d;
}

.concert-detail__fallback--hiphop {
  background: linear-gradient(135deg, #111827 0%, #581c87 50%, #1f2937 100%);
  color: #c084fc;
}

.concert-detail__fallback--default {
  background: linear-gradient(135deg, #111827 0%, #1f2937 50%, #064e3b 100%);
  color: #34d399;
}

.concert-detail__fallback-pattern {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.concert-detail__fallback-svg {
  width: 100%;
  height: 100%;
}

.concert-detail__fallback-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  text-align: center;
}

.concert-detail__fallback-badge {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.concert-detail__fallback-initials {
  font-size: 3.4rem;
  font-weight: 900;
  color: #fff;
  margin: auto 0;
}

.concert-detail__fallback-brand {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.8);
}

.concert-detail__main {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.concert-detail__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.concert-detail__badge {
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(44, 102, 74, 0.25);
  background: rgba(44, 102, 74, 0.1);
  color: #285d33;
  font-size: 0.74rem;
  font-weight: 800;
  text-transform: uppercase;
}

.concert-detail__badge--featured {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.concert-detail__badge--top-pick {
  background: #ede9fe;
  border-color: #8b5cf6;
  color: #5b21b6;
}

.concert-detail__datetime {
  color: #059669;
  font-size: 0.92rem;
  font-weight: 800;
  text-transform: uppercase;
}

.concert-detail__artist {
  margin: 0;
  font-size: 2rem;
  line-height: 1.15;
}

.concert-detail__subtitle {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-light);
}

.concert-detail__venue-summary {
  margin: 0;
  font-size: 1.02rem;
}

.concert-detail__description {
  margin: 0.35rem 0 0;
  line-height: 1.6;
  white-space: pre-line;
}

.concert-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.75rem;
}

.concert-detail__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1.05rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  color: var(--text-dark);
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.concert-detail__btn:hover:not(:disabled) {
  border-color: var(--primary);
}

.concert-detail__btn--primary {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.concert-detail__btn--upvoted {
  border-color: #2f8f45;
  background: rgba(47, 143, 69, 0.14);
  color: #1f7a38;
}

.concert-detail__sections {
  display: grid;
  gap: 1.25rem;
}

.concert-detail__card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 1.35rem;
  display: grid;
  gap: 0.85rem;
}

.concert-detail__section-title {
  margin: 0;
  font-size: 1.2rem;
}

.concert-detail__lineup {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}

.concert-detail__lineup-item {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--border);
}

.concert-detail__lineup-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.concert-detail__lineup-info {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.concert-detail__band-name {
  font-weight: 800;
  font-size: 1.05rem;
}

.concert-detail__role-pill {
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #f1f5f9;
  color: #475569;
}

.concert-detail__role-pill--headliner {
  background: #dcfce7;
  color: #166534;
}

.concert-detail__band-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.concert-detail__genre-tag {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-light);
}

.concert-detail__subsection-title {
  margin: 0.5rem 0 0.35rem;
  font-size: 0.95rem;
}

.concert-detail__set-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.concert-detail__set-item {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.92rem;
}

.concert-detail__set-time {
  color: var(--text-light);
  margin-left: auto;
}

.concert-detail__venue-name {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 800;
}

.concert-detail__venue-address,
.concert-detail__venue-capacity {
  margin: 0;
  color: var(--text-light);
}

.concert-detail__maps-link {
  justify-self: start;
  margin-top: 0.25rem;
}

.concert-detail__lightbox {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.concert-detail__lightbox-inner {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: grid;
  gap: 0.75rem;
  justify-items: end;
}

.concert-detail__lightbox-close {
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(15, 23, 42, 0.8);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.concert-detail__lightbox-img {
  max-width: 90vw;
  max-height: 82vh;
  object-fit: contain;
  border-radius: 8px;
}

@media (min-width: 768px) {
  .concert-detail__hero {
    grid-template-columns: 320px 1fr;
    padding: 2rem;
  }

  .concert-detail__sections {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
}
</style>
