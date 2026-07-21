<script setup>
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import oaLogo from './assets/oa-logo.svg';

const route = useRoute();
const isPrint = computed(() => route.name === 'print');
</script>

<template>
  <div class="app" :class="{ 'app--print': isPrint }">
    <header v-if="!isPrint" class="app-header">
      <router-link to="/" class="brand" aria-label="OA For Today">
        <img :src="oaLogo" alt="OA For Today" class="brand-logo" />
      </router-link>
    </header>

    <main class="app-main">
      <router-view />
    </main>

    <nav v-if="!isPrint" class="tabbar" aria-label="Main">
      <router-link to="/" class="tab" :class="{ active: route.name === 'today' || route.name === 'day' }">
        <span class="tab-icon" aria-hidden="true">&#9788;</span>
        <span>Today</span>
      </router-link>
      <router-link to="/month" class="tab" :class="{ active: route.name === 'month' }">
        <span class="tab-icon" aria-hidden="true">&#9636;</span>
        <span>Month</span>
      </router-link>
      <router-link to="/account" class="tab" :class="{ active: route.name === 'account' }">
        <span class="tab-icon" aria-hidden="true">&#9862;</span>
        <span>Account</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  max-width: 720px;
  margin: 0 auto;
}

.app--print {
  max-width: none;
}

.app-header {
  padding: calc(env(safe-area-inset-top, 0px) + 14px) 20px 10px;
}

.brand {
  display: block;
  text-decoration: none;
  max-width: 100%;
  margin: 0 auto;
  text-align: center;
}

/* Wordmark is ~5:1 — never force it into a square or it disappears */
.brand-logo {
  display: block;
  width: min(280px, 100%);
  height: auto;
  max-height: 48px;
  margin: 0 auto;
  object-fit: contain;
  object-position: center;
}

@media (prefers-color-scheme: dark) {
  /* Official mark is black; invert so it stays visible on dark backgrounds */
  .brand-logo {
    filter: invert(1);
  }
}

.app-main {
  flex: 1;
  padding: 8px 20px 24px;
}

.tabbar {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: var(--surface);
  border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px 8px;
  min-height: 56px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
  text-decoration: none;
}

.tab.active {
  color: var(--brand);
}

.tab-icon {
  font-size: 22px;
  line-height: 1;
}
</style>
