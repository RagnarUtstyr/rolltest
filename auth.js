import { auth, googleProvider, db } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import { ref, update, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  await update(ref(db, `users/${user.uid}`), {
    uid: user.uid,
    name: user.displayName || "Unknown",
    email: user.email || "",
    photoURL: user.photoURL || "",
    lastLoginAt: Date.now()
  });

  return user;
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