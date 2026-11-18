<template>
  <div
    class="onboarding-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="onboarding-title"
  >
    <div class="onboarding-modal">
      <p class="onboarding-modal__eyebrow">Welcome to EZ Vibes</p>
      <h2 id="onboarding-title">
        Are you a Venue Partner or discovering live music?
      </h2>
      <p class="onboarding-modal__subtitle">
        Enter your Venue Partner invite code to verify your venue and unlock
        1-click poster publishing, or continue directly as a fan.
      </p>

      <div class="onboarding-modal__invite-block">
        <label for="venue-partner-invite-code">
          Venue Partner Invite Code
        </label>
        <input
          id="venue-partner-invite-code"
          v-model="inviteCode"
          type="text"
          placeholder="e.g. NIDO-8F3K9A2B"
          autocomplete="off"
          :disabled="isSubmitting"
          data-testid="partner-invite-input"
          @keydown.enter.prevent="handleRedeemInvite"
        />
        <p class="onboarding-modal__hint">
          Venue claims are invite-only to protect official venue listings.
        </p>
      </div>

      <p
        v-if="submitError"
        class="onboarding-modal__error"
        data-testid="onboarding-error"
      >
        {{ submitError }}
      </p>

      <div class="onboarding-modal__actions">
        <button
          type="button"
          class="btn-claim"
          :disabled="!inviteCode.trim() || isSubmitting"
          data-testid="redeem-invite-btn"
          @click="handleRedeemInvite"
        >
          {{ isSubmitting ? 'Verifying…' : 'Redeem Invite & Continue' }}
        </button>
        <button
          type="button"
          class="btn-skip"
          :disabled="isSubmitting"
          data-testid="skip-fan-btn"
          @click="handleSkipAsFan"
        >
          I'm discovering live music (Continue as Fan)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  PARTNER_INVITE_STORAGE_KEY,
  useAuth,
} from '../../composables/useAuth';

const { completeOnboarding } = useAuth();

const inviteCode = ref('');
const isSubmitting = ref(false);
const submitError = ref('');

const clearStoredInviteCode = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(PARTNER_INVITE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

const handleRedeemInvite = async () => {
  const code = inviteCode.value.trim().toUpperCase();
  if (!code || isSubmitting.value) {
    return;
  }
  isSubmitting.value = true;
  submitError.value = '';
  try {
    await completeOnboarding({ inviteCode: code });
    clearStoredInviteCode();
  } catch (error: any) {
    console.error('Failed to redeem venue partner invite:', error);
    submitError.value =
      error?.response?.data?.message ||
      'Invalid or expired venue partner invite code. Please check your code or continue as a fan.';
  } finally {
    isSubmitting.value = false;
  }
};

const handleSkipAsFan = async () => {
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  submitError.value = '';
  try {
    await completeOnboarding({ skipAsFan: true });
    clearStoredInviteCode();
  } catch (error) {
    console.error('Failed to complete onboarding:', error);
    submitError.value = 'Could not complete onboarding. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(PARTNER_INVITE_STORAGE_KEY);
      if (stored) {
        inviteCode.value = stored.trim().toUpperCase();
      }
    }
  } catch {
    // Ignore sessionStorage read errors
  }
});
</script>

<style scoped>
.onboarding-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 23, 42, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.onboarding-modal {
  width: 100%;
  max-width: 500px;
  background: var(--card-bg, #ffffff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 1rem;
  padding: 1.75rem;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
}

.onboarding-modal__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primary, #2563eb);
}

.onboarding-modal h2 {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  line-height: 1.25;
}

.onboarding-modal__subtitle {
  margin: 0 0 1.25rem;
  color: var(--text-light, #475569);
  line-height: 1.5;
}

.onboarding-modal__invite-block label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.4rem;
  font-size: 0.9rem;
}

.onboarding-modal__invite-block input {
  width: 100%;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border, #cbd5e1);
  border-radius: 0.5rem;
  font-size: 1rem;
  font-family: monospace;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-sizing: border-box;
}

.onboarding-modal__hint {
  margin: 0.45rem 0 0;
  color: var(--text-light, #64748b);
  font-size: 0.82rem;
}

.onboarding-modal__error {
  margin: 0.75rem 0 0;
  color: #b91c1c;
  font-size: 0.9rem;
  font-weight: 600;
}

.onboarding-modal__actions {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.btn-claim {
  padding: 0.8rem 1.25rem;
  border-radius: 9999px;
  border: none;
  background: var(--primary, #2563eb);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.btn-claim:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-skip {
  padding: 0.75rem 1.25rem;
  border-radius: 9999px;
  border: 1px solid var(--border, #cbd5e1);
  background: transparent;
  color: var(--text-dark, #0f172a);
  font-weight: 600;
  cursor: pointer;
}
</style>
