<template>
  <aside
    class="newsletter-banner"
    aria-label="Weekly Top Picks newsletter signup"
    data-testid="newsletter-signup-banner"
  >
    <div class="newsletter-banner__copy">
      <p class="newsletter-banner__eyebrow">EZ Vibes Weekly Dispatch</p>
      <h3 class="newsletter-banner__title">
        Get Weekly NC Live Music Top Picks
      </h3>
      <p class="newsletter-banner__subtitle">
        Curated concerts across Raleigh, Durham, Wilmington, and North Carolina
        delivered to your inbox every week.
      </p>
    </div>

    <div
      v-if="submitted"
      class="newsletter-banner__success"
      role="status"
      data-testid="newsletter-signup-success"
    >
      You're on the list! Watch your inbox for this week's Top Picks.
    </div>

    <form
      v-else
      class="newsletter-banner__form"
      data-testid="newsletter-signup-form"
      @submit.prevent="handleSubmit"
    >
      <label class="sr-only" for="newsletter-signup-email">
        Email address
      </label>
      <input
        id="newsletter-signup-email"
        v-model="email"
        type="email"
        required
        placeholder="you@example.com"
        class="newsletter-banner__input"
        :disabled="submitting"
        data-testid="newsletter-email-input"
      />
      <button
        type="submit"
        class="newsletter-banner__btn"
        :disabled="submitting || !email.trim()"
        data-testid="newsletter-submit-btn"
      >
        {{ submitting ? 'Subscribing…' : 'Subscribe Free' }}
      </button>
      <p
        v-if="errorMessage"
        class="newsletter-banner__error"
        role="alert"
        data-testid="newsletter-signup-error"
      >
        {{ errorMessage }}
      </p>
    </form>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { subscribeToNewsletter } from '../../composables/useApi';

const props = withDefaults(
  defineProps<{
    utmSource?: string;
    utmCampaign?: string;
  }>(),
  {
    utmSource: 'nido_web',
    utmCampaign: 'weekly_top_picks',
  },
);

const email = ref('');
const submitting = ref(false);
const submitted = ref(false);
const errorMessage = ref('');

const handleSubmit = async () => {
  const trimmed = email.value.trim();
  if (!trimmed || submitting.value) return;

  submitting.value = true;
  errorMessage.value = '';
  try {
    if (typeof subscribeToNewsletter === 'function') {
      await subscribeToNewsletter({
        email: trimmed,
        utmSource: props.utmSource,
        utmMedium: 'organic',
        utmCampaign: props.utmCampaign,
      });
    }
    submitted.value = true;
    email.value = '';
  } catch {
    errorMessage.value =
      'Unable to subscribe right now. Please check your email and try again.';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.newsletter-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 1.35rem 1.5rem;
  border-radius: 1rem;
  border: 1px solid var(--border, #e5e7eb);
  background: linear-gradient(
    135deg,
    rgba(53, 211, 153, 0.08) 0%,
    rgba(240, 85, 55, 0.06) 100%
  );
}

.newsletter-banner__copy {
  flex: 1 1 280px;
}

.newsletter-banner__eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #059669;
}

.newsletter-banner__title {
  margin: 0 0 0.25rem;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-dark, #1f2933);
}

.newsletter-banner__subtitle {
  margin: 0;
  font-size: 0.92rem;
  color: var(--text-light, #5f6b76);
  line-height: 1.45;
}

.newsletter-banner__form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
  flex: 1 1 300px;
  justify-content: flex-end;
}

.newsletter-banner__input {
  flex: 1 1 200px;
  min-width: 190px;
  padding: 0.7rem 0.95rem;
  border-radius: 999px;
  border: 1px solid var(--border, #d1d5db);
  background: #ffffff;
  font-size: 0.95rem;
  color: var(--text-dark, #1f2933);
}

.newsletter-banner__btn {
  padding: 0.72rem 1.25rem;
  border-radius: 999px;
  border: 1px solid var(--primary, #f05537);
  background: var(--primary, #f05537);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.92rem;
  cursor: pointer;
  white-space: nowrap;
}

.newsletter-banner__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.newsletter-banner__success {
  padding: 0.75rem 1.1rem;
  border-radius: 0.75rem;
  background: #ecfdf3;
  color: #027a48;
  font-weight: 700;
  font-size: 0.92rem;
}

.newsletter-banner__error {
  width: 100%;
  margin: 0.25rem 0 0;
  color: #b42318;
  font-size: 0.85rem;
  font-weight: 600;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
