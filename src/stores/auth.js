import { ref, computed } from 'vue';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
} from 'firebase/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../services/firebase.js';
import {
  unlockWithPassword,
  restoreFromDevice,
  afterOAuthSignIn,
  clearKeys,
} from './keys.js';

const user = ref(null);
const authReady = ref(!firebaseEnabled);

// Prevents restoreFromDevice from racing the unlock that happens inside
// an in-progress signIn/signUp call.
let authFlowActive = false;

if (firebaseEnabled) {
  onAuthStateChanged(auth, async (u) => {
    user.value = u;
    if (u && !authFlowActive) {
      await restoreFromDevice(u.uid);
    }
    authReady.value = true;
  });
}

const FRIENDLY_ERRORS = {
  'auth/invalid-email': 'That email address doesn\u2019t look right.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect password. Try again or reset it below.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/email-already-in-use': 'An account with that email already exists. Try signing in.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Couldn\u2019t reach the server. Check your connection.',
  'auth/requires-recent-login': 'For safety, please sign out and sign back in, then try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow popups and try again.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with email and password instead.',
};

function friendly(err) {
  return FRIENDLY_ERRORS[err?.code] || 'Something went wrong. Please try again.';
}

function isGoogleUser(u) {
  return !!u?.providerData?.some((p) => p.providerId === 'google.com');
}

async function wipeUserData(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'answers'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'users', uid, 'meta', 'crypto'));
}

export function useAuth() {
  return {
    user,
    authReady,
    firebaseEnabled,
    isSignedIn: computed(() => !!user.value),
    isGoogleAccount: computed(() => isGoogleUser(user.value)),

    async signUp(name, email, password) {
      authFlowActive = true;
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
        await unlockWithPassword(cred.user.uid, password);
        user.value = auth.currentUser;
        return { ok: true };
      } catch (err) {
        return { ok: false, message: friendly(err) };
      } finally {
        authFlowActive = false;
      }
    },

    async signIn(email, password) {
      authFlowActive = true;
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await unlockWithPassword(cred.user.uid, password);
        return { ok: true };
      } catch (err) {
        return { ok: false, message: friendly(err) };
      } finally {
        authFlowActive = false;
      }
    },

    async signInWithGoogle() {
      authFlowActive = true;
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await signInWithPopup(auth, provider);
        await afterOAuthSignIn(cred.user.uid);
        user.value = auth.currentUser;
        return { ok: true };
      } catch (err) {
        return { ok: false, message: friendly(err) };
      } finally {
        authFlowActive = false;
      }
    },

    async resetPassword(email) {
      try {
        await sendPasswordResetEmail(auth, email);
        return { ok: true };
      } catch (err) {
        return { ok: false, message: friendly(err) };
      }
    },

    async logOut() {
      clearKeys();
      await signOut(auth);
    },

    // Permanently removes the auth account, every journal entry, and the
    // encryption key material, both on the server and on this device.
    // Email accounts confirm with password; Google accounts re-auth with Google.
    async deleteAccount(password) {
      const current = auth.currentUser;
      if (!current) return { ok: false, message: 'Not signed in.' };
      try {
        if (isGoogleUser(current)) {
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(current, provider);
        } else {
          if (!password) {
            return { ok: false, message: 'Enter your password to confirm.' };
          }
          const credential = EmailAuthProvider.credential(current.email, password);
          await reauthenticateWithCredential(current, credential);
        }

        await wipeUserData(current.uid);
        await deleteUser(current);

        clearKeys();
        localStorage.removeItem('oa-answers-v1');
        return { ok: true };
      } catch (err) {
        return { ok: false, message: friendly(err) };
      }
    },
  };
}
