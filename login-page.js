import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  watchAuth
} from "./auth.js";

const googleButton = document.getElementById("google-login-button");
const emailForm = document.getElementById("email-login-form");
const registerButton = document.getElementById("email-register-button");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const statusEl = document.getElementById("login-status");

function setStatus(message) {
  statusEl.textContent = message;
}

function getFormValues() {
  return {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };
}

function validate(email, password) {
  if (!email) {
    throw new Error("Please enter your email.");
  }

  if (!password) {
    throw new Error("Please enter your password.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
}

watchAuth((user) => {
  if (user) {
    window.location.href = "lobby.html";
  }
});

googleButton?.addEventListener("click", async () => {
  setStatus("Signing in with Google...");

  try {
    await loginWithGoogle();
    setStatus("Signed in.");
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not sign in with Google.");
  }
});

emailForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const { email, password } = getFormValues();
    validate(email, password);

    setStatus("Signing in with email...");
    await loginWithEmail(email, password);

    setStatus("Signed in.");
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not sign in with email.");
  }
});

registerButton?.addEventListener("click", async () => {
  try {
    const { email, password } = getFormValues();
    validate(email, password);

    setStatus("Creating account...");
    await registerWithEmail(email, password);

    setStatus("Account created.");
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Could not create account.");
  }
});