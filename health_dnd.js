import {
  ref,
  update,
  onValue,
  remove,
  set
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import { EFFECTS } from "./effects.js";

await requireAuth();

let currentStatEntryId = null;
let currentEffectEntryId = null;

const countdownById = new Map();
const dataCache = {};

function qs(id) {
  return document.getElementById(id);
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

function normalizeEntry(id, entry = {}) {
  const rawRemaining = entry.countdownRemaining;
  let countdownRemaining = null;

  if (typeof rawRemaining === "number" && !Number.isNaN(rawRemaining)) {
    countdownRemaining = rawRemaining;
  } else if (rawRemaining !== null && rawRemaining !== undefined && rawRemaining !== "") {
    const parsed = Number(rawRemaining);
    countdownRemaining = Number.isNaN(parsed) ? null : parsed;
  }

  return {
    id,
    name: entry.name ?? entry.playerName ?? "Unknown",
    number: entry.number ?? entry.initiative ?? 0,
    initiative: entry.initiative ?? entry.number ?? 0,
    health: entry.health ?? null,
    ac: entry.ac ?? null,
    url: entry.url ?? "",
    effects: normalizeEffects(entry.effects),
    countdownActive: !!entry.countdownActive,
    countdownRemaining,
    countdownEnded: !!entry.countdownEnded
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
    ended: false
  };
}

function setCountdownState(entryId, state) {
  countdownById.set(entryId, {
    active: !!state.active,
    remaining:
      typeof state.remaining === "number" && !Number.isNaN(state.remaining)
        ? state.remaining
        : null,
    ended: !!state.ended
  });
}

function setCountdownDisplay({ remaining, active, ended }) {
  const el = qs("stat-countdown-remaining");
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

function ensureEnhancementStyles() {
  if (qs("dnd-health-enhancements")) return;

  const style = document.createElement("style");
  style.id = "dnd-health-enhancements";
  style.textContent = `
    .countdown-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      line-height: 1.2;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.18);
      white-space: nowrap;
    }

    .countdown-badge.ended {
      background: rgba(140, 24, 24, 0.18);
      border-color: rgba(220, 90, 90, 0.35);
    }

    #rankingList li.countdown-active {
      box-shadow: inset 0 0 0 1px rgba(130, 200, 130, 0.3);
    }

    #rankingList li.countdown-expired {
      box-shadow: inset 0 0 0 2px rgba(220, 90, 90, 0.28);
    }

    .effect-picker-row,
    .effects-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
    }

    .effect-picker-left,
    .effects-row-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .effect-icon {
      width: 28px;
      height: 28px;
      object-fit: cover;
      border-radius: 6px;
      flex: 0 0 auto;
    }

    .effect-icon-button {
      border: 0;
      background: transparent;
      padding: 0;
      cursor: pointer;
      margin-right: 6px;
    }

    .row-effects {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 8px 0 4px;
    }

    .name-button {
      display: inline-flex;
      align-items: center;
      gap: 0;
    }
  `;
  document.head.appendChild(style);
}

function badgeTextFor(state) {
  if (state.ended) return "CD: ENDED";
  if (state.active && typeof state.remaining === "number" && state.remaining > 0) {
    return `CD: ${state.remaining}`;
  }
  return "";
}

function applyCountdownClassesAndBadge(entryId) {
  const row = rowFor(entryId);
  if (!row) return;

  const state = getCountdownState(entryId);
  const nameButton = row.querySelector(".name-button");
  if (!nameButton) return;

  let badge = nameButton.querySelector(".countdown-badge");
  const text = badgeTextFor(state);

  row.classList.toggle(
    "countdown-active",
    !!state.active && typeof state.remaining === "number" && state.remaining > 0
  );
  row.classList.toggle("countdown-expired", !!state.ended);

  if (!text) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "countdown-badge";
    nameButton.appendChild(badge);
  }

  badge.textContent = text;
  badge.classList.toggle("ended", !!state.ended);
}

function syncPopupCountdownIfOpen(entryId) {
  if (!entryId || currentStatEntryId !== entryId) return;
  const state = getCountdownState(entryId);
  setCountdownDisplay(state);
}

function openStatModal(entry) {
  const modal = qs("stat-modal");
  if (!modal || !entry) return;

  currentStatEntryId = entry.id;

  qs("stat-modal-title").textContent = entry.name ?? "";
  qs("stat-init").textContent = entry.initiative ?? "N/A";
  qs("stat-ac").textContent = entry.ac ?? "N/A";
  qs("stat-hp").textContent = entry.health ?? "N/A";

  const linkEl = qs("stat-url");
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
    ended: entry.countdownEnded
  });

  const healInput = qs("stat-heal-amount");
  if (healInput) healInput.value = "";

  const countdownInput = qs("stat-countdown-amount");
  if (countdownInput) countdownInput.value = "";

  modal.setAttribute("aria-hidden", "false");
}

function closeStatModal() {
  qs("stat-modal")?.setAttribute("aria-hidden", "true");
  currentStatEntryId = null;
}

function openHpModal(entry) {
  const modal = qs("hp-modal");
  if (!modal || !entry) return;
  currentStatEntryId = entry.id;
  qs("hp-modal-title").textContent = `Set HP: ${entry.name ?? ""}`;
  const hpInput = qs("hp-set-amount");
  if (hpInput) hpInput.value = "";
  modal.setAttribute("aria-hidden", "false");
}

function closeHpModal() {
  qs("hp-modal")?.setAttribute("aria-hidden", "true");
}

function openEffectDescription(effect) {
  const modal = qs("effect-description-modal");
  if (!modal) return;

  qs("effect-description-title").textContent = effect?.name || "Effect";
  qs("effect-description-body").textContent =
    effect?.type || effect?.url || "No description available.";

  modal.setAttribute("aria-hidden", "false");
}

function closeEffectDescription() {
  qs("effect-description-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectPickerModal() {
  qs("effect-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectsModal() {
  qs("effects-modal")?.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeStatModal();
  closeHpModal();
  closeEffectPickerModal();
  closeEffectsModal();
  closeEffectDescription();
}

function openEffectsModal(entryId, effects, titleText = "Effects") {
  const modal = qs("effects-modal");
  const list = qs("effects-modal-list");
  const title = qs("effects-modal-title");

  if (!modal || !list) return;

  currentEffectEntryId = entryId;
  list.innerHTML = "";
  if (title) title.textContent = titleText;

  const safeEffects = normalizeEffects(effects);

  if (!safeEffects.length) {
    const empty = document.createElement("p");
    empty.textContent = "No effects.";
    list.appendChild(empty);
  } else {
    safeEffects.forEach((effect) => {
      const row = document.createElement("div");
      row.className = "effects-row";

      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "effects-row-left";
      leftButton.style.border = "0";
      leftButton.style.background = "transparent";
      leftButton.style.padding = "0";
      leftButton.style.cursor = "pointer";
      leftButton.addEventListener("click", () => openEffectDescription(effect));

      const icon = document.createElement("img");
      icon.className = "effect-icon";
      icon.src = effect.icon || "icons/effects/test.png";
      icon.alt = effect.name || "Effect";

      const name = document.createElement("span");
      name.textContent = effect.name || "Unknown";

      leftButton.appendChild(icon);
      leftButton.appendChild(name);

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

  const modal = qs("effect-picker-modal");
  const list = qs("effect-picker-list");
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
            type: effect.type || ""
          }
        });
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

function renderEffectsRow(entryId, effectArray, name) {
  if (!effectArray.length) return null;

  const effectWrap = document.createElement("div");
  effectWrap.className = "row-effects";

  effectArray.forEach((effect) => {
    const iconButton = document.createElement("button");
    iconButton.type = "button";
    iconButton.className = "effect-icon-button";
    iconButton.title = effect.name || "Effect";
    iconButton.setAttribute("aria-label", effect.name || "Effect");
    iconButton.addEventListener("click", (e) => {
      e.stopPropagation();
      openEffectDescription(effect);
    });

    const icon = document.createElement("img");
    icon.className = "effect-icon";
    icon.src = effect.icon || "icons/effects/test.png";
    icon.alt = effect.name || "Effect";

    iconButton.appendChild(icon);
    effectWrap.appendChild(iconButton);
  });

  const effectsButton = document.createElement("button");
  effectsButton.type = "button";
  effectsButton.textContent = "Effects";
  effectsButton.className = "remove-button";
  effectsButton.style.marginTop = "0";
  effectsButton.addEventListener("click", (e) => {
    e.stopPropagation();
    openEffectsModal(entryId, effectArray, `${name} effects`);
  });

  effectWrap.appendChild(effectsButton);
  return effectWrap;
}

function buildEntryRow(entry) {
  const {
    id,
    name,
    ac,
    health,
    initiative,
    effects
  } = entry;

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
  const effectWrap = renderEffectsRow(id, effectArray, name);
  if (effectWrap) listItem.appendChild(effectWrap);

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
  healthInput.dataset.currentHealth =
    health !== null && health !== undefined ? String(health) : "0";

  healthInput.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    const damage = parseInt(healthInput.value, 10);
    if (Number.isNaN(damage) || damage < 0) return;

    const currentHealth = parseInt(healthInput.dataset.currentHealth, 10) || 0;
    const updatedHealth = Math.max(currentHealth - damage, 0);

    updateHealth(id, updatedHealth, healthInput);
    healthInput.value = "";
  });

  listItem.appendChild(healthInput);

  const initDiv = document.createElement("div");
  initDiv.className = "initiative-display";
  initDiv.textContent = `Init: ${initiative ?? "N/A"}`;
  listItem.appendChild(initDiv);

  applyCountdownClassesAndBadge(id);

  return listItem;
}

function fetchRankings() {
  const reference = ref(db, getEntriesPath());

  onValue(reference, (snapshot) => {
    const data = snapshot.val();
    const rankingList = qs("rankingList");
    if (!rankingList) return;

    rankingList.innerHTML = "";
    countdownById.clear();

    Object.keys(dataCache).forEach((key) => delete dataCache[key]);

    if (!data) {
      return;
    }

    const rankings = Object.entries(data)
      .map(([id, entry]) => normalizeEntry(id, entry))
      .sort((a, b) => (b.number || 0) - (a.number || 0));

    rankings.forEach((entry) => {
      dataCache[entry.id] = entry;

      setCountdownState(entry.id, {
        remaining:
          typeof entry.countdownRemaining === "number" ? entry.countdownRemaining : null,
        active: !!entry.countdownActive,
        ended: !!entry.countdownEnded
      });

      const row = buildEntryRow(entry);
      rankingList.appendChild(row);
      applyCountdownClassesAndBadge(entry.id);
    });

    syncPopupCountdownIfOpen(currentStatEntryId);
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

      healthInput.dataset.currentHealth = String(newHealth);

      if (dataCache[id]) {
        dataCache[id].health = newHealth;
        if (currentStatEntryId === id) {
          qs("stat-hp").textContent = newHealth;
        }
      }
    })
    .catch((error) => {
      console.error("Error updating health:", error);
    });
}

function applyDamageToAll() {
  document.querySelectorAll(".damage-input").forEach((input) => {
    const damage = parseInt(input.value, 10);
    if (Number.isNaN(damage) || damage < 0) return;

    const entryId = input.dataset.entryId;
    const currentHealth = parseInt(input.dataset.currentHealth, 10) || 0;
    const updatedHealth = Math.max(currentHealth - damage, 0);

    updateHealth(entryId, updatedHealth, input);
    input.value = "";
  });
}

function clearList() {
  remove(ref(db, getEntriesPath()))
    .then(() => {
      const rankingList = qs("rankingList");
      if (rankingList) rankingList.innerHTML = "";
      countdownById.clear();
      Object.keys(dataCache).forEach((key) => delete dataCache[key]);
      closeAllModals();
    })
    .catch((error) => {
      console.error("Error clearing list:", error);
    });
}

function removeEntry(id) {
  if (!id) return;

  const listItem = rowFor(id);
  const reference = ref(db, `${getEntriesPath()}/${id}`);

  remove(reference)
    .then(() => {
      listItem?.remove();
      delete dataCache[id];
      countdownById.delete(id);

      if (currentStatEntryId === id) currentStatEntryId = null;
      if (currentEffectEntryId === id) currentEffectEntryId = null;

      closeAllModals();
    })
    .catch((error) => {
      console.error("Error removing entry:", error);
    });
}

function setLocalCountdown(entryId, state) {
  setCountdownState(entryId, state);

  if (dataCache[entryId]) {
    dataCache[entryId].countdownActive = !!state.active;
    dataCache[entryId].countdownRemaining =
      typeof state.remaining === "number" ? state.remaining : null;
    dataCache[entryId].countdownEnded = !!state.ended;
  }

  applyCountdownClassesAndBadge(entryId);
  syncPopupCountdownIfOpen(entryId);
}

async function setCountdown(entryId, turns) {
  if (!entryId) return;

  setLocalCountdown(entryId, {
    active: true,
    remaining: turns,
    ended: false
  });

  await update(ref(db, `${getEntriesPath()}/${entryId}`), {
    countdownActive: true,
    countdownRemaining: turns,
    countdownEnded: false
  });
}

async function clearCountdown(entryId) {
  if (!entryId) return;

  setLocalCountdown(entryId, {
    active: false,
    remaining: null,
    ended: false
  });

  await update(ref(db, `${getEntriesPath()}/${entryId}`), {
    countdownActive: false,
    countdownRemaining: null,
    countdownEnded: false
  });
}

async function decrementCountdownIfNeeded(entryId) {
  if (!entryId) return;

  const state = getCountdownState(entryId);
  if (!state.active || typeof state.remaining !== "number" || state.remaining <= 0) return;

  const nextRemaining = state.remaining - 1;
  const nextEnded = nextRemaining === 0;

  setLocalCountdown(entryId, {
    remaining: nextRemaining,
    active: !nextEnded,
    ended: nextEnded
  });

  await update(ref(db, `${getEntriesPath()}/${entryId}`), {
    countdownActive: !nextEnded,
    countdownRemaining: nextRemaining,
    countdownEnded: nextEnded
  });
}

async function cleanupEndedCountdownIfNeeded(entryId) {
  if (!entryId) return;

  const state = getCountdownState(entryId);
  if (!state.ended) return;

  await clearCountdown(entryId);

  const row = rowFor(entryId);
  if (row) {
    row.classList.remove("countdown-expired");
  }
}

function bindModalEvents() {
  const statModal = qs("stat-modal");
  if (statModal) {
    qs("stat-modal-close")?.addEventListener("click", closeStatModal);
    statModal.addEventListener("click", (e) => {
      if (e.target === statModal) closeStatModal();
    });
  }

  const hpModal = qs("hp-modal");
  if (hpModal) {
    qs("hp-modal-close")?.addEventListener("click", closeHpModal);
    hpModal.addEventListener("click", (e) => {
      if (e.target === hpModal) closeHpModal();
    });
  }

  const effectPickerModal = qs("effect-picker-modal");
  if (effectPickerModal) {
    qs("effect-picker-close")?.addEventListener("click", closeEffectPickerModal);
    effectPickerModal.addEventListener("click", (e) => {
      if (e.target === effectPickerModal) closeEffectPickerModal();
    });
  }

  const effectsModal = qs("effects-modal");
  if (effectsModal) {
    qs("effects-modal-close")?.addEventListener("click", closeEffectsModal);
    effectsModal.addEventListener("click", (e) => {
      if (e.target === effectsModal) closeEffectsModal();
    });
  }

  const effectDescModal = qs("effect-description-modal");
  if (effectDescModal) {
    qs("effect-description-close")?.addEventListener("click", closeEffectDescription);
    effectDescModal.addEventListener("click", (e) => {
      if (e.target === effectDescModal) closeEffectDescription();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });
}

function bindActionEvents() {
  qs("apply-damage-button")?.addEventListener("click", applyDamageToAll);
  qs("clear-list-button")?.addEventListener("click", clearList);

  qs("stat-delete")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    removeEntry(currentStatEntryId);
  });

  qs("stat-heal")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const healInput = qs("stat-heal-amount");
    const amount = parseInt(healInput?.value, 10);
    if (Number.isNaN(amount) || amount < 0) return;

    const rowHealthInput = getHealthInput(currentStatEntryId);
    if (!rowHealthInput) return;

    const current = parseInt(rowHealthInput.dataset.currentHealth, 10) || 0;
    const newHealth = Math.max(current + amount, 0);

    updateHealth(currentStatEntryId, newHealth, rowHealthInput);
    if (healInput) healInput.value = "";
  });

  qs("hp-set-button")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const hpInput = qs("hp-set-amount");
    const amount = parseInt(hpInput?.value, 10);
    if (Number.isNaN(amount) || amount < 0) return;

    const rowHealthInput = getHealthInput(currentStatEntryId);
    if (!rowHealthInput) return;

    updateHealth(currentStatEntryId, amount, rowHealthInput);
    if (hpInput) hpInput.value = "";
    closeHpModal();
  });

  qs("hp-set-amount")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      qs("hp-set-button")?.click();
    }
  });

  qs("stat-countdown-set")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;

    const countdownInput = qs("stat-countdown-amount");
    const turns = parseInt(countdownInput?.value, 10);
    if (Number.isNaN(turns) || turns < 1) return;

    try {
      await setCountdown(currentStatEntryId, turns);
      if (countdownInput) countdownInput.value = "";
    } catch (err) {
      console.error("Error setting countdown:", err);
    }
  });

  qs("stat-countdown-clear")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;

    try {
      await clearCountdown(currentStatEntryId);
    } catch (err) {
      console.error("Error clearing countdown:", err);
    }
  });

  qs("stat-add-effect")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    const entry = dataCache[currentStatEntryId];
    openEffectPickerModal(currentStatEntryId, entry?.effects || []);
  });
}

function bindTurnCountdownSync() {
  window.addEventListener("tracker:highlightChange", async (event) => {
    const detail = event?.detail || {};
    const { previousId, currentId, reason } = detail;

    if (reason !== "next" && reason !== "prev") return;

    try {
      await cleanupEndedCountdownIfNeeded(previousId);
      await decrementCountdownIfNeeded(currentId);
    } catch (err) {
      console.error("Error processing countdown turn sync:", err);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureEnhancementStyles();
  bindModalEvents();
  bindActionEvents();
  bindTurnCountdownSync();
  fetchRankings();
});