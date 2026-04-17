<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAuth } from './composables/useAuth';
import { routeLoading } from './stores/routeLoading';

const { user, signOut } = useAuth();
const menuOpen = ref(false);
const accountMenuOpen = ref(false);
const homeRoute = computed(() => (user.value ? '/events' : '/'));
const displayName = computed(() => user.value?.displayName || user.value?.email || 'Account');

const closeMenu = () => {
  menuOpen.value = false;
  accountMenuOpen.value = false;
};

const handleSignOut = async () => {
  await signOut();
  closeMenu();
};

const toggleAccountMenu = () => {
  accountMenuOpen.value = !accountMenuOpen.value;
};
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
        <router-link :to="homeRoute" class="logo-link" @click="closeMenu">
          <h1 class="logo">EZ VIBES</h1>
        </router-link>

        <button
          type="button"
          class="menu-toggle"
          :aria-expanded="menuOpen"
          aria-controls="header-menu"
          @click="menuOpen = !menuOpen"
        >
          Menu
        </button>

        <nav id="header-menu" class="header-menu" :class="{ 'header-menu--open': menuOpen }">
          <router-link v-if="user" to="/events" class="nav-link" @click="closeMenu">Events</router-link>
          <router-link v-else to="/" class="nav-link" @click="closeMenu">Home</router-link>
          <router-link v-if="!user" to="/login" class="nav-link nav-link--ghost" @click="closeMenu">Sign in</router-link>
          <div v-if="user" class="account-menu">
            <button
              type="button"
              class="account-menu__button"
              :aria-expanded="accountMenuOpen"
              aria-controls="account-menu-dropdown"
              @click="toggleAccountMenu"
            >
              Menu
              <span class="account-menu__chevron" aria-hidden="true">⌄</span>
            </button>
            <div v-if="accountMenuOpen" id="account-menu-dropdown" class="account-menu__dropdown">
              <div class="account-menu__identity">
                <span class="account-menu__label">Signed in as</span>
                <strong :title="displayName">{{ displayName }}</strong>
              </div>
              <router-link to="/settings" class="account-menu__item" @click="closeMenu">
                Settings
              </router-link>
              <button type="button" class="account-menu__item account-menu__item--button" @click="handleSignOut">
                Log out
              </button>
            </div>
          </div>
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
:root {
  --background: #f7f7f5;
  --surface: #ffffff;
  --surface-soft: #fbfbfa;
  --text: #1f2933;
  --text-dark: #1f2933;
  --text-muted: #5f6b76;
  --text-light: #5f6b76;
  --border: #e5e7eb;
  --mint: #35d399;
  --accent: #f05537;
  --accent-hover: #d94428;
  --primary: #f05537;
  --primary-hover: #d94428;
  --card-bg: #ffffff;
  --shadow: 0 10px 30px rgba(31, 41, 51, 0.08);
}

body {
  margin: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
    Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--background);
  color: var(--text);
}

.container {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 1rem;
}

.header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow);
}

.header .container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 72px;
}

.logo-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: var(--mint);
  min-width: 0;
}

.logo {
  margin: 0;
  color: var(--mint);
  font-size: 1.1rem;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.menu-toggle {
  display: none;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-weight: 600;
}

.header-menu {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.95rem;
  white-space: nowrap;
}

.nav-link:hover {
  background: var(--surface-soft);
  color: var(--text);
}

.nav-link.router-link-exact-active {
  color: var(--accent);
}

.nav-link--ghost {
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--surface);
}

.nav-link--ghost:hover {
  border-color: rgba(240, 85, 55, 0.24);
  color: var(--accent);
}

.account-menu {
  position: relative;
}

.account-menu__button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2.5rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
}

.account-menu__button:hover {
  border-color: rgba(240, 85, 55, 0.24);
  color: var(--accent);
}

.account-menu__chevron {
  font-size: 0.9rem;
  line-height: 1;
}

.account-menu__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 50;
  min-width: 15rem;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.account-menu__identity {
  padding: 0.625rem 0.75rem 0.75rem;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}

.account-menu__label {
  display: block;
  margin-bottom: 0.2rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.account-menu__identity strong {
  display: block;
  max-width: 13rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
}

.account-menu__item {
  display: flex;
  width: 100%;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  box-sizing: border-box;
  text-align: left;
  text-decoration: none;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 600;
}

.account-menu__item:hover {
  background: var(--surface-soft);
  color: var(--accent);
}

.account-menu__item--button {
  cursor: pointer;
}

.nav-link--ghost,
.account-menu__button {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.main-content {
  padding: 4rem 0;
}

.route-loading {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: grid;
  place-items: center;
  background: rgba(244, 246, 244, 0.72);
  backdrop-filter: blur(3px);
}

.route-loading__dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--accent);
  animation: route-pulse 0.85s ease-in-out infinite;
}

@keyframes route-pulse {
  0% {
    transform: scale(0.7);
    opacity: 0.55;
  }
  70% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.7);
    opacity: 0.55;
  }
}

.route-fade-enter-active,
.route-fade-leave-active {
  transition: opacity 0.18s ease;
}

.route-fade-enter-from,
.route-fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .header .container {
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .header-menu {
    display: none;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0.375rem;
    padding: 0.25rem 0 0.5rem;
  }

  .header-menu--open {
    display: flex;
  }

  .nav-link,
  .account-menu,
  .account-menu__button {
    width: 100%;
  }

  .nav-link,
  .account-menu__button {
    justify-content: space-between;
  }

  .account-menu__dropdown {
    position: static;
    margin-top: 0.375rem;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
