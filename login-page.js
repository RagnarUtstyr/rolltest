import { loginWithGoogle, watchAuth } from "./auth.js";

const button = document.getElementById("google-login-button");
const statusEl = document.getElementById("login-status");

watchAuth((user) => {
  if (user) {
    window.location.href = "lobby.html";
  }
});

button?.addEventListener("click", async () => {
  statusEl.textContent = "Signing in...";
  try {
    await loginWithGoogle();
    statusEl.textContent = "Signed in.";
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Could not sign in.";
  }
});
