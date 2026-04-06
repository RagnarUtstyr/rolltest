import {
  ref,
  update,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { EFFECTS } from "./effects.js";

await requireAuth();

let currentEffectEntryId = null;

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function sanitizeEffectKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function normalizeEffects(effects) {
  if (!effects) return [];
  if (Array.isArray(effects)) return effects.filter(Boolean);
  return Object.values(effects).filter(Boolean);
}

function normalizeEntry(id, entry) {
  return {
    id,
    name: entry.name ?? entry.playerName ?? "Unknown",
    number: entry.number ?? entry.initiative ?? 0,
    health: entry.health ?? null,
    ac: entry.ac ?? null,
    url: entry.url ?? null,
    effects: normalizeEffects(entry.effects)
  };
}

function closeEffectPickerModal() {
  document.getElementById("effect-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectsModal() {
  document.getElementById("effects-modal")?.setAttribute("aria-hidden", "true");
}

function openEffectsModal(entryId, effects, titleText = "Effects") {
  const modal = document.getElementById("effects-modal");
  const list = document.getElementById("effects-modal-list");
  const title = document.getElementById("effects-modal-title");

  if (!modal || !list) return;

  currentEffectEntryId = entryId;
  list.innerHTML = "";

  if (title) title.textContent = titleText;

  const safeEffects = normalizeEffects(effects);

  if (!safeEffects.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No effects added.";
    list.appendChild(empty);
  } else {
    safeEffects.forEach((effect) => {
      const row = document.createElement("div");
      row.className = "bane-picker-row";

      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "bane-picker-open";

      const left = document.createElement("div");
      left.className = "bane-picker-left";

      const icon = document.createElement("img");
      icon.className = "bane-icon";
      icon.src = effect.icon || "icons/effects/test.png";
      icon.alt = effect.name || "Effect";

      const name = document.createElement("span");
      name.textContent = effect.name || "Unknown";

      left.appendChild(icon);
      left.appendChild(name);
      leftButton.appendChild(left);

      leftButton.addEventListener("click", () => {
        if (effect.url) window.open(effect.url, "_blank", "noopener");
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "remove-button";
      removeBtn.style.marginTop = "0";

      removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = sanitizeEffectKey(effect.name);
        await remove(ref(db, `${getEntriesPath()}/${entryId}/effects/${key}`));
      });

      row.appendChild(leftButton);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  modal.setAttribute("aria-hidden", "false");
}

function openEffectPickerModal(entryId, existingEffects = []) {
  currentEffectEntryId = entryId;

  const modal = document.getElementById("effect-picker-modal");
  const list = document.getElementById("effect-picker-list");

  if (!modal || !list || !currentEffectEntryId) return;

  const selectedNames = new Set(
    normalizeEffects(existingEffects).map((effect) => effect.name)
  );

  list.innerHTML = "";

  EFFECTS.forEach((effect) => {
    const row = document.createElement("div");
    row.className = "bane-picker-row";

    const left = document.createElement("div");
    left.className = "bane-picker-left";

    const icon = document.createElement("img");
    icon.className = "bane-icon";
    icon.src = effect.icon || "icons/effects/test.png";
    icon.alt = effect.name || "Effect";

    const name = document.createElement("span");
    name.textContent = effect.name || "Unknown";

    left.appendChild(icon);
    left.appendChild(name);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = selectedNames.has(effect.name) ? "Added" : "Add";
    addBtn.className = "remove-button";
    addBtn.style.marginTop = "0";
    addBtn.disabled = selectedNames.has(effect.name);

    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const entryRef = ref(db, `${getEntriesPath()}/${currentEffectEntryId}/effects`);
      const key = sanitizeEffectKey(effect.name);

      await update(entryRef, {
        [key]: {
          name: effect.name,
          url: effect.url || "",
          icon: effect.icon || "icons/effects/test.png",
          type: effect.type || ""
        }
      });

      addBtn.textContent = "Added";
      addBtn.disabled = true;
    });

    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function fetchRankings() {
  const reference = ref(db, getEntriesPath());

  onValue(reference, (snapshot) => {
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

    rankings.forEach(({ id, name, ac, health, url, effects }) => {
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
          window.open(url, "_blank", "noopener");
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

      const effectArray = normalizeEffects(effects);

      if (effectArray.length > 0) {
        const effectWrap = document.createElement("div");
        effectWrap.className = "row-banes";

        effectArray.forEach((effect) => {
          const iconButton = document.createElement("button");
          iconButton.type = "button";
          iconButton.className = "bane-icon-button";
          iconButton.title = effect.name || "Effect";
          iconButton.setAttribute("aria-label", effect.name || "Effect");

          const icon = document.createElement("img");
          icon.className = "bane-row-icon";
          icon.src = effect.icon || "icons/effects/test.png";
          icon.alt = effect.name || "Effect";

          iconButton.appendChild(icon);
          iconButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (effect.url) window.open(effect.url, "_blank", "noopener");
          });

          effectWrap.appendChild(iconButton);
        });

        const effectsButton = document.createElement("button");
        effectsButton.type = "button";
        effectsButton.textContent = "Effects";
        effectsButton.className = "remove-button";
        effectsButton.style.marginTop = "0";
        effectsButton.addEventListener("click", (e) => {
          e.stopPropagation();
          openEffectsModal(id, effectArray, `${name} effects`);
        });

        effectWrap.appendChild(effectsButton);
        listItem.appendChild(effectWrap);
      }

      const addEffectButton = document.createElement("button");
      addEffectButton.type = "button";
      addEffectButton.textContent = "Effect";
      addEffectButton.className = "remove-button";
      addEffectButton.style.marginTop = "0";
      addEffectButton.addEventListener("click", (e) => {
        e.stopPropagation();
        openEffectPickerModal(id, effectArray);
      });

      listItem.appendChild(addEffectButton);

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
  });
}

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

        let removeButton = listItem.querySelector(".remove-button:last-of-type");
        if (!removeButton || removeButton.textContent !== "Remove") {
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
      }
    })
    .catch((error) => {
      console.error("Error updating health:", error);
    });
}

function removeEntry(id, listItem) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);

  remove(reference)
    .then(() => {
      listItem.remove();
    })
    .catch((error) => {
      console.error("Error removing entry:", error);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    getEntriesPath();
  } catch (error) {
    console.error(error);
    return;
  }

  if (document.getElementById("rankingList")) {
    fetchRankings();
  }

  const applyDamageButton = document.getElementById("apply-damage-button");
  if (applyDamageButton) {
    applyDamageButton.addEventListener("click", applyDamageToAll);
  }

  document
    .getElementById("effect-picker-close")
    ?.addEventListener("click", closeEffectPickerModal);

  document
    .getElementById("effects-modal-close")
    ?.addEventListener("click", closeEffectsModal);

  document.getElementById("effect-picker-modal")?.addEventListener("click", (e) => {
    if (e.target?.id === "effect-picker-modal") closeEffectPickerModal();
  });

  document.getElementById("effects-modal")?.addEventListener("click", (e) => {
    if (e.target?.id === "effects-modal") closeEffectsModal();
  });
});