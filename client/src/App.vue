<script setup lang="ts">
import { useAuth } from './composables/useAuth';
import { routeLoading } from './stores/routeLoading';

const { user, signOut } = useAuth();
</script>

<template>
  <div id="app-layout">
    <transition name="route-fade">
      <div v-if="routeLoading" class="route-loading">
        <div class="route-loading__dot"></div>
      </div>
    </transition>
    <header class="header">
      <div class="container">
        <router-link to="/" class="logo-link"><h1 class="logo">Carolina Live Music</h1></router-link>
        <nav v-if="user">
          <span class="user-email">{{ user.email }}</span>
          <router-link to="/events" class="nav-link">Events</router-link>
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

.route-loading {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(244, 246, 244, 0.8);
  backdrop-filter: blur(4px);
  z-index: 999;
}

.route-loading__dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--primary);
  animation: route-pulse 0.8s ease-in-out infinite;
}

@keyframes route-pulse {
  0% {
    transform: scale(0.7);
    opacity: 0.6;
  }
  70% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.7);
    opacity: 0.6;
  }
}

.route-fade-enter-active,
.route-fade-leave-active {
  transition: opacity 0.2s ease;
}

.route-fade-enter-from,
.route-fade-leave-to {
  opacity: 0;
}
</style>
