<template>
  <div class="home-container">
    <div class="hero-section">
      <h1 class="headline">EZ VIBES</h1>
      <p class="sub-headline">
        Discover and share live music events. Join now and start vibing.
      </p>
      <div class="button-group">
        <button class="btn btn-primary" @click="signInWithGoogle">Sign up with Google</button>
        <router-link to="/login" class="btn btn-secondary">Sign up with Email</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '../composables/useAuth';

const { signInWithGoogle } = useAuth();
</script>

<style scoped>
.hero-section {
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.headline {
  font-family: "Georgia", "Palatino", serif;
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
  border-color: #D1D5DB;
}
</style>
