<script setup>
import { computed, onMounted } from 'vue';
import { QUESTIONS, MONTH_NAMES, daysInMonth, dateKey } from '../data/questions.js';
import { useAnswers } from '../stores/answers.js';
import oaLogo from '../assets/oa-logo.svg';

const props = defineProps({
  year: { type: String, required: true },
  month: { type: String, required: true },
});

const y = computed(() => Number(props.year));
const m = computed(() => Number(props.month));
const { answers } = useAnswers();

const days = computed(() => {
  const total = daysInMonth(m.value, y.value);
  const list = [];
  for (let d = 1; d <= total; d++) {
    const key = dateKey(new Date(y.value, m.value - 1, d));
    list.push({
      day: d,
      question: QUESTIONS[m.value][d - 1],
      answer: answers.value[key]?.text || '',
    });
  }
  return list;
});

function printPage() {
  window.print();
}

onMounted(() => {
  // Give fonts a beat to load before opening the print dialog.
  setTimeout(printPage, 400);
});
</script>

<template>
  <article class="print-page">
    <div class="print-toolbar">
      <router-link to="/month" class="btn btn-ghost">&#8592; Back</router-link>
      <button class="btn btn-primary" @click="printPage">Print</button>
    </div>

    <header class="print-header">
      <img :src="oaLogo" alt="OA For Today" class="print-logo" />
      <h1 class="print-title">Workbook &mdash; {{ MONTH_NAMES[m - 1] }} {{ y }}</h1>
    </header>

    <section v-for="d in days" :key="d.day" class="print-day">
      <h2 class="print-day-title">{{ MONTH_NAMES[m - 1] }} {{ d.day }}</h2>
      <p class="print-question">{{ d.question }}</p>
      <p v-if="d.answer" class="print-answer">{{ d.answer }}</p>
      <div v-else class="write-lines" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="line"></div>
      </div>
    </section>

    <p class="print-credit">
      Questions from the <em>For Today Workbook</em>, &copy; Overeaters Anonymous, Inc.
    </p>
  </article>
</template>

<style scoped>
.print-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px;
  background: #fff;
  color: #1c1c1c;
}

.print-toolbar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.print-header {
  border-bottom: 2px solid #1c1c1c;
  padding-bottom: 10px;
  margin-bottom: 8px;
}

.print-logo {
  display: block;
  width: min(320px, 100%);
  height: auto;
  max-height: 52px;
  object-fit: contain;
  object-position: left center;
  margin-bottom: 8px;
}

.print-title {
  font-size: 20px;
  margin: 0;
}

.print-day {
  margin: 22px 0;
  break-inside: avoid;
}

.print-day-title {
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.print-question {
  font-family: var(--font-serif);
  font-size: 17px;
  margin: 0 0 10px;
}

.print-answer {
  margin: 0;
  padding: 10px 14px;
  border-left: 3px solid #888;
  white-space: pre-wrap;
  font-size: 15px;
}

.write-lines .line {
  border-bottom: 1px solid #bbb;
  height: 26px;
}

.print-credit {
  margin-top: 32px;
  font-size: 13px;
  color: #555;
}

@media print {
  .print-toolbar {
    display: none;
  }
  .print-page {
    padding: 0;
  }
}
</style>
