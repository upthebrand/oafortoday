import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getQuestion, dateKey } from '../data/questions.js';

const SETTINGS_KEY = 'oa-notify-v1';
const isNative = Capacitor.isNativePlatform();

// discreet: when true (the default), reminders never show the question or
// mention OA -- nothing sensitive appears on a lock screen.
const DEFAULTS = { enabled: false, time: '08:00', discreet: true };

function loadSettings() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

const DISCREET_BODY = 'Your daily reflection is ready.';

const settings = ref(loadSettings());

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings.value));
}

// On native, schedule the next 14 daily reminders (re-scheduled every time
// the app opens, so the window keeps rolling forward).
async function scheduleNative() {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel(pending);
  }
  if (!settings.value.enabled) return;

  const [hour, minute] = settings.value.time.split(':').map(Number);
  const notifications = [];
  const now = new Date();

  for (let i = 0; i < 14; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute);
    if (at <= now) continue;
    const body = settings.value.discreet
      ? DISCREET_BODY
      : getQuestion(at.getMonth() + 1, at.getDate()) || DISCREET_BODY;
    notifications.push({
      id: i + 1,
      title: 'For Today',
      body,
      schedule: { at },
      smallIcon: 'ic_stat_icon',
    });
  }
  if (notifications.length) {
    await LocalNotifications.schedule({ notifications });
  }
}

// Web fallback: fire a notification when the app is open and the reminder
// time passes. (Web can't wake up a closed tab without a push server.)
let webTimer = null;

function scheduleWeb() {
  if (webTimer) clearTimeout(webTimer);
  if (!settings.value.enabled || Notification.permission !== 'granted') return;

  const [hour, minute] = settings.value.time.split(':').map(Number);
  const now = new Date();
  let at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  if (at <= now) at.setDate(at.getDate() + 1);

  const firedKey = 'oa-notify-fired';
  webTimer = setTimeout(() => {
    const today = dateKey(new Date());
    if (localStorage.getItem(firedKey) !== today) {
      const body = settings.value.discreet
        ? DISCREET_BODY
        : getQuestion(now.getMonth() + 1, now.getDate()) || DISCREET_BODY;
      new Notification('For Today', { body });
      localStorage.setItem(firedKey, today);
    }
    scheduleWeb();
  }, at - now);
}

export function useNotifications() {
  return {
    settings,
    isNative,

    supported: isNative || 'Notification' in window,

    async enable(time) {
      if (time) settings.value.time = time;

      if (isNative) {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') {
          return { ok: false, message: 'Notifications are blocked. You can allow them in your phone\u2019s Settings.' };
        }
        settings.value.enabled = true;
        saveSettings();
        await scheduleNative();
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          return { ok: false, message: 'Notifications are blocked for this site in your browser settings.' };
        }
        settings.value.enabled = true;
        saveSettings();
        scheduleWeb();
      }
      return { ok: true };
    },

    async disable() {
      settings.value.enabled = false;
      saveSettings();
      if (isNative) {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length) await LocalNotifications.cancel(pending);
      } else if (webTimer) {
        clearTimeout(webTimer);
      }
    },

    async setTime(time) {
      settings.value.time = time;
      saveSettings();
      if (settings.value.enabled) {
        if (isNative) await scheduleNative();
        else scheduleWeb();
      }
    },

    async setDiscreet(discreet) {
      settings.value.discreet = discreet;
      saveSettings();
      if (settings.value.enabled && isNative) {
        await scheduleNative();
      }
    },

    // Called on app startup to keep the native schedule rolling.
    async refresh() {
      if (!settings.value.enabled) return;
      if (isNative) await scheduleNative();
      else scheduleWeb();
    },
  };
}
