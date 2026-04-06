import { db } from "./firebase-config.js";
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

async function submitData() {
  const name = document.getElementById("name")?.value?.trim();
  const initiativeEl = document.getElementById("initiative") || document.getElementById("number");
  const number = initiativeEl ? parseInt(initiativeEl.value, 10) : NaN;

  const healthRaw = document.getElementById("health")?.value ?? "";
  const acRaw = document.getElementById("ac")?.value ?? "";

  const health = healthRaw !== "" ? parseInt(healthRaw, 10) : null;
  const ac = acRaw !== "" ? parseInt(acRaw, 10) : null;

  if (!name || Number.isNaN(number)) {
    console.log("Please enter valid name and initiative values.");
    return;
  }

  try {
    const reference = ref(db, getEntriesPath());

    await push(reference, {
      name,
      number,
      initiative: number,
      health,
      ac,
      createdByAdmin: true,
      updatedAt: Date.now(),
    });

    document.getElementById("name").value = "";
    if (initiativeEl) initiativeEl.value = "";
    if (document.getElementById("health")) document.getElementById("health").value = "";
    if (document.getElementById("ac")) document.getElementById("ac").value = "";

    const swordSound = document.getElementById("sword-sound");
    if (swordSound) swordSound.play();
  } catch (error) {
    console.error("Error submitting data:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    getEntriesPath();
  } catch (error) {
    console.error(error);
    return;
  }

  document.getElementById("submit-button")?.addEventListener("click", submitData);
});