<template>
  <article class="event-card">
    <div class="poster">
      <img :src="event.imageUrl" :alt="`${event.title} poster`" loading="lazy" />
    </div>
    <div class="card-body">
      <h3 class="title" :title="event.title">{{ event.title }}</h3>
      <p class="venue">{{ event.venue.name }}</p>
      <p class="location">{{ event.venue.city }}, {{ event.venue.state }}</p>
      <p class="time">{{ formattedDate }}</p>
      <div class="tags">
        <span v-for="tag in displayTags" :key="tag" class="tag">{{ tag }}</span>
      </div>
      <button class="details-button" disabled>Tickets</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EventItem } from '../../types/events';

const props = defineProps<{ event: EventItem }>();

const formattedDate = computed(() => {
  const date = new Date(props.event.startsAt);
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return formatter.format(date).replace(',', ' -');
});

const displayTags = computed(() => {
  const combined = [...props.event.genres, ...props.event.vibeTags];
  return Array.from(new Set(combined)).slice(0, 3);
});
</script>

<style scoped>
.event-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
  max-width: 680px;
  width: 100%;
  margin: 0 auto;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.12);
}

.poster {
  width: 100%;
  aspect-ratio: 4 / 5;
  background: #e2e8f0;
  overflow: hidden;
}

.poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.venue {
  font-weight: 600;
  margin: 0;
}

.location {
  margin: 0;
  color: var(--text-light);
}

.time {
  margin: 0.4rem 0 0;
  font-weight: 600;
}

.tags {
  margin-top: 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  justify-content: center;
}

.tag {
  padding: 0.2rem 0.6rem;
  background: var(--secondary-bg);
  border-radius: 999px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.details-button {
  margin-top: 0.8rem;
  align-self: center;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-light);
  font-weight: 600;
  cursor: not-allowed;
}
</style>
