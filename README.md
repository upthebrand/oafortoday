# OA For Today

A private daily companion for the Overeaters Anonymous *For Today Workbook*.
Each day the app shows that day's reflection question, gives you a place to
write your answer, and saves it. Built with Vue 3 + Vite, packaged for iPhone
and Android with Capacitor, with optional account sync via Firebase.

Anonymity is a design requirement, not an afterthought — see
[Privacy and anonymity](#privacy-and-anonymity) below.

## Branding and the OA logo

The app carries OA branding pending permission from the OA World Service
Office. The header and print logo live at `src/assets/oa-logo.svg` (imported
so the browser gets a fresh URL when the file changes). The tab icon is
`public/favicon.svg`. To update the brand mark, replace `src/assets/oa-logo.svg`
(and keep a copy in `public/oa-logo.svg` if you want the same file available
at `/oa-logo.svg`). App-store icons are generated from the native projects
when you package with Capacitor (see below).

## Features

- **Today** — automatically shows the question for today's date, with a large,
  readable journal box that autosaves as you type. Browse to any other day with
  the arrows.
- **Month** — every question for the month at a glance, with checkmarks for the
  days you've answered and a progress count.
- **Printable version** — one tap from the Month view produces a clean,
  print-friendly page of the whole month (your answers included, or ruled lines
  for blank days) and opens the print dialog.
- **Accounts** — simple email/password sign-in via Firebase. Answers sync across
  devices and are also cached on the device so the app works offline. Without
  Firebase configured, the app runs in device-only mode.
- **End-to-end encryption** — journal entries are encrypted on your device
  before they sync. The server (and anyone with access to it) only ever sees
  ciphertext.
- **Daily reminder** — opt-in notification at a time you choose. On iPhone and
  Android this uses real local notifications (works with the app closed). By
  default reminders are *discreet*: they never show the question or mention OA
  on the lock screen.
- Accessible by design: large touch targets, strong contrast, visible focus
  outlines, screen-reader labels, reduced-motion support, and automatic
  light/dark mode.

## Running locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Deploying to Netlify

This repo includes a [`netlify.toml`](netlify.toml) with the build command,
publish folder (`dist`), and SPA redirects for Vue Router.

1. Push the project to GitHub (or GitLab / Bitbucket).
2. In [Netlify](https://app.netlify.com): **Add new site → Import an existing
   project** and connect that repo.
3. Netlify should pick up settings from `netlify.toml` automatically:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Before (or right after) the first successful deploy**, add Firebase
   environment variables under
   **Site configuration → Environment variables** (same names as `.env.example`):

   | Variable | Example |
   |----------|---------|
   | `VITE_FIREBASE_API_KEY` | from Firebase web config |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `your-project` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | numeric sender id |
   | `VITE_FIREBASE_APP_ID` | `1:…:web:…` |

   Scope them to all deploy contexts (or at least Production). Then trigger a
   new deploy — Netlify embeds these at build time. Do **not** put them in
   `firebase-config.js` in the repo; Netlify’s secret scanner will fail the
   build if API keys are committed.
5. In **Firebase Console → Authentication → Settings → Authorized domains**,
   add that Netlify domain (and any custom domain you attach later). Without
   this, sign-in and Google auth will fail in production.
6. Optional: **Domain management** in Netlify to use your own domain.

Redeploys happen automatically on every push to the connected branch.

**Local Firebase:** copy `.env.example` to `.env`, paste your Firebase values,
and restart `npm run dev`. `.env` is gitignored.

## Setting up Firebase (accounts + sync)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and
   create a project (the free "Spark" plan is plenty).
2. **Build → Authentication → Get started**
   - Enable **Email/Password**.
   - Enable **Google** (set a project support email when prompted).
3. Under **Authentication → Settings → Authorized domains**, keep `localhost`
   for development and add your production domain when you deploy.
4. **Build → Firestore Database → Create database** (production mode).
5. Under **Rules**, paste the contents of [`firestore.rules`](firestore.rules)
   from this repository and publish. These rules do two things: each user can
   only reach their own documents, and the server *rejects any journal entry
   that is not ciphertext*, so plaintext can never be stored even by a buggy
   or malicious client.
6. **Project settings → General → Your apps → Web app (</>)** — register an app
   and copy the `firebaseConfig` values it shows you.
7. Locally: copy `.env.example` to `.env` and paste those values into the
   `VITE_FIREBASE_*` variables. On Netlify: add the same variables under
   **Site configuration → Environment variables** (see
   [Deploying to Netlify](#deploying-to-netlify)).

That's it — the Account tab will offer email sign-in/sign-up and
**Continue with Google**.

**Google + encryption:** Google has no password to wrap the journal key with.
The first time someone signs in with Google, the app asks them to create a
**journal passphrase**. That passphrase wraps the encryption key the same way
an email-account password does. On later devices they enter that passphrase
once; on a device that already has the key cached, they only need Google.

## Privacy and anonymity

**What the server stores.** Three things per user: the account email, a set of
documents named by date (`2026-07-19`) whose contents are AES-256-GCM
ciphertext, and one small "wrapped key" document. That's all. No analytics
are included. Fonts are system fonts (no Google Fonts IP leak). Choosing
**Continue with Google** does contact Google for sign-in; email/password does
not.

**How the encryption works.** When an account is created, the app generates a
random 256-bit data key on the device. Every journal entry is encrypted with
it before being written anywhere. The data key itself is encrypted ("wrapped")
with a key derived from your email-account password **or** (for Google sign-in)
your journal passphrase, via PBKDF2 (310,000 iterations). Only that wrapped
version is stored on the server. The secret, the derived key, and the raw data
key never leave the device. Consequences:

- Nobody with access to the Firebase project — including Google, a subpoena,
  or a stolen admin account — can read the entries. They can see *that* you
  wrote on a given date, but not what.
- Signing in on a new device decrypts everything with your password or journal
  passphrase.
- If you **reset your email password**, the server's wrapped key can no longer
  be opened with the new password. Any device that is still signed in keeps
  working and silently re-wraps the key for you. On a fresh device the app
  will ask once for your *previous* password to unlock, then re-wrap.
  If you lose the password/passphrase **and** have no signed-in device, the
  entries are unrecoverable — that is the honest price of real end-to-end
  encryption.
- **Google Sign-In convenience trade-off:** entries stay encrypted, but Google
  knows this Google account signed into the app. Prefer email/password (any
  address) if you want the account itself less tied to your primary identity.

**What appears on your phone.** The app carries OA branding on the home
screen, but reminders are discreet by default ("Your daily reflection is
ready.") so nothing sensitive shows on a lock screen. Users who prefer a
discreet home screen too can rename `appName` in `capacitor.config.json`
before packaging.

**Deleting everything.** Account → "Delete my account and all entries" erases
the auth account, every entry, and the key material from the server and the
device. There is no soft-delete or retention.

**What this can't protect against** (as you noted): a compromised or shared
device. The decryption key is cached on devices where you sign in so the app
works offline; anyone who can unlock your phone can open the app. Use a device
passcode, and sign out of shared devices — signing out removes the key.

## Packaging as a phone app (Capacitor)

One-time setup:

```bash
npm run build
npx cap add ios       # requires Xcode (Mac)
npx cap add android   # requires Android Studio
```

After any code change:

```bash
npm run sync          # builds the web app and copies it into the native projects
```

Then open and run on a device/simulator:

```bash
npx cap open ios
npx cap open android
```

From Xcode / Android Studio you can run on your own phone immediately, and
archive/build for the App Store and Play Store when you're ready to publish.

## Project layout

```
firestore.rules         Server-side security rules (per-user + ciphertext-only)
src/
  data/questions.js     All 366 daily questions extracted from the workbook PDF
  services/crypto.js    AES-GCM encryption + PBKDF2 key wrapping (Web Crypto)
  stores/keys.js        Encryption key lifecycle: unlock, recovery, re-wrap
  stores/auth.js        Firebase authentication state + account deletion
  stores/answers.js     Answer storage: encrypted Firestore sync + local cache
  stores/notifications.js  Daily reminder scheduling (native + web fallback)
  views/TodayView.vue   Daily question + journal
  views/MonthView.vue   Month list + print button
  views/PrintView.vue   Print-friendly month layout
  views/AccountView.vue Sign in / create account + reminder settings
```

## A note on the content

The questions are from the *For Today Workbook*, © Overeaters Anonymous, Inc.
This app is intended as a personal journal companion for your own copy of the
workbook, not for redistribution.
