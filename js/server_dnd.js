// server_dnd.js
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { ref, push } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

async function submitData(event) {
  event?.preventDefault();

  await requireAuth();

  const name = document.getElementById("name")?.value?.trim();
  const initiativeInput = document.getElementById("initiative");
  const initiative = initiativeInput ? parseInt(initiativeInput.value, 10) : null;

  const healthInput = document.getElementById("health");
  const health =
    healthInput && healthInput.value !== "" ? parseInt(healthInput.value, 10) : null;

  const acInput = document.getElementById("ac");
  const ac = acInput && acInput.value !== "" ? parseInt(acInput.value, 10) : null;

  if (!name || isNaN(initiative)) {
    console.log("Please enter a valid name and initiative number.");
    return;
  }

  try {
    const entry = {
      name,
      number: initiative,
      initiative,
      updatedAt: Date.now(),
      effects: {}
    };

    if (health !== null) entry.health = health;
    if (ac !== null) entry.ac = ac;

    const entriesRef = ref(db, getEntriesPath());
    await push(entriesRef, entry);

    document.getElementById("name").value = "";
    if (initiativeInput) initiativeInput.value = "";
    if (healthInput) healthInput.value = "";
    if (acInput) acInput.value = "";

    const swordSound = document.getElementById("sword-sound");
    if (swordSound) swordSound.play();
  } catch (error) {
    console.error("Error submitting data:", error);
    alert("Could not add entry to this game.");
  }
}

function init() {
  const submitButton = document.getElementById("submit-button");
  if (submitButton) {
    submitButton.addEventListener("click", submitData);
  }

  const initiativeInput = document.getElementById("initiative");
  if (initiativeInput) {
    initiativeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitData(event);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}