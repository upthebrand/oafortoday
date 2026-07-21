<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { QUESTIONS, MONTH_NAMES, daysInMonth, dateKey } from '../data/questions.js';
import { useAnswers } from '../stores/answers.js';

const route = useRoute();
const router = useRouter();
const now = new Date();

function yearFromQuery() {
  const y = Number(route.query.year);
  return Number.isFinite(y) && y >= 1900 && y <= 2100 ? y : now.getFullYear();
}

function monthFromQuery() {
  const m = Number(route.query.month);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1;
}

const year = ref(yearFromQuery());
const month = ref(monthFromQuery()); // 1-based
const pickerOpen = ref(false);

watch(
  () => [route.query.year, route.query.month],
  () => {
    year.value = yearFromQuery();
    month.value = monthFromQuery();
  }
);

const { answers } = useAnswers();

const days = computed(() => {
  const total = daysInMonth(month.value, year.value);
  const list = [];
  for (let d = 1; d <= total; d++) {
    const date = new Date(year.value, month.value - 1, d);
    const key = dateKey(date);
    list.push({
      day: d,
      key,
      question: QUESTIONS[month.value][d - 1],
      answered: !!answers.value[key]?.text,
      isToday: key === dateKey(new Date()),
    });
  }
  return list;
});

const answeredCount = computed(() => days.value.filter((d) => d.answered).length);

const isCurrentMonth = computed(
  () => year.value === now.getFullYear() && month.value === now.getMonth() + 1
);

function syncQuery() {
  router.replace({
    name: 'month',
    query: { year: String(year.value), month: String(month.value) },
  });
}

function shiftMonth(delta) {
  let m = month.value + delta;
  let y = year.value;
  if (m < 1) {
    m = 12;
    y--;
  }
  if (m > 12) {
    m = 1;
    y++;
  }
  month.value = m;
  year.value = y;
  syncQuery();
}

function shiftYear(delta) {
  year.value += delta;
  syncQuery();
}

function selectMonth(m) {
  month.value = m;
  pickerOpen.value = false;
  syncQuery();
}

function goThisMonth() {
  year.value = now.getFullYear();
  month.value = now.getMonth() + 1;
  pickerOpen.value = false;
  syncQuery();
}
</script>

<template>
  <article>
    <div class="year-nav">
      <button class="nav-btn" aria-label="Previous year" @click="shiftYear(-1)">&#171;</button>
      <div class="year-label">
        <span class="year-num">{{ year }}</span>
        <button
          v-if="!isCurrentMonth"
          type="button"
          class="jump-today"
          @click="goThisMonth"
        >
          This month
        </button>
      </div>
      <button class="nav-btn" aria-label="Next year" @click="shiftYear(1)">&#187;</button>
    </div>

    <div class="month-nav">
      <button class="nav-btn" aria-label="Previous month" @click="shiftMonth(-1)">&#8592;</button>
      <button
        type="button"
        class="month-title"
        :aria-expanded="pickerOpen"
        aria-controls="month-picker"
        @click="pickerOpen = !pickerOpen"
      >
        {{ MONTH_NAMES[month - 1] }}
        <span class="picker-hint" aria-hidden="true">{{ pickerOpen ? '▴' : '▾' }}</span>
      </button>
      <button class="nav-btn" aria-label="Next month" @click="shiftMonth(1)">&#8594;</button>
    </div>

    <div
      v-if="pickerOpen"
      id="month-picker"
      class="month-picker"
      role="listbox"
      aria-label="Choose a month"
    >
      <button
        v-for="(name, i) in MONTH_NAMES"
        :key="name"
        type="button"
        role="option"
        class="month-chip"
        :class="{ active: month === i + 1 }"
        :aria-selected="month === i + 1"
        @click="selectMonth(i + 1)"
      >
        {{ name.slice(0, 3) }}
      </button>
    </div>

    <div class="month-actions">
      <p class="progress">{{ answeredCount }} of {{ days.length }} days answered</p>
      <router-link
        class="btn btn-ghost"
        :to="{ name: 'print', params: { year, month } }"
      >
        Printable version
      </router-link>
    </div>

    <ol class="day-list">
      <li v-for="d in days" :key="d.key">
        <router-link
          class="day-row"
          :class="{ today: d.isToday }"
          :to="d.isToday ? { name: 'today' } : { name: 'day', params: { date: d.key } }"
        >
          <span class="day-num" :class="{ answered: d.answered }" aria-hidden="true">
            {{ d.day }}
          </span>
          <span class="day-question">{{ d.question }}</span>
          <span v-if="d.answered" class="check" aria-label="Answered">&#10003;</span>
        </router-link>
      </li>
    </ol>
  </article>
</template>

<style scoped>
.year-nav,
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.year-nav {
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
  flex-shrink: 0;
}

.year-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.year-num {
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 700;
}

.jump-today {
  border: none;
  background: none;
  color: var(--brand);
  font-weight: 600;
  font-size: 13px;
  padding: 2px 6px;
  min-height: 28px;
}

.month-title {
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  text-align: center;
  border: none;
  background: none;
  color: var(--ink);
  padding: 4px 10px;
  border-radius: 10px;
  min-height: 48px;
}

.month-title:hover {
  background: var(--brand-soft);
}

.picker-hint {
  font-size: 14px;
  color: var(--ink-soft);
  margin-left: 4px;
}

.month-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 12px 0 4px;
  padding: 12px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.month-chip {
  min-height: 44px;
  border: none;
  border-radius: 10px;
  background: var(--bg);
  color: var(--ink);
  font-weight: 600;
  font-size: 14px;
}

.month-chip.active {
  background: var(--brand);
  color: #fff;
}

@media (prefers-color-scheme: dark) {
  .month-chip.active {
    color: #10201c;
  }
}

.month-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 14px 0 18px;
  flex-wrap: wrap;
}

.progress {
  margin: 0;
  color: var(--ink-soft);
  font-weight: 500;
}

.day-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
  color: var(--ink);
  text-decoration: none;
  min-height: 56px;
}

.day-row.today {
  outline: 2px solid var(--brand);
}

.day-num {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--bg);
  font-weight: 700;
  font-family: var(--font-serif);
}

.day-num.answered {
  background: var(--brand);
  color: #fff;
}

@media (prefers-color-scheme: dark) {
  .day-num.answered {
    color: #10201c;
  }
}

.day-question {
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.4;
}

.check {
  margin-left: auto;
  color: var(--brand);
  font-weight: 700;
  flex-shrink: 0;
}
</style>
