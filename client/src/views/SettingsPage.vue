<template>
  <section class="settings-page">
    <p class="settings-page__eyebrow">Account</p>
    <h2>Settings</h2>
    <p>Manage your account details and profile preferences.</p>
    <router-link to="/profile" class="settings-page__link">Edit profile</router-link>
  </section>
</template>

<style scoped>
.settings-page {
  max-width: 560px;
  margin: 0 auto;
  padding: 2rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
}

.settings-page__eyebrow {
  margin: 0 0 0.5rem;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

.settings-page h2 {
  margin: 0;
  color: var(--text-dark);
  font-size: 2rem;
  line-height: 1.1;
}

.settings-page p {
  color: var(--text-light);
}

.settings-page__link {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-dark);
  text-decoration: none;
  font-weight: 700;
}

.settings-page__link:hover {
  border-color: rgba(240, 85, 55, 0.24);
  color: var(--accent);
}
</style>
