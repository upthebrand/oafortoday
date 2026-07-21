<script setup>
import { ref } from 'vue';
import { useAuth } from '../stores/auth.js';
import {
  useKeys,
  unlockWithPassword,
  recoverWithPreviousPassword,
} from '../stores/keys.js';
import { useNotifications } from '../stores/notifications.js';

const {
  user,
  isSignedIn,
  isGoogleAccount,
  firebaseEnabled,
  signUp,
  signIn,
  signInWithGoogle,
  resetPassword,
  logOut,
  deleteAccount,
} = useAuth();
const { locked, needsKeySetup } = useKeys();
const notify = useNotifications();

const mode = ref('signin'); // signin | signup
const name = ref('');
const email = ref('');
const password = ref('');
const busy = ref(false);
const googleBusy = ref(false);
const error = ref('');
const info = ref('');

async function submit() {
  busy.value = true;
  error.value = '';
  info.value = '';
  const result =
    mode.value === 'signup'
      ? await signUp(name.value.trim(), email.value.trim(), password.value)
      : await signIn(email.value.trim(), password.value);
  busy.value = false;
  if (!result.ok) error.value = result.message;
  else password.value = '';
}

async function googleSignIn() {
  googleBusy.value = true;
  error.value = '';
  info.value = '';
  const result = await signInWithGoogle();
  googleBusy.value = false;
  if (!result.ok) error.value = result.message;
}

async function forgot() {
  if (!email.value.trim()) {
    error.value = 'Enter your email above first, then tap "Forgot password" again.';
    return;
  }
  error.value = '';
  const result = await resetPassword(email.value.trim());
  if (result.ok) info.value = 'Password reset email sent. Check your inbox.';
  else error.value = result.message;
}

// --- journal passphrase (Google) / unlock after password reset ---
const passphrase = ref('');
const passphraseConfirm = ref('');
const unlockBusy = ref(false);
const unlockError = ref('');

async function setupPassphrase() {
  unlockBusy.value = true;
  unlockError.value = '';
  if (passphrase.value.length < 6) {
    unlockError.value = 'Choose a passphrase with at least 6 characters.';
    unlockBusy.value = false;
    return;
  }
  if (passphrase.value !== passphraseConfirm.value) {
    unlockError.value = 'Those passphrases don\u2019t match.';
    unlockBusy.value = false;
    return;
  }
  const result = await unlockWithPassword(user.value.uid, passphrase.value);
  unlockBusy.value = false;
  if (!result.ok) {
    unlockError.value = 'Couldn\u2019t set up your journal passphrase. Please try again.';
  } else {
    passphrase.value = '';
    passphraseConfirm.value = '';
  }
}

async function unlockJournal() {
  unlockBusy.value = true;
  unlockError.value = '';
  let result = await unlockWithPassword(user.value.uid, passphrase.value);
  if (!result.ok) {
    // Email password-reset recovery path: try as previous secret.
    result = await recoverWithPreviousPassword(user.value.uid, passphrase.value);
  }
  unlockBusy.value = false;
  if (!result.ok) {
    unlockError.value = isGoogleAccount.value
      ? 'That passphrase couldn\u2019t unlock your journal. Try again.'
      : 'That password couldn\u2019t unlock your journal. If you reset your account password, enter the one you used before the reset.';
  } else {
    passphrase.value = '';
  }
}

// --- delete account ---
const showDelete = ref(false);
const deletePassword = ref('');
const deleteBusy = ref(false);
const deleteError = ref('');
const deleteDone = ref(false);

async function confirmDelete() {
  deleteBusy.value = true;
  deleteError.value = '';
  const result = await deleteAccount(deletePassword.value);
  deleteBusy.value = false;
  if (!result.ok) {
    deleteError.value = result.message;
  } else {
    deleteDone.value = true;
    showDelete.value = false;
    deletePassword.value = '';
  }
}

// --- notifications ---
const notifyError = ref('');
const notifyTime = ref(notify.settings.value.time);

async function toggleNotifications(event) {
  notifyError.value = '';
  if (event.target.checked) {
    const result = await notify.enable(notifyTime.value);
    if (!result.ok) {
      notifyError.value = result.message;
      event.target.checked = false;
    }
  } else {
    await notify.disable();
  }
}

async function changeTime() {
  await notify.setTime(notifyTime.value);
}

async function toggleDiscreet(event) {
  await notify.setDiscreet(event.target.checked);
}
</script>

<template>
  <article>
    <h1 class="page-title">Account</h1>

    <p v-if="deleteDone" class="card info-text" role="status">
      Your account and all of your entries have been permanently deleted.
    </p>

    <!-- First-time Google: create journal passphrase -->
    <section v-if="isSignedIn && needsKeySetup" class="card locked-card">
      <h2 class="card-title">Create a journal passphrase</h2>
      <p class="muted">
        Google signs you in, but your entries stay end-to-end encrypted with a
        separate passphrase that only you know. You&rsquo;ll need this on any
        new device. Keep it somewhere safe &mdash; if it&rsquo;s lost and you
        have no signed-in device, your entries can&rsquo;t be recovered.
      </p>
      <form @submit.prevent="setupPassphrase">
        <label class="field">
          <span class="field-label">Journal passphrase</span>
          <input
            v-model="passphrase"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </label>
        <label class="field">
          <span class="field-label">Confirm passphrase</span>
          <input
            v-model="passphraseConfirm"
            type="password"
            autocomplete="new-password"
            minlength="6"
            required
          />
        </label>
        <p v-if="unlockError" class="error-text" role="alert">{{ unlockError }}</p>
        <button class="btn btn-primary full" type="submit" :disabled="unlockBusy">
          {{ unlockBusy ? 'Setting up\u2026' : 'Protect my journal' }}
        </button>
      </form>
    </section>

    <!-- Journal locked: needs passphrase / previous password -->
    <section v-else-if="isSignedIn && locked" class="card locked-card">
      <h2 class="card-title">Unlock your journal</h2>
      <p v-if="isGoogleAccount" class="muted">
        Enter the journal passphrase you chose when you first signed in with
        Google on this account.
      </p>
      <p v-else class="muted">
        Your entries are encrypted and this device doesn&rsquo;t have the key
        yet &mdash; this happens after a password reset. Enter the password you
        used <strong>before</strong> the reset to unlock them. After that,
        your new password will work everywhere.
      </p>
      <form @submit.prevent="unlockJournal">
        <label class="field">
          <span class="field-label">{{ isGoogleAccount ? 'Journal passphrase' : 'Previous password' }}</span>
          <input
            v-model="passphrase"
            type="password"
            autocomplete="off"
            required
          />
        </label>
        <p v-if="unlockError" class="error-text" role="alert">{{ unlockError }}</p>
        <button class="btn btn-primary full" type="submit" :disabled="unlockBusy">
          {{ unlockBusy ? 'Unlocking\u2026' : 'Unlock' }}
        </button>
      </form>
    </section>

    <!-- Signed in -->
    <section v-if="isSignedIn" class="card">
      <h2 class="card-title">Welcome{{ user.displayName ? ', ' + user.displayName : '' }}</h2>
      <p class="muted">
        Signed in as {{ user.email }}
        <span v-if="isGoogleAccount"> with Google</span>.
        Your entries are encrypted on your device before they sync &mdash; no
        one else can read them, not even the server they&rsquo;re stored on.
      </p>
      <button class="btn btn-ghost" @click="logOut">Sign out</button>

      <div class="danger-zone">
        <button v-if="!showDelete" class="link-btn danger" @click="showDelete = true">
          Delete my account and all entries&hellip;
        </button>
        <form v-else @submit.prevent="confirmDelete">
          <p class="muted">
            This permanently erases your account, every journal entry, and your
            encryption key. It cannot be undone.
            <template v-if="isGoogleAccount">
              You&rsquo;ll confirm with Google next.
            </template>
            <template v-else>
              Enter your password to confirm.
            </template>
          </p>
          <label v-if="!isGoogleAccount" class="field">
            <span class="field-label">Password</span>
            <input v-model="deletePassword" type="password" autocomplete="current-password" required />
          </label>
          <p v-if="deleteError" class="error-text" role="alert">{{ deleteError }}</p>
          <div class="delete-actions">
            <button class="btn btn-ghost" type="button" @click="showDelete = false; deleteError = ''">
              Cancel
            </button>
            <button class="btn btn-danger" type="submit" :disabled="deleteBusy">
              {{ deleteBusy ? 'Deleting\u2026' : 'Delete everything' }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- Firebase not configured -->
    <section v-else-if="!firebaseEnabled" class="card">
      <h2 class="card-title">Device-only mode</h2>
      <p class="muted">
        Your answers are saved on this device. To enable accounts and syncing,
        add your Firebase values to a local <code>.env</code> file
        (see <code>.env.example</code> and the README).
      </p>
    </section>

    <!-- Sign in / sign up -->
    <section v-else class="card">
      <div class="mode-switch" role="tablist" aria-label="Sign in or create account">
        <button
          role="tab"
          :aria-selected="mode === 'signin'"
          :class="{ active: mode === 'signin' }"
          @click="mode = 'signin'; error = ''"
        >
          Sign in
        </button>
        <button
          role="tab"
          :aria-selected="mode === 'signup'"
          :class="{ active: mode === 'signup' }"
          @click="mode = 'signup'; error = ''"
        >
          Create account
        </button>
      </div>

      <button
        class="btn btn-google full"
        type="button"
        :disabled="googleBusy"
        @click="googleSignIn"
      >
        <span class="google-g" aria-hidden="true">G</span>
        {{ googleBusy ? 'Opening Google\u2026' : 'Continue with Google' }}
      </button>

      <div class="or-line" aria-hidden="true"><span>or</span></div>

      <form @submit.prevent="submit">
        <label v-if="mode === 'signup'" class="field">
          <span class="field-label">Name (optional &mdash; any name is fine)</span>
          <input v-model="name" type="text" autocomplete="off" />
        </label>
        <label class="field">
          <span class="field-label">Email</span>
          <input v-model="email" type="email" autocomplete="email" required />
        </label>
        <label class="field">
          <span class="field-label">Password</span>
          <input
            v-model="password"
            type="password"
            :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
            minlength="6"
            required
          />
        </label>

        <p v-if="error" class="error-text" role="alert">{{ error }}</p>
        <p v-if="info" class="info-text" role="status">{{ info }}</p>

        <button class="btn btn-primary full" type="submit" :disabled="busy">
          {{ busy ? 'One moment\u2026' : mode === 'signup' ? 'Create account' : 'Sign in' }}
        </button>
      </form>

      <button v-if="mode === 'signin'" class="link-btn" @click="forgot">
        Forgot password?
      </button>

      <p class="muted small anon-note">
        Prefer more privacy? Email and password lets you use any address,
        including one that isn&rsquo;t tied to your name. Google is faster, but
        links this app to your Google account. Either way, journal entries are
        encrypted on your device before they sync.
      </p>
    </section>

    <!-- Notifications -->
    <section class="card notify-card">
      <h2 class="card-title">Daily reminder</h2>
      <p v-if="!notify.supported" class="muted">
        Notifications aren&rsquo;t supported in this browser.
      </p>
      <template v-else>
        <label class="toggle-row">
          <span>Remind me each day</span>
          <input
            type="checkbox"
            class="switch"
            :checked="notify.settings.value.enabled"
            @change="toggleNotifications"
          />
        </label>
        <label class="toggle-row">
          <span>
            Discreet reminders
            <span class="muted small block">Never show the question or mention OA on your lock screen</span>
          </span>
          <input
            type="checkbox"
            class="switch"
            :checked="notify.settings.value.discreet"
            @change="toggleDiscreet"
          />
        </label>
        <label class="field time-field">
          <span class="field-label">Reminder time</span>
          <input v-model="notifyTime" type="time" @change="changeTime" />
        </label>
        <p v-if="!notify.isNative" class="muted small">
          On the web, reminders appear while the app is open. Install the phone
          app for reminders that work even when the app is closed.
        </p>
        <p v-if="notifyError" class="error-text" role="alert">{{ notifyError }}</p>
      </template>
    </section>

    <p class="credit">
      Questions from the <em>For Today Workbook</em>, &copy; Overeaters Anonymous, Inc.
      This app is an unofficial personal journal companion.
    </p>
  </article>
</template>

<style scoped>
.page-title {
  font-size: 26px;
}

.card {
  margin-bottom: 18px;
}

.card-title {
  font-size: 20px;
}

.muted {
  color: var(--ink-soft);
}

.small {
  font-size: 14px;
}

.block {
  display: block;
  font-weight: 400;
}

.locked-card {
  border: 1.5px solid var(--accent);
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  background: var(--bg);
  border-radius: 999px;
  padding: 4px;
  margin-bottom: 20px;
}

.mode-switch button {
  border: none;
  background: transparent;
  border-radius: 999px;
  min-height: 44px;
  font-weight: 600;
  color: var(--ink-soft);
}

.mode-switch button.active {
  background: var(--brand);
  color: #fff;
}

@media (prefers-color-scheme: dark) {
  .mode-switch button.active {
    color: #10201c;
  }
}

.btn-google {
  background: var(--surface);
  color: var(--ink);
  border: 1.5px solid color-mix(in srgb, var(--ink) 20%, transparent);
  margin-bottom: 4px;
}

.btn-google:hover {
  background: var(--bg);
}

.google-g {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  color: #4285f4;
  font-weight: 700;
  font-size: 14px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 15%, transparent);
}

.or-line {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  color: var(--ink-soft);
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.or-line::before,
.or-line::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--ink) 15%, transparent);
}

.full {
  width: 100%;
}

.link-btn {
  display: block;
  margin: 14px auto 0;
  background: none;
  border: none;
  color: var(--brand);
  font-weight: 600;
  text-decoration: underline;
}

.link-btn.danger {
  color: var(--danger);
}

.btn-danger {
  background: var(--danger);
  color: #fff;
  border: none;
}

.danger-zone {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
}

.delete-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.info-text {
  color: var(--brand);
  font-weight: 500;
}

.anon-note {
  margin-top: 16px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
  min-height: 48px;
  margin-bottom: 6px;
}

.switch {
  appearance: none;
  width: 52px;
  height: 32px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 25%, transparent);
  position: relative;
  cursor: pointer;
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}

.switch:checked {
  background: var(--brand);
}

.switch:checked::after {
  transform: translateX(20px);
}

.time-field {
  margin-top: 10px;
  max-width: 200px;
}

.credit {
  text-align: center;
  font-size: 13px;
  color: var(--ink-soft);
  margin-top: 26px;
}
</style>
