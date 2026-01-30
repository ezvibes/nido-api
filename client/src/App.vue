<script setup lang="ts">
import { useAuth } from './composables/useAuth';

const { user, signOut } = useAuth();
</script>

<template>
  <div id="app-layout">
    <header class="header">
      <div class="container">
        <router-link to="/" class="logo-link"><h1 class="logo">Ez Vibes</h1></router-link>
        <nav v-if="user">
          <span class="user-email">{{ user.email }}</span>
          <router-link to="/profile" class="nav-link">Profile</router-link>
          <a href="#" @click.prevent="signOut" class="nav-link">Sign Out</a>
        </nav>
        <nav v-else>
          <router-link to="/" class="nav-link">Home</router-link>
          <router-link to="/login" class="nav-link">Login</router-link>
        </nav>
      </div>
    </header>
    <main class="main-content">
      <div class="container">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style>
/* Design System Inspired by Dribbble */

:root {
  --background: #F4F6F4;
  --text-dark: #3A4F39;
  --text-light: #6B7280;
  --primary: #3A4F39;
  --primary-hover: #2F402E;
  --secondary-bg: #E5E7EB;
  --secondary-hover: #D1D5DB;
  --border: #E2E8F0;
  --card-bg: #FFFFFF;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--background);
  color: var(--text-dark);
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Header & Navigation */
.header {
  background-color: var(--card-bg);
  border-bottom: 1px solid var(--border);
  padding: 1.5rem 0;
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-family: "Georgia", "Palatino", serif;
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: 0.025em;
}

.logo-link {
  text-decoration: none;
  color: inherit;
}

nav a.nav-link, nav .user-email, nav a.sign-out-link {
  margin-left: 2rem;
  text-decoration: none;
  color: var(--text-light);
  font-weight: 500;
  font-size: 0.95rem;
}

nav a.router-link-exact-active {
  color: var(--text-dark);
}

.sign-out-link {
  cursor: pointer;
}

/* Main Content Area */
.main-content {
  padding: 4rem 0;
}
</style>
