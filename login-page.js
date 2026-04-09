import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  sendResetPassword,
  watchAuth
} from "./auth.js";

const googleButton = document.getElementById("google-login-button");
const emailLoginForm = document.getElementById("email-login-form");
const loginStatusEl = document.getElementById("login-status");

const openRegisterButton = document.getElementById("open-register-modal");
const openResetButton = document.getElementById("open-reset-modal");

const registerModal = document.getElementById("register-modal");
const resetModal = document.getElementById("reset-modal");

const closeButtons = document.querySelectorAll("[data-close-modal]");

const registerForm = document.getElementById("register-form");
const resetForm = document.getElementById("reset-form");

const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");

const registerEmailInput = document.getElementById("register-email");
const registerPasswordInput = document.getElementById("register-password");
const registerConfirmPasswordInput = document.getElementById("register-confirm-password");

const resetEmailInput = document.getElementById("reset-email");

const registerStatusEl = document.getElementById("register-status");
const resetStatusEl = document.getElementById("reset-status");

function setText(element, message) {
  if (element) {
    element.textContent = message;
  }
}

function openModal(modal) {
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function friendlyAuthMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "That email is already registered.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again a little later.";
    default:
      return error?.message || "Something went wrong.";
  }
}

function validateEmailPassword(email, password) {
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
  setText(loginStatusEl, "Signing in with Google...");

  try {
    await loginWithGoogle();
    setText(loginStatusEl, "Signed in.");
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    setText(loginStatusEl, friendlyAuthMessage(error));
  }
});

emailLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setText(loginStatusEl, "");

  try {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    validateEmailPassword(email, password);

    setText(loginStatusEl, "Signing in...");
    await loginWithEmail(email, password);

    setText(loginStatusEl, "Signed in.");
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    setText(loginStatusEl, friendlyAuthMessage(error));
  }
});

openRegisterButton?.addEventListener("click", () => {
  setText(registerStatusEl, "");
  registerForm?.reset();
  openModal(registerModal);
});

openResetButton?.addEventListener("click", () => {
  setText(resetStatusEl, "");
  resetEmailInput.value = loginEmailInput.value.trim();
  openModal(resetModal);
});

closeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-close-modal");
    const modal = document.getElementById(targetId);
    closeModal(modal);
  });
});

[registerModal, resetModal].forEach((modal) => {
  modal?.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal(registerModal);
    closeModal(resetModal);
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setText(registerStatusEl, "");

  try {
    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value;
    const confirmPassword = registerConfirmPasswordInput.value;

    validateEmailPassword(email, password);

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    setText(registerStatusEl, "Creating account...");
    await registerWithEmail(email, password);

    setText(registerStatusEl, "Account created.");
    closeModal(registerModal);
    window.location.href = "lobby.html";
  } catch (error) {
    console.error(error);
    setText(registerStatusEl, friendlyAuthMessage(error));
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setText(resetStatusEl, "");

  try {
    const email = resetEmailInput.value.trim();

    if (!email) {
      throw new Error("Please enter your email.");
    }

    setText(resetStatusEl, "Sending reset email...");
    await sendResetPassword(email);
    setText(resetStatusEl, "Password reset email sent. Check your inbox.");
  } catch (error) {
    console.error(error);
    setText(resetStatusEl, friendlyAuthMessage(error));
  }
});