<template>
  <div class="login-container">
    <form @submit.prevent class="login-form">
      <h2>Sign Up or Sign In</h2>
      <p>Enter your email and password below.</p>
      
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" v-model="email" placeholder="you@example.com" />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" v-model="password" placeholder="••••••••" />
      </div>

      <div class="button-group">
        <button class="btn btn-primary" @click="handleSignUp">Sign Up</button>
        <button class="btn btn-secondary" @click="handleSignIn">Sign In</button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../composables/useAuth';

const email = ref('');
const password = ref('');

const { signUpWithEmail, signInWithEmail } = useAuth();

const handleSignUp = () => {
  signUpWithEmail(email.value, password.value);
};

const handleSignIn = () => {
  signInWithEmail(email.value, password.value);
};
</script>

<style scoped>
.login-form {
  max-width: 400px;
  margin: 0 auto;
  padding: 3rem;
  background-color: var(--card-bg);
  border-radius: 0.75rem;
  border: 1px solid var(--border);
}

.login-form h2 {
  font-size: 1.75rem;
  font-weight: 500;
  font-family: "Georgia", "Palatino", serif;
  text-align: center;
  margin-bottom: 0.5rem;
}

.login-form p {
  text-align: center;
  color: var(--text-light);
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.form-group input {
  display: block;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  box-sizing: border-box;
  background-color: var(--background);
}

.form-group input:focus {
  outline: 2px solid var(--primary);
  border-color: transparent;
}

.button-group {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
}

.btn {
  width: 100%;
  padding: 0.85rem 1.5rem;
  border: 1px solid transparent;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
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
