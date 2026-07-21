<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { getQuestion, dateKey, parseDateKey, MONTH_NAMES } from '../data/questions.js';
import { useAnswers } from '../stores/answers.js';
import { useKeys } from '../stores/keys.js';
import { useAuth } from '../stores/auth.js';

const props = defineProps({
  date: { type: String, default: null },
});

const router = useRouter();
const { getAnswer, saveAnswer, canSave } = useAnswers();
const { locked, needsKeySetup } = useKeys();
const { isSignedIn, firebaseEnabled } = useAuth();

const activeDate = computed(() => {
  if (props.date) {
    const { year, month, day } = parseDateKey(props.date);
    return new Date(year, month - 1, day);
  }
  return new Date();
});

const key = computed(() => dateKey(activeDate.value));
const isToday = computed(() => key.value === dateKey(new Date()));
const question = computed(() =>
  getQuestion(activeDate.value.getMonth() + 1, activeDate.value.getDate())
);

const dateLabel = computed(() => {
  const d = activeDate.value;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
});

const weekday = computed(() =>
  activeDate.value.toLocaleDateString(undefined, { weekday: 'long' })
);

const draft = ref(getAnswer(key.value));
const saveState = ref('idle'); // idle | saving | saved | unsaved
let saveTimer = null;

watch(key, (k) => {
  draft.value = getAnswer(k);
  saveState.value = 'idle';
});

watch(
  () => getAnswer(key.value),
  (stored) => {
    if (saveState.value === 'idle' && stored !== draft.value) {
      draft.value = stored;
    }
  }
);

function onInput() {
  clearTimeout(saveTimer);
  if (!canSave()) {
    saveState.value = draft.value.trim() ? 'unsaved' : 'idle';
    return;
  }
  saveState.value = 'saving';
  saveTimer = setTimeout(async () => {
    await saveAnswer(key.value, draft.value);
    saveState.value = 'saved';
    setTimeout(() => {
      if (saveState.value === 'saved') saveState.value = 'idle';
    }, 2000);
  }, 700);
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer);
  if (saveState.value === 'saving' && canSave()) {
    saveAnswer(key.value, draft.value);
  }
});

function go(offsetDays) {
  const d = new Date(activeDate.value);
  d.setDate(d.getDate() + offsetDays);
  const k = dateKey(d);
  if (k === dateKey(new Date())) router.push({ name: 'today' });
  else router.push({ name: 'day', params: { date: k } });
}

const monthLink = computed(() => ({
  name: 'month',
  query: {
    year: String(activeDate.value.getFullYear()),
    month: String(activeDate.value.getMonth() + 1),
  },
}));
</script>

<template>
  <article>
    <div class="day-nav">
      <button class="nav-btn" aria-label="Previous day" @click="go(-1)">&#8592;</button>
      <div class="day-heading">
        <p class="weekday">{{ isToday ? 'Today' : weekday }}</p>
        <h1 class="date">{{ dateLabel }}</h1>
        <router-link class="browse-month" :to="monthLink">
          Browse months &amp; years
        </router-link>
      </div>
      <button class="nav-btn" aria-label="Next day" @click="go(1)">&#8594;</button>
    </div>

    <router-link v-if="!isToday" class="back-today" to="/">Back to today</router-link>

    <div v-if="locked || needsKeySetup" class="locked-banner" role="alert">
      Your journal is locked on this device.
      <router-link to="/account">Unlock it in Account</router-link>
      (password or journal passphrase) to see and save your entries. Anything
      you write here won&rsquo;t be saved until you unlock.
    </div>

    <p v-else-if="firebaseEnabled && !isSignedIn" class="save-note">
      Your answers are only saved if you have an account. An account is not
      required unless you wish to save your answers.
      <router-link to="/account">Sign in or create one</router-link>
    </p>

    <section class="card question-card" aria-labelledby="question-label">
      <p id="question-label" class="eyebrow">{{ isToday ? 'Question for today' : 'Question for this day' }}</p>
      <p class="question">{{ question }}</p>
    </section>

    <section class="card answer-card">
      <label class="field">
        <span class="field-label">My reflection</span>
        <textarea
          v-model="draft"
          rows="8"
          placeholder="Take a moment. Write whatever comes&hellip;"
          @input="onInput"
        ></textarea>
      </label>
      <p class="save-state" role="status" aria-live="polite">
        <span v-if="saveState === 'saving'">Saving&hellip;</span>
        <span v-else-if="saveState === 'saved'" class="saved">Saved &#10003;</span>
        <span v-else-if="saveState === 'unsaved'" class="unsaved">
          Not saved &mdash; <router-link to="/account">sign in to keep this</router-link>
        </span>
        <span v-else>&nbsp;</span>
      </p>
    </section>
  </article>
</template>

<style scoped>
.day-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.nav-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  box-shadow: var(--shadow);
  color: var(--brand);
  font-size: 22px;
}

.day-heading {
  text-align: center;
}

.weekday {
  margin: 0;
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 13px;
}

.date {
  font-size: 26px;
  margin: 0;
}

.browse-month {
  display: inline-block;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
}

.back-today {
  display: block;
  text-align: center;
  margin-bottom: 8px;
  font-weight: 600;
}

.save-note {
  margin: 12px 0;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--brand-soft);
  font-size: 15px;
  color: var(--ink);
}

.locked-banner {
  margin: 12px 0;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--accent) 15%, var(--surface));
  border: 1.5px solid var(--accent);
  font-size: 15px;
}

.question-card {
  margin: 16px 0;
  background: var(--brand-soft);
  box-shadow: none;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--brand);
}

.question {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 24px;
  line-height: 1.4;
}

.answer-card textarea {
  resize: vertical;
  font-family: var(--font-serif);
  line-height: 1.6;
}

.save-state {
  margin: 6px 0 0;
  min-height: 1.4em;
  font-size: 14px;
  color: var(--ink-soft);
  text-align: right;
}

.saved {
  color: var(--brand);
  font-weight: 600;
}

.unsaved {
  color: var(--accent);
  font-weight: 500;
}
</style>
