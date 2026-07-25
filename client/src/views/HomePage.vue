<template>
  <div class="home-container">
    <div class="hero-section">
      <h1 class="headline">EZ VIBES</h1>
      <p class="sub-headline">
        Discover live concerts and the bands bringing them to your city.
      </p>
      <div class="button-group">
        <router-link to="/concerts" class="btn btn-primary">
          Browse Concerts
        </router-link>
        <button
          v-if="!user"
          class="btn btn-secondary"
          @click="signInWithGoogle"
        >
          Sign up with Google
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '../composables/useAuth';

const { user, signInWithGoogle } = useAuth();
</script>

<style scoped>
.hero-section {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.headline {
  font-family: 'Georgia', 'Palatino', serif;
  font-size: 3.5rem;
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.sub-headline {
  margin-top: 1.5rem;
  font-size: 1.25rem;
  color: var(--text-light);
}

.button-group {
  margin-top: 2.5rem;
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.btn {
  display: inline-block;
  padding: 0.85rem 2rem;
  border: 1px solid transparent;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  text-decoration: none;
  letter-spacing: 0.025em;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

.btn-secondary {
  background-color: transparent;
  color: var(--text-dark);
  border-color: var(--border);
}

.btn-secondary:hover {
  background-color: var(--background);
  border-color: #d1d5db;
}
</style>
