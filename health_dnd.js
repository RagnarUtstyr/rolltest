import { ref, update, onValue, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { EFFECTS } from "./effects.js";

await requireAuth();

let currentEffectEntryId = null;
let currentStatEntryId = null;

const countdownById = new Map();
const dataCache = {};

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
        : (entry.countdownRemaining !== undefined && entry.countdownRemaining !== "")
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
  return (
    countdownById.get(entryId) || {
      active: false,
      remaining: null,
      ended: false,
    }
  );
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

function closeEffectPickerModal() {
  document.getElementById("effect-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectsModal() {
  document.getElementById("effects-modal")?.setAttribute("aria-hidden", "true");
}

function openStatModal({
  id,
  name,
  initiative,
  url,
  countdownRemaining,
  countdownActive,
  countdownEnded,
}) {
  const modal = document.getElementById("stat-modal");
  if (!modal) return;

  currentStatEntryId = id;

  const titleEl = document.getElementById("stat-modal-title");
  const initEl = document.getElementById("stat-init");
  const urlEl = document.getElementById("stat-url");
  const healInputEl = document.getElementById("stat-heal-amount");
  const countdownInputEl = document.getElementById("stat-countdown-amount");

  if (titleEl) titleEl.textContent = name ?? "";
  if (initEl) initEl.textContent = initiative ?? "N/A";

  if (urlEl) {
    if (url) {
      urlEl.style.display = "";
      urlEl.href = url;
    } else {
      urlEl.style.display = "none";
      urlEl.removeAttribute("href");
    }
  }

  setCountdownDisplay({
    remaining: countdownRemaining,
    active: countdownActive,
    ended: countdownEnded,
  });

  if (healInputEl) healInputEl.value = "";
  if (countdownInputEl) countdownInputEl.value = "";

  modal.setAttribute("aria-hidden", "false");
}

function closeStatModal() {
  const modal = document.getElementById("stat-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
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
          type: effect.type || "",
        },
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
        initiative,
        ac,
        health,
        url,
        effects,
        countdownActive,
        countdownRemaining,
        countdownEnded,
      } = entry;

      dataCache[id] = entry;
      setCountdownState(id, {
        active: countdownActive,
        remaining: countdownRemaining,
        ended: countdownEnded,
      });

      const listItem = document.createElement("li");
      listItem.className = "list-item";
      listItem.dataset.entryId = id;

      const nameAcContainer = document.createElement("div");
      nameAcContainer.className = "name-ac-container";

      const nameDiv = document.createElement("button");
      nameDiv.type = "button";
      nameDiv.className = "name";
      nameDiv.textContent = name;
      nameDiv.style.cursor = "pointer";
      nameDiv.style.background = "transparent";
      nameDiv.style.border = "0";
      nameDiv.style.padding = "0";
      nameDiv.style.textAlign = "left";
      nameDiv.title = "Show details";

      nameDiv.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const s = getCountdownState(id);

        openStatModal({
          id,
          name,
          initiative: initiative ?? "N/A",
          url,
          countdownRemaining: s.remaining,
          countdownActive: s.active,
          countdownEnded: s.ended,
        });
      });

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
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.className = "remove-button row-remove-button";
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
      const listItem = healthInput.parentElement;
      const healthDiv = listItem.querySelector(".health");

      if (healthDiv) {
        healthDiv.textContent = `HP: ${newHealth}`;
      }

      healthInput.dataset.currentHealth = newHealth;

      if (newHealth <= 0) {
        listItem.classList.add("defeated");

        let removeButton = listItem.querySelector(".row-remove-button");
        if (!removeButton) {
          removeButton = document.createElement("button");
          removeButton.type = "button";
          removeButton.textContent = "Remove";
          removeButton.className = "remove-button row-remove-button";
          removeButton.addEventListener("click", () => {
            removeEntry(id, listItem);
          });
          listItem.appendChild(removeButton);
        }
      } else {
        listItem.classList.remove("defeated");
        const removeButton = listItem.querySelector(".row-remove-button");
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
        closeStatModal();
        currentStatEntryId = null;
      }
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

  if (currentStatEntryId === entryId) {
    setCountdownDisplay({
      remaining: turns,
      active: true,
      ended: false,
    });
  }

  const reference = ref(db, `${getEntriesPath()}/${entryId}`);
  await update(reference, {
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

  if (currentStatEntryId === entryId) {
    setCountdownDisplay({
      remaining: null,
      active: false,
      ended: false,
    });
  }

  const reference = ref(db, `${getEntriesPath()}/${entryId}`);
  await update(reference, {
    countdownActive: false,
    countdownRemaining: null,
    countdownEnded: false,
  });
}

async function decrementCountdownIfNeeded(entryId) {
  if (!entryId) return;

  const state = getCountdownState(entryId);
  if (!state.active) return;
  if (typeof state.remaining !== "number") return;
  if (state.remaining <= 0) return;

  const nextRemaining = state.remaining - 1;
  const nextEnded = nextRemaining === 0;

  setCountdownState(entryId, {
    remaining: nextRemaining,
    active: !nextEnded,
    ended: nextEnded,
  });

  if (currentStatEntryId === entryId) {
    setCountdownDisplay({
      remaining: nextRemaining,
      active: !nextEnded,
      ended: nextEnded,
    });
  }

  const reference = ref(db, `${getEntriesPath()}/${entryId}`);
  await update(reference, {
    countdownRemaining: nextRemaining,
    countdownActive: !nextEnded,
    countdownEnded: nextEnded,
  });
}

function getHighlightedEntryId() {
  return document.querySelector("#rankingList li.highlighted")?.dataset.entryId || null;
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

  document.getElementById("apply-damage-button")?.addEventListener("click", applyDamageToAll);
  document.getElementById("effect-picker-close")?.addEventListener("click", closeEffectPickerModal);
  document.getElementById("effects-modal-close")?.addEventListener("click", closeEffectsModal);
  document.getElementById("stat-modal-close")?.addEventListener("click", closeStatModal);

  document.getElementById("effect-picker-modal")?.addEventListener("click", (e) => {
    if (e.target?.id === "effect-picker-modal") closeEffectPickerModal();
  });

  document.getElementById("effects-modal")?.addEventListener("click", (e) => {
    if (e.target?.id === "effects-modal") closeEffectsModal();
  });

  document.getElementById("stat-modal")?.addEventListener("click", (e) => {
    if (e.target?.id === "stat-modal") closeStatModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeEffectPickerModal();
      closeEffectsModal();
      closeStatModal();
    }
  });

  document.getElementById("stat-delete")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    if (!confirm("Delete this entry from the list?")) return;

    const row = rowFor(currentStatEntryId);
    removeEntry(currentStatEntryId, row);
  });

  document.getElementById("stat-heal")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const healAmtInput = document.getElementById("stat-heal-amount");
    const amount = parseInt(healAmtInput?.value, 10);
    if (Number.isNaN(amount) || amount <= 0) return;

    const dmgInput = getHealthInput(currentStatEntryId);
    if (!dmgInput) return;

    const current = parseInt(dmgInput.dataset.currentHealth, 10) || 0;
    const newHealth = Math.max(current + amount, 0);

    updateHealth(currentStatEntryId, newHealth, dmgInput);
    if (healAmtInput) healAmtInput.value = "";
  });

  document.getElementById("stat-countdown-set")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;

    const countdownAmtInput = document.getElementById("stat-countdown-amount");
    const turns = parseInt(countdownAmtInput?.value, 10);
    if (Number.isNaN(turns) || turns < 1) return;

    try {
      await setCountdown(currentStatEntryId, turns);
      if (countdownAmtInput) countdownAmtInput.value = "";
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
    const previousId = getHighlightedEntryId();

    setTimeout(async () => {
      if (!previousId) return;

      try {
        await decrementCountdownIfNeeded(previousId);
      } catch (err) {
        console.error("Error decrementing countdown:", err);
      }
    }, 0);
  });
});