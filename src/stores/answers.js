import { ref, watch } from 'vue';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase.js';
import { useAuth } from './auth.js';
import { useKeys } from './keys.js';
import { encryptText, decryptText } from '../services/crypto.js';

const LOCAL_KEY = 'oa-answers-v1';

// In-memory, decrypted view for the UI: "YYYY-MM-DD" -> { text, updatedAt }.
// Only populated when the user has an account (and the journal is unlocked).
const answers = ref({});
const syncing = ref(false);

// Entries the server has but this device can't decrypt yet (journal locked).
const undecryptableCount = ref(0);

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(answers.value));
}

function clearLocal() {
  localStorage.removeItem(LOCAL_KEY);
}

function answerRef(uid, key) {
  return doc(db, 'users', uid, 'answers', key);
}

let unsubscribe = null;

if (firebaseEnabled) {
  const { user } = useAuth();
  const { dek } = useKeys();

  // Clear the journal view when signed out — nothing is kept without an account.
  watch(user, (u) => {
    if (!u) {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      answers.value = {};
      undecryptableCount.value = 0;
      clearLocal();
    }
  });

  // Sync starts only when both the user and the decryption key are ready.
  watch(
    [user, dek],
    ([u, key]) => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (!u || !key) {
        if (u && !key) {
          // Signed in but locked: don't show cached plaintext from a prior session.
          answers.value = {};
        }
        return;
      }

      syncing.value = true;

      // Rare: entries written while signed in but momentarily offline before
      // Firestore caught up — still encrypted on next sync via local cache.
      let pendingLocal = { ...loadLocal() };

      const col = collection(db, 'users', u.uid, 'answers');
      unsubscribe = onSnapshot(col, async (snap) => {
        const merged = {};
        let failed = 0;

        for (const d of snap.docs) {
          const data = d.data();
          if (data.ct) {
            try {
              merged[d.id] = {
                text: await decryptText(key, data.ct),
                updatedAt: data.updatedAt || 0,
              };
            } catch {
              failed++;
            }
          } else if (data.text) {
            merged[d.id] = { text: data.text, updatedAt: data.updatedAt || 0 };
            encryptText(key, data.text).then((ct) =>
              setDoc(d.ref, { ct, updatedAt: data.updatedAt || 0 }).catch(() => {})
            );
          }
        }

        for (const [k, v] of Object.entries(pendingLocal)) {
          if (!v.text) continue;
          if (!merged[k] || (v.updatedAt || 0) > (merged[k].updatedAt || 0)) {
            merged[k] = v;
            encryptText(key, v.text).then((ct) =>
              setDoc(answerRef(u.uid, k), { ct, updatedAt: v.updatedAt || 0 }).catch(() => {})
            );
          }
        }
        pendingLocal = {};
        clearLocal();

        answers.value = merged;
        undecryptableCount.value = failed;
        syncing.value = false;
      });
    },
    { immediate: true }
  );
} else {
  // Firebase not configured yet: allow device-only saving so the app is usable
  // before accounts are wired up.
  answers.value = loadLocal();
}

export function useAnswers() {
  const { user } = useAuth();
  const { dek } = useKeys();

  // With Firebase: only persist when signed in and the journal is unlocked.
  // Without Firebase: device-only local save (setup not finished yet).
  const canSave = () => {
    if (!firebaseEnabled) return true;
    return !!user.value && !!dek.value;
  };

  return {
    answers,
    syncing,
    undecryptableCount,
    canSave,

    getAnswer(key) {
      return answers.value[key]?.text || '';
    },

    async saveAnswer(key, text) {
      if (!canSave()) {
        return { ok: false, reason: 'no-account' };
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return this.deleteAnswer(key);
      }
      const entry = { text: trimmed, updatedAt: Date.now() };
      answers.value = { ...answers.value, [key]: entry };

      if (firebaseEnabled && user.value && dek.value) {
        const ct = await encryptText(dek.value, trimmed);
        await setDoc(answerRef(user.value.uid, key), {
          ct,
          updatedAt: entry.updatedAt,
        });
      } else {
        saveLocal();
      }
      return { ok: true };
    },

    async deleteAnswer(key) {
      if (!canSave()) {
        return { ok: false, reason: 'no-account' };
      }

      const next = { ...answers.value };
      delete next[key];
      answers.value = next;

      if (firebaseEnabled && user.value && dek.value) {
        await deleteDoc(answerRef(user.value.uid, key));
      } else {
        saveLocal();
      }
      return { ok: true };
    },
  };
}
