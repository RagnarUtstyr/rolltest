import { auth, googleProvider, db } from "./firebase-config.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";

import {
  ref,
  update,
  get
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

async function upsertUserProfile(user, extra = {}) {
  await update(ref(db, `users/${user.uid}`), {
    uid: user.uid,
    name: extra.name ?? user.displayName ?? "",
    email: user.email ?? "",
    photoURL: extra.photoURL ?? user.photoURL ?? "",
    provider: extra.provider ?? "unknown",
    lastLoginAt: Date.now(),
    ...extra
  });
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  await upsertUserProfile(user, {
    provider: "google"
  });

  return user;
}

export async function registerWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  const user = result.user;

  await upsertUserProfile(user, {
    provider: "password",
    name: email.split("@")[0],
    photoURL: ""
  });

  return user;
}

export async function loginWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const user = result.user;

  await upsertUserProfile(user, {
    provider: "password"
  });

  return user;
}

export async function sendResetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function logout() {
  await signOut(auth);
}

export async function requireAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();

      if (!user) {
        window.location.href = "login.html";
        return;
      }

      resolve(user);
    });
  });
}

export async function getUserMembership(uid) {
  const snapshot = await get(ref(db, `memberships/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
}