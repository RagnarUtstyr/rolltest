import { db } from "./firebase-config.js";
import { ref, push, onValue, remove, set, update } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function normalizeEntry(id, entry) {
  return {
    id,
    name: entry.name ?? entry.playerName ?? "Unknown",
    number: entry.number ?? entry.initiative ?? 0,
    health: entry.health ?? null,
    ac: entry.ac ?? null,
    url: entry.url ?? null
  };
}

// Function to submit data to Firebase
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
      health,
      ac,
      createdByAdmin: true,
      updatedAt: Date.now()
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

// Function to fetch and display rankings with health update functionality
function fetchRankings() {
  const reference = ref(db, getEntriesPath());

  onValue(
    reference,
    (snapshot) => {
      const data = snapshot.val();
      const rankingList = document.getElementById("rankingList");
      rankingList.innerHTML = "";

      if (!data) {
        console.log("No data available");
        return;
      }

      const rankings = Object.entries(data)
        .map(([id, entry]) => normalizeEntry(id, entry))
        .sort((a, b) => (b.number || 0) - (a.number || 0));

      rankings.forEach(({ id, name, ac, health, url }) => {
        const listItem = document.createElement("li");
        listItem.className = "list-item";

        const nameAcContainer = document.createElement("div");
        nameAcContainer.className = "name-ac-container";

        const nameDiv = document.createElement("div");
        nameDiv.className = "name";
        nameDiv.textContent = name;

        if (url) {
          nameDiv.style.cursor = "pointer";
          nameDiv.addEventListener("click", () => {
            window.open(url, "_blank");
          });
        }

        nameAcContainer.appendChild(nameDiv);

        const acDiv = document.createElement("div");
        acDiv.className = "ac";
        acDiv.textContent = `AC: ${ac !== null && ac !== undefined ? ac : "N/A"}`;
        nameAcContainer.appendChild(acDiv);

        listItem.appendChild(nameAcContainer);

        const healthDiv = document.createElement("div");
        healthDiv.className = "health";
        healthDiv.textContent = `HP: ${health !== null && health !== undefined ? health : "N/A"}`;
        listItem.appendChild(healthDiv);

        const healthInput = document.createElement("input");
        healthInput.type = "number";
        healthInput.placeholder = "Damage";
        healthInput.className = "damage-input";
        healthInput.style.width = "50px";
        healthInput.dataset.entryId = id;
        healthInput.dataset.currentHealth = health ?? 0;
        listItem.appendChild(healthInput);

        if (health === 0) {
          const removeButton = document.createElement("button");
          removeButton.textContent = "Remove";
          removeButton.className = "remove-button";
          removeButton.addEventListener("click", () => {
            removeEntry(id, listItem);
          });
          listItem.appendChild(removeButton);
        }

        if (health === 0) {
          listItem.classList.add("defeated");
        }

        rankingList.appendChild(listItem);
      });
    },
    (error) => {
      console.error("Error fetching data:", error);
    }
  );
}

// Function to apply damage to all entries
function applyDamageToAll() {
  const damageInputs = document.querySelectorAll(".damage-input");

  damageInputs.forEach((input) => {
    const entryId = input.dataset.entryId;
    const currentHealth = parseInt(input.dataset.currentHealth, 10);
    const damage = parseInt(input.value, 10);

    if (!isNaN(damage) && !isNaN(currentHealth)) {
      const updatedHealth = currentHealth - damage;
      updateHealth(entryId, updatedHealth > 0 ? updatedHealth : 0, input);
    }

    input.value = "";
  });
}

// Function to update health in Firebase and UI
function updateHealth(id, newHealth, healthInput) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);

  update(reference, { health: newHealth })
    .then(() => {
      const healthDiv = healthInput.parentElement.querySelector(".health");
      healthDiv.textContent = `HP: ${newHealth}`;

      const listItem = healthInput.parentElement;

      if (newHealth <= 0) {
        listItem.classList.add("defeated");
        healthInput.disabled = false;
        healthInput.style.display = "inline-block";
        healthInput.dataset.currentHealth = newHealth;

        let removeButton = listItem.querySelector(".remove-button");
        if (!removeButton) {
          removeButton = document.createElement("button");
          removeButton.textContent = "Remove";
          removeButton.className = "remove-button";
          removeButton.addEventListener("click", () => {
            removeEntry(id, listItem);
          });
          listItem.appendChild(removeButton);
        }
      } else {
        healthInput.dataset.currentHealth = newHealth;
        listItem.classList.remove("defeated");

        const removeButton = listItem.querySelector(".remove-button");
        if (removeButton) {
          removeButton.remove();
        }
      }
    })
    .catch((error) => {
      console.error("Error updating health:", error);
    });
}

// Function to remove an entry
function removeEntry(id, listItem = null) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);

  remove(reference)
    .then(() => {
      if (listItem) listItem.remove();
      console.log(`Entry with id ${id} removed successfully`);
    })
    .catch((error) => {
      console.error("Error removing entry:", error);
    });
}

// Function to clear all entries from this room only
function clearAllEntries() {
  const reference = ref(db, getEntriesPath());

  set(reference, null)
    .then(() => {
      console.log("All room entries removed successfully");
      const rankingList = document.getElementById("rankingList");
      if (rankingList) rankingList.innerHTML = "";
    })
    .catch((error) => {
      console.error("Error clearing all room entries:", error);
    });
}

// Event listeners for page-specific actions
document.addEventListener("DOMContentLoaded", () => {
  try {
    getEntriesPath();
  } catch (error) {
    console.error(error);
    return;
  }

  if (document.getElementById("submit-button")) {
    document.getElementById("submit-button").addEventListener("click", submitData);
  }

  if (document.getElementById("rankingList")) {
    fetchRankings();
  }

  const applyDamageButton = document.getElementById("apply-damage-button");
  if (applyDamageButton) {
    applyDamageButton.addEventListener("click", applyDamageToAll);
  }

  if (document.getElementById("clear-list-button")) {
    document.getElementById("clear-list-button").addEventListener("click", clearAllEntries);
  }
});