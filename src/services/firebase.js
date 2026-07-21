import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config.js';

// Treat the placeholder config as "not configured" so the app can run
// in device-only mode before Firebase is set up.
export const firebaseEnabled =
  !!firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');

let auth = null;
let db = null;

if (firebaseEnabled) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
}

export { auth, db };
