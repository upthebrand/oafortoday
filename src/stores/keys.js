import { ref } from 'vue';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, firebaseEnabled } from '../services/firebase.js';
import {
  generateDek,
  exportDek,
  importDek,
  deriveKek,
  makeSalt,
  wrapDek,
  unwrapDek,
} from '../services/crypto.js';

const DEK_STORAGE_KEY = 'oa-dek-v1';

// The decryption key for journal entries, held in memory while unlocked.
const dek = ref(null);

// True when the user is signed in but this device can't decrypt yet.
const locked = ref(false);

// True when signed in via Google (or similar) and a journal passphrase has
// not been created yet — first-time setup for OAuth accounts.
const needsKeySetup = ref(false);

// The password / passphrase from the current unlock, kept only in memory so
// we can re-wrap the key after a password change.
let sessionPassword = null;

function cryptoDocRef(uid) {
  return doc(db, 'users', uid, 'meta', 'crypto');
}

function loadLocalDekB64(uid) {
  try {
    const stored = JSON.parse(localStorage.getItem(DEK_STORAGE_KEY));
    return stored && stored.uid === uid ? stored.key : null;
  } catch {
    return null;
  }
}

function storeLocalDek(uid, keyB64) {
  localStorage.setItem(DEK_STORAGE_KEY, JSON.stringify({ uid, key: keyB64 }));
}

export function clearKeys() {
  dek.value = null;
  locked.value = false;
  needsKeySetup.value = false;
  sessionPassword = null;
  localStorage.removeItem(DEK_STORAGE_KEY);
}

async function writeWrappedKey(uid, key, password) {
  const salt = makeSalt();
  const kek = await deriveKek(password, salt);
  const wrapped = await wrapDek(key, kek);
  await setDoc(cryptoDocRef(uid), { v: 1, salt, wrapped });
}

// Called with the account password (email sign-in) or journal passphrase
// (Google sign-in). Creates the key for new accounts, unwraps it for
// existing ones, and re-wraps when the secret has changed if this device
// still holds the key.
export async function unlockWithPassword(uid, password) {
  if (!firebaseEnabled) return { ok: true };
  sessionPassword = password;

  const snap = await getDoc(cryptoDocRef(uid));

  if (!snap.exists()) {
    const key = await generateDek();
    await writeWrappedKey(uid, key, password);
    storeLocalDek(uid, await exportDek(key));
    dek.value = key;
    locked.value = false;
    needsKeySetup.value = false;
    return { ok: true };
  }

  const { salt, wrapped } = snap.data();
  try {
    const kek = await deriveKek(password, salt);
    const key = await unwrapDek(wrapped, kek);
    storeLocalDek(uid, await exportDek(key));
    dek.value = key;
    locked.value = false;
    needsKeySetup.value = false;
    return { ok: true };
  } catch {
    const localB64 = loadLocalDekB64(uid);
    if (localB64) {
      const key = await importDek(localB64);
      dek.value = key;
      locked.value = false;
      needsKeySetup.value = false;
      await writeWrappedKey(uid, key, password);
      return { ok: true };
    }
    dek.value = null;
    locked.value = true;
    needsKeySetup.value = false;
    return { ok: false };
  }
}

// Recover entries on a fresh device after a password reset, using the
// previous password / passphrase. Re-wraps with the current session secret.
export async function recoverWithPreviousPassword(uid, previousPassword) {
  const snap = await getDoc(cryptoDocRef(uid));
  if (!snap.exists()) return { ok: false };
  const { salt, wrapped } = snap.data();
  try {
    const kek = await deriveKek(previousPassword, salt);
    const key = await unwrapDek(wrapped, kek);
    storeLocalDek(uid, await exportDek(key));
    dek.value = key;
    locked.value = false;
    needsKeySetup.value = false;
    if (sessionPassword && sessionPassword !== previousPassword) {
      await writeWrappedKey(uid, key, sessionPassword);
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// After Google (or other OAuth) sign-in: restore the cached key if present,
// otherwise mark the journal locked and whether a passphrase still needs
// to be created.
export async function afterOAuthSignIn(uid) {
  if (dek.value) return { ok: true };

  const localB64 = loadLocalDekB64(uid);
  if (localB64) {
    dek.value = await importDek(localB64);
    locked.value = false;
    needsKeySetup.value = false;
    return { ok: true };
  }

  const snap = await getDoc(cryptoDocRef(uid));
  if (!snap.exists()) {
    dek.value = null;
    locked.value = true;
    needsKeySetup.value = true;
    return { ok: false, needsSetup: true };
  }

  dek.value = null;
  locked.value = true;
  needsKeySetup.value = false;
  return { ok: false, needsSetup: false };
}

// Called on app startup when Firebase restores a persisted session
// (no password available). Uses the key cached on this device.
export async function restoreFromDevice(uid) {
  if (dek.value) return;
  await afterOAuthSignIn(uid);
}

export function useKeys() {
  return { dek, locked, needsKeySetup };
}
