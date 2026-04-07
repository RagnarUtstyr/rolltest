import { ref, update, onValue, remove, set } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { EFFECTS } from "./effects.js";

await requireAuth();

let currentStatEntryId = null;
let currentEffectEntryId = null;

const countdownById = new Map();
const dataCache = {};

function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function normalizeEffects(effects) {
  if (!effects) return [];
  if (Array.isArray(effects)) return effects.filter(Boolean);
  return Object.values(effects).filter(Boolean);
}

function sanitizeEffectKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function normalizeEntry(id, entry) {
  return {
    id,
    name: entry.name ?? entry.playerName ?? "Unknown",
    number: entry.number ?? entry.initiative ?? 0,
    initiative: entry.initiative ?? entry.number ?? 0,
    health: entry.health ?? null,
    ac: entry.ac ?? null,
    url: entry.url ?? null,
    effects: normalizeEffects(entry.effects),
    countdownActive: !!entry.countdownActive,
    countdownRemaining:
      typeof entry.countdownRemaining === "number"
        ? entry.countdownRemaining
        : entry.countdownRemaining === null
          ? null
          : entry.countdownRemaining !== undefined && entry.countdownRemaining !== ""
            ? Number(entry.countdownRemaining)
            : null,
    countdownEnded: !!entry.countdownEnded,
  };
}

function rowFor(entryId) {
  return document.querySelector(`#rankingList li[data-entry-id="${entryId}"]`);
}

function getHealthInput(entryId) {
  return document.querySelector(`.damage-input[data-entry-id="${entryId}"]`);
}

function getCountdownState(entryId) {
  return countdownById.get(entryId) || {
    active: false,
    remaining: null,
    ended: false,
  };
}

function setCountdownState(entryId, state) {
  countdownById.set(entryId, {
    active: !!state.active,
    remaining:
      typeof state.remaining === "number" && !Number.isNaN(state.remaining)
        ? state.remaining
        : null,
    ended: !!state.ended,
  });
}

function setCountdownDisplay({ remaining, active, ended }) {
  const el = document.getElementById("stat-countdown-remaining");
  if (!el) return;

  if (ended) {
    el.textContent = "ENDED (0)";
  } else if (active) {
    el.textContent = `${remaining ?? "—"}`;
  } else if (remaining === 0) {
    el.textContent = "0";
  } else {
    el.textContent = "—";
  }
}

function openStatModal(entry) {
  const modal = document.getElementById("stat-modal");
  if (!modal) return;

  currentStatEntryId = entry.id;

  document.getElementById("stat-modal-title").textContent = entry.name ?? "";
  document.getElementById("stat-init").textContent = entry.initiative ?? "N/A";
  document.getElementById("stat-ac").textContent = entry.ac ?? "N/A";
  document.getElementById("stat-hp").textContent = entry.health ?? "N/A";

  const linkEl = document.getElementById("stat-url");
  if (linkEl) {
    if (entry.url) {
      linkEl.style.display = "";
      linkEl.href = entry.url;
    } else {
      linkEl.style.display = "none";
      linkEl.removeAttribute("href");
    }
  }

  setCountdownDisplay({
    remaining: entry.countdownRemaining,
    active: entry.countdownActive,
    ended: entry.countdownEnded,
  });

  const countdownInput = document.getElementById("stat-countdown-amount");
  const healInput = document.getElementById("stat-heal-amount");
  if (countdownInput) countdownInput.value = "";
  if (healInput) healInput.value = "";

  modal.setAttribute("aria-hidden", "false");
}

function closeStatModal() {
  document.getElementById("stat-modal")?.setAttribute("aria-hidden", "true");
}

function openHpModal(entry) {
  const modal = document.getElementById("hp-modal");
  if (!modal) return;

  currentStatEntryId = entry.id;
  document.getElementById("hp-modal-title").textContent = `${entry.name ?? "Entry"} HP`;

  const input = document.getElementById("hp-set-amount");
  if (input) {
    input.value = entry.health ?? entry.health === 0 ? entry.health : "";
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  modal.setAttribute("aria-hidden", "false");
}

function closeHpModal() {
  document.getElementById("hp-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectPickerModal() {
  document.getElementById("effect-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectsModal() {
  document.getElementById("effects-modal")?.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeStatModal();
  closeHpModal();
  closeEffectPickerModal();
  closeEffectsModal();
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
      row.className = "effect-picker-row";

      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "effect-picker-open";

      const left = document.createElement("div");
      left.className = "effect-picker-left";

      const icon = document.createElement("img");
      icon.className = "effect-icon";
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
        try {
          const key = sanitizeEffectKey(effect.name);
          await remove(ref(db, `${getEntriesPath()}/${entryId}/effects/${key}`));
        } catch (err) {
          console.error("Error removing effect:", err);
        }
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
    row.className = "effect-picker-row";

    const left = document.createElement("div");
    left.className = "effect-picker-left";

    const icon = document.createElement("img");
    icon.className = "effect-icon";
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

      try {
        const entryRef = ref(db, `${getEntriesPath()}/${currentEffectEntryId}/effects`);
        const key = sanitizeEffectKey(effect.name);

        await update(entryRef, {
          [key]: {
            name: effect.name,
            url: effect.url || "",
            icon: effect.icon || "icons/effects/test.png",
            type: effect.type || "",
          },
        });

        addBtn.textContent = "Added";
        addBtn.disabled = true;
      } catch (err) {
        console.error("Error adding effect:", err);
      }
    });

    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function clearList() {
  const reference = ref(db, getEntriesPath());

  set(reference, null)
    .then(() => {
      currentStatEntryId = null;
      currentEffectEntryId = null;
      countdownById.clear();
      closeAllModals();
    })
    .catch((error) => {
      console.error("Error clearing list:", error);
    });
}

function fetchRankings() {
  const reference = ref(db, getEntriesPath());

  onValue(reference, (snapshot) => {
    const data = snapshot.val();
    const rankingList = document.getElementById("rankingList");
    if (!rankingList) return;

    rankingList.innerHTML = "";
    countdownById.clear();

    Object.keys(dataCache).forEach((key) => delete dataCache[key]);

    if (!data) {
      console.log("No data available");
      return;
    }

    const rankings = Object.entries(data)
      .map(([id, entry]) => normalizeEntry(id, entry))
      .sort((a, b) => (b.number || 0) - (a.number || 0));

    rankings.forEach((entry) => {
      const {
        id,
        name,
        ac,
        health,
        initiative,
        effects,
      } = entry;

      dataCache[id] = entry;

      setCountdownState(id, {
        remaining: typeof entry.countdownRemaining === "number" ? entry.countdownRemaining : null,
        active: !!entry.countdownActive,
        ended: !!entry.countdownEnded,
      });

      const listItem = document.createElement("li");
      listItem.className = "list-item";
      listItem.dataset.entryId = id;

      const nameAcContainer = document.createElement("div");
      nameAcContainer.className = "name-ac-container";

      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "name-button";
      nameButton.textContent = name;
      nameButton.title = "Show details";
      nameButton.setAttribute("aria-label", `Open details for ${name}`);
      nameButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openStatModal(dataCache[id]);
      });

      nameAcContainer.appendChild(nameButton);

      const acDiv = document.createElement("div");
      acDiv.className = "ac";
      acDiv.textContent = `AC: ${ac !== null && ac !== undefined ? ac : "N/A"}`;
      nameAcContainer.appendChild(acDiv);

      listItem.appendChild(nameAcContainer);

      const healthButton = document.createElement("button");
      healthButton.type = "button";
      healthButton.className = "health-button";
      healthButton.title = "Set HP";
      healthButton.setAttribute("aria-label", `Set HP for ${name}`);

      const healthDiv = document.createElement("div");
      healthDiv.className = "health";
      healthDiv.textContent = `HP: ${health !== null && health !== undefined ? health : "N/A"}`;
      healthButton.appendChild(healthDiv);

      healthButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openHpModal(dataCache[id]);
      });

      listItem.appendChild(healthButton);

      const effectArray = normalizeEffects(effects);

      if (effectArray.length > 0) {
        const effectWrap = document.createElement("div");
        effectWrap.className = "row-effects";

        effectArray.forEach((effect) => {
          const iconButton = document.createElement("button");
          iconButton.type = "button";
          iconButton.className = "effect-icon-button";
          iconButton.title = effect.name || "Effect";
          iconButton.setAttribute("aria-label", effect.name || "Effect");

          const icon = document.createElement("img");
          icon.className = "effect-row-icon";
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
      healthInput.style.width = "64px";
      healthInput.dataset.entryId = id;
      healthInput.dataset.currentHealth = health ?? 0;
      healthInput.dataset.initiative = initiative ?? 0;
      listItem.appendChild(healthInput);

      if (health === 0) {
        listItem.classList.add("defeated");

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.className = "remove-button row-remove-button";
        removeButton.addEventListener("click", () => removeEntry(id, listItem));
        listItem.appendChild(removeButton);
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

    if (!Number.isNaN(damage) && !Number.isNaN(currentHealth)) {
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
      const listItem = healthInput.closest(".list-item");
      const healthDiv = listItem?.querySelector(".health");

      if (healthDiv) {
        healthDiv.textContent = `HP: ${newHealth}`;
      }

      healthInput.dataset.currentHealth = newHealth;

      if (dataCache[id]) {
        dataCache[id].health = newHealth;
      }

      if (currentStatEntryId === id) {
        const statHp = document.getElementById("stat-hp");
        if (statHp) statHp.textContent = newHealth;
      }

      if (newHealth <= 0) {
        listItem?.classList.add("defeated");

        let removeButton = listItem?.querySelector(".row-remove-button");
        if (!removeButton && listItem) {
          removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.textContent = "Remove";
          removeButton.className = "remove-button row-remove-button";
          removeButton.addEventListener("click", () => removeEntry(id, listItem));
          listItem.appendChild(removeButton);
        }
      } else {
        listItem?.classList.remove("defeated");
        const removeButton = listItem?.querySelector(".row-remove-button");
        if (removeButton) removeButton.remove();
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
      listItem?.remove();
      delete dataCache[id];
      countdownById.delete(id);

      if (currentStatEntryId === id) {
        currentStatEntryId = null;
      }
      if (currentEffectEntryId === id) {
        currentEffectEntryId = null;
      }

      closeAllModals();
    })
    .catch((error) => {
      console.error("Error removing entry:", error);
    });
}

async function setCountdown(entryId, turns) {
  if (!entryId) return;

  setCountdownState(entryId, {
    active: true,
    remaining: turns,
    ended: false,
  });

  if (dataCache[entryId]) {
    dataCache[entryId].countdownActive = true;
    dataCache[entryId].countdownRemaining = turns;
    dataCache[entryId].countdownEnded = false;
  }

  if (currentStatEntryId === entryId) {
    setCountdownDisplay({
      remaining: turns,
      active: true,
      ended: false,
    });
  }

  await update(ref(db, `${getEntriesPath()}/${entryId}`), {
    countdownActive: true,
    countdownRemaining: turns,
    countdownEnded: false,
  });
}

async function clearCountdown(entryId) {
  if (!entryId) return;

  setCountdownState(entryId, {
    active: false,
    remaining: null,
    ended: false,
  });

  if (dataCache[entryId]) {
    dataCache[entryId].countdownActive = false;
    dataCache[entryId].countdownRemaining = null;
    dataCache[entryId].countdownEnded = false;
  }

  if (currentStatEntryId === entryId) {
    setCountdownDisplay({
      remaining: null,
      active: false,
      ended: false,
    });
  }

  await update(ref(db, `${getEntriesPath()}/${entryId}`), {
    countdownActive: false,
    countdownRemaining: null,
    countdownEnded: false,
  });
}

async function decrementCountdownIfNeeded(entryId) {
  if (!entryId) return;

  const state = getCountdownState(entryId);
  if (!state.active || typeof state.remaining !== "number" || state.remaining <= 0) return;

  const nextRemaining = state.remaining - 1;
  const nextEnded = nextRemaining === 0;

  setCountdownState(entryId, {
    remaining: nextRemaining,
    active: !nextEnded,
    ended: nextEnded,
  });

  if (dataCache[entryId]) {
    dataCache[entryId].countdownRemaining = nextRemaining;
    dataCache[entryId].countdownActive = !nextEnded;
    dataCache[entryId].countdownEnded = nextEnded;
  }

  if (currentStatEntryId === entryId) {
    setCountdownDisplay({
      remaining: nextRemaining,
      active: !nextEnded,
      ended: nextEnded,
    });
  }

  await update(ref(db, `${getEntriesPath()}/${entryId}`), {
    countdownRemaining: nextRemaining,
    countdownActive: !nextEnded,
    countdownEnded: nextEnded,
  });
}

function getHighlightedEntryId() {
  return document.querySelector("#rankingList li.highlighted")?.dataset.entryId || null;
}

onReady(() => {
  try {
    getEntriesPath();
  } catch (error) {
    console.error(error);
    return;
  }

  const statModal = document.getElementById("stat-modal");
  if (statModal) {
    document.getElementById("stat-modal-close")?.addEventListener("click", closeStatModal);
    statModal.addEventListener("click", (e) => {
      if (e.target === statModal) closeStatModal();
    });
  }

  const hpModal = document.getElementById("hp-modal");
  if (hpModal) {
    document.getElementById("hp-modal-close")?.addEventListener("click", closeHpModal);
    hpModal.addEventListener("click", (e) => {
      if (e.target === hpModal) closeHpModal();
    });
  }

  const effectPickerModal = document.getElementById("effect-picker-modal");
  if (effectPickerModal) {
    document.getElementById("effect-picker-close")?.addEventListener("click", closeEffectPickerModal);
    effectPickerModal.addEventListener("click", (e) => {
      if (e.target === effectPickerModal) closeEffectPickerModal();
    });
  }

  const effectsModal = document.getElementById("effects-modal");
  if (effectsModal) {
    document.getElementById("effects-modal-close")?.addEventListener("click", closeEffectsModal);
    effectsModal.addEventListener("click", (e) => {
      if (e.target === effectsModal) closeEffectsModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  fetchRankings();

  document.getElementById("apply-damage-button")?.addEventListener("click", applyDamageToAll);
  document.getElementById("clear-list-button")?.addEventListener("click", clearList);

  document.getElementById("stat-delete")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    if (!confirm("Delete this entry from the list?")) return;

    const row = rowFor(currentStatEntryId);
    removeEntry(currentStatEntryId, row);
  });

  document.getElementById("stat-heal")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const healInput = document.getElementById("stat-heal-amount");
    const amount = parseInt(healInput?.value, 10);
    if (Number.isNaN(amount) || amount <= 0) return;

    const rowHealthInput = getHealthInput(currentStatEntryId);
    if (!rowHealthInput) return;

    const current = parseInt(rowHealthInput.dataset.currentHealth, 10) || 0;
    const newHealth = Math.max(current + amount, 0);

    updateHealth(currentStatEntryId, newHealth, rowHealthInput);
    if (healInput) healInput.value = "";
  });

  document.getElementById("hp-set-button")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const hpInput = document.getElementById("hp-set-amount");
    const amount = parseInt(hpInput?.value, 10);
    if (Number.isNaN(amount) || amount < 0) return;

    const rowHealthInput = getHealthInput(currentStatEntryId);
    if (!rowHealthInput) return;

    updateHealth(currentStatEntryId, amount, rowHealthInput);
    if (hpInput) hpInput.value = "";
    closeHpModal();
  });

  document.getElementById("hp-set-amount")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("hp-set-button")?.click();
    }
  });

  document.getElementById("stat-countdown-set")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;

    const countdownInput = document.getElementById("stat-countdown-amount");
    const turns = parseInt(countdownInput?.value, 10);
    if (Number.isNaN(turns) || turns < 1) return;

    try {
      await setCountdown(currentStatEntryId, turns);
      if (countdownInput) countdownInput.value = "";
    } catch (err) {
      console.error("Error setting countdown:", err);
    }
  });

  document.getElementById("stat-countdown-clear")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;

    try {
      await clearCountdown(currentStatEntryId);
    } catch (err) {
      console.error("Error clearing countdown:", err);
    }
  });

  document.getElementById("stat-add-effect")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    const entry = dataCache[currentStatEntryId];
    openEffectPickerModal(currentStatEntryId, entry?.effects || []);
  });

  document.getElementById("next-button")?.addEventListener("click", () => {
    setTimeout(async () => {
      const currentId = getHighlightedEntryId();
      if (!currentId) return;

      try {
        await decrementCountdownIfNeeded(currentId);
      } catch (err) {
        console.error("Error decrementing countdown:", err);
      }
    }, 0);
  });
});