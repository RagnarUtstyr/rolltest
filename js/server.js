import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { ref, push, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

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
  const numberInput = document.getElementById("initiative") || document.getElementById("number");
  const number = numberInput ? parseInt(numberInput.value, 10) : null;

  const healthInput = document.getElementById("health");
  const health = healthInput && healthInput.value !== "" ? parseInt(healthInput.value, 10) : null;

  const grdInput = document.getElementById("grd");
  const resInput = document.getElementById("res");
  const tghInput = document.getElementById("tgh");

  const grd = grdInput ? (grdInput.value !== "" ? parseInt(grdInput.value, 10) : null) : undefined;
  const res = resInput ? (resInput.value !== "" ? parseInt(resInput.value, 10) : null) : undefined;
  const tgh = tghInput ? (tghInput.value !== "" ? parseInt(tghInput.value, 10) : null) : undefined;

  if (!name || isNaN(number)) {
    console.log("Please enter a valid name and initiative number.");
    return;
  }

  try {
    const entry = {
      name,
      number,
      initiative: number,
      updatedAt: Date.now()
    };

    if (health !== null) entry.health = health;
    if (grd !== undefined) entry.grd = grd;
    if (res !== undefined) entry.res = res;
    if (tgh !== undefined) entry.tgh = tgh;

    const entriesRef = ref(db, getEntriesPath());
    await push(entriesRef, entry);

    console.log("Data submitted to room entries:", entry);

    document.getElementById("name").value = "";
    if (numberInput) numberInput.value = "";
    if (healthInput) healthInput.value = "";
    if (grdInput) grdInput.value = "";
    if (resInput) resInput.value = "";
    if (tghInput) tghInput.value = "";

    const swordSound = document.getElementById("sword-sound");
    if (swordSound) swordSound.play();
  } catch (error) {
    console.error("Error submitting data:", error);
    alert("Could not add entry to this game.");
  }
}

function removeEntry(id) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);
  remove(reference)
    .then(() => {
      console.log(`Entry with id ${id} removed successfully`);
    })
    .catch((error) => {
      console.error("Error removing entry:", error);
    });
}

function init() {
  const submitButton = document.getElementById("submit-button");
  if (submitButton) {
    submitButton.addEventListener("click", submitData);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}