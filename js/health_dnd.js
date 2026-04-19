// health_dnd.js
import { EFFECTS } from "./js/feffects.js";
import {
  ref,
  update,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./js/ffirebase-config.js";
import { requireAuth } from "./js/fauth.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function normalizeEffects(effects) {
  if (!effects) return [];
  if (Array.isArray(effects)) return effects.filter(Boolean);
  return Object.values(effects).filter(Boolean);
}

function sanitizeEffectKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function rowFor(id) {
  return document.querySelector(`.list-item[data-entry-id="${id}"]`);
}

function getHealthInputForEntry(id) {
  return document.querySelector(`.damage-input[data-entry-id="${id}"]`);
}

let currentStatEntryId = null;
let currentEffectsEntryId = null;

const countdownById = new Map();
const latestEntries = {};

function getCountdownState(id) {
  return countdownById.get(id) || { remaining: null, active: false, ended: false };
}

function setCountdownState(id, state) {
  countdownById.set(id, {
    remaining: typeof state.remaining === "number" ? state.remaining : null,
    active: !!state.active,
    ended: !!state.ended
  });
}

function setStatCountdownDisplay({ remaining, active, ended }) {
  const remainingEl = document.getElementById("stat-countdown-remaining");
  if (!remainingEl) return;

  if (ended) remainingEl.textContent = "ENDED (0)";
  else if (active) remainingEl.textContent = `${remaining ?? "—"}`;
  else if (remaining === 0) remainingEl.textContent = "0";
  else remainingEl.textContent = "—";
}

function openStatModal(entryId) {
  const modal = document.getElementById("stat-modal");
  const entry = latestEntries[entryId];
  if (!modal || !entry) return;

  currentStatEntryId = entryId;

  const state = getCountdownState(entryId);

  document.getElementById("stat-modal-title").textContent = entry.name ?? "";
  document.getElementById("stat-init").textContent = entry.initiative ?? entry.number ?? "N/A";
  document.getElementById("stat-ac").textContent = entry.ac ?? "N/A";
  document.getElementById("stat-hp").textContent = entry.health ?? "N/A";

  const link = document.getElementById("stat-url");
  if (link) {
    if (entry.url) {
      link.style.display = "";
      link.href = entry.url;
    } else {
      link.style.display = "none";
      link.removeAttribute("href");
    }
  }

  setStatCountdownDisplay(state);

  const healInput = document.getElementById("stat-heal-amount");
  if (healInput) healInput.value = "";

  const countdownInput = document.getElementById("stat-countdown-amount");
  if (countdownInput) countdownInput.value = "";

  modal.setAttribute("aria-hidden", "false");
}

function closeStatModal() {
  document.getElementById("stat-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectPickerModal() {
  document.getElementById("effect-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectsModal() {
  document.getElementById("effects-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectDescriptionModal() {
  document.getElementById("effect-description-modal")?.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeStatModal();
  closeEffectPickerModal();
  closeEffectsModal();
  closeEffectDescriptionModal();
}

function openEffectDescriptionModal(effect) {
  const modal = document.getElementById("effect-description-modal");
  if (!modal) return;

  document.getElementById("effect-description-title").textContent = effect.name || "Effect";
  document.getElementById("effect-description-body").textContent =
    effect.description || effect.type || effect.url || "No description available.";

  modal.setAttribute("aria-hidden", "false");
}

function openEffectsModal(entryId) {
  const modal = document.getElementById("effects-modal");
  const list = document.getElementById("effects-modal-list");
  const title = document.getElementById("effects-modal-title");
  const entry = latestEntries[entryId];
  if (!modal || !list || !entry) return;

  currentEffectsEntryId = entryId;
  list.innerHTML = "";
  if (title) title.textContent = `${entry.name || "Entry"} Effects`;

  const normalized = normalizeEffects(entry.effects);

  if (!normalized.length) {
    const p = document.createElement("p");
    p.textContent = "No effects.";
    list.appendChild(p);
  } else {
    normalized.forEach((effect) => {
      const row = document.createElement("div");
      row.className = "effect-picker-row";

      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "bane-picker-open";
      leftButton.dataset.role = "modal-open-effect-description";
      leftButton.dataset.effectName = effect.name || "";

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

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "remove-button";
      removeBtn.style.marginTop = "0";
      removeBtn.dataset.role = "modal-remove-effect";
      removeBtn.dataset.effectName = effect.name || "";

      row.appendChild(leftButton);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  modal.setAttribute("aria-hidden", "false");
}

function openEffectPickerModal(entryId) {
  const modal = document.getElementById("effect-picker-modal");
  const list = document.getElementById("effect-picker-list");
  const entry = latestEntries[entryId];
  if (!modal || !list || !entry) return;

  currentEffectsEntryId = entryId;
  currentStatEntryId = entryId;
  list.innerHTML = "";

  const existing = new Set(normalizeEffects(entry.effects).map((effect) => effect.name));

  EFFECTS.forEach((effect) => {
    const row = document.createElement("div");
    row.className = "effect-picker-row";

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
    addBtn.textContent = existing.has(effect.name) ? "Added" : "Add";
    addBtn.className = "remove-button";
    addBtn.style.marginTop = "0";
    addBtn.disabled = existing.has(effect.name);
    addBtn.dataset.role = "picker-add-effect";
    addBtn.dataset.effectName = effect.name || "";

    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function updateCountdownBadge(row, state) {
  const nameCol = row.querySelector('[data-role="open-stat"]');
  if (!nameCol) return;

  let badge = nameCol.querySelector(".countdown-badge");
  const shouldShow =
    (state.active && typeof state.remaining === "number" && state.remaining > 0) || state.ended;

  if (!shouldShow) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "countdown-badge";
    nameCol.appendChild(badge);
  }

  if (state.ended) {
    badge.textContent = "CD: ENDED";
    badge.classList.add("ended");
  } else {
    badge.textContent = `CD: ${state.remaining}`;
    badge.classList.remove("ended");
  }
}

function applyRowCountdownClasses(id, state) {
  const row = rowFor(id);
  if (!row) return;

  if (state.active && typeof state.remaining === "number" && state.remaining > 0) {
    row.classList.add("countdown-active");
  } else {
    row.classList.remove("countdown-active");
  }

  if (!state.ended) row.classList.remove("countdown-expired");
  updateCountdownBadge(row, state);
}

function syncModalCountdown(id) {
  if (!id || currentStatEntryId !== id) return;
  setStatCountdownDisplay(getCountdownState(id));
}

function buildEffectsRow(entryId, entry) {
  const effectArray = normalizeEffects(entry.effects);

  const effectWrap = document.createElement("div");
  effectWrap.className = "row-effects";

  if (!effectArray.length) return effectWrap;

  const iconsWrap = document.createElement("div");
  iconsWrap.className = "effects-summary-icons";

  effectArray.forEach((effect) => {
    const iconButton = document.createElement("button");
    iconButton.type = "button";
    iconButton.className = "effect-icon-button";
    iconButton.title = effect.name || "Effect";
    iconButton.setAttribute("aria-label", effect.name || "Effect");
    iconButton.dataset.role = "open-effect-description";
    iconButton.dataset.entryId = entryId;
    iconButton.dataset.effectName = effect.name || "";

    const icon = document.createElement("img");
    icon.className = "effect-row-icon";
    icon.src = effect.icon || "icons/effects/test.png";
    icon.alt = effect.name || "Effect";

    iconButton.appendChild(icon);
    iconsWrap.appendChild(iconButton);
  });

  effectWrap.appendChild(iconsWrap);

  const effectsButton = document.createElement("button");
  effectsButton.type = "button";
  effectsButton.textContent = "Effects";
  effectsButton.className = "effects-button";
  effectsButton.dataset.role = "open-effects";
  effectsButton.dataset.entryId = entryId;
  effectWrap.appendChild(effectsButton);

  return effectWrap;
}

function fetchRankings() {
  const entriesRef = ref(db, getEntriesPath());

  onValue(entriesRef, (snapshot) => {
    const data = snapshot.val();
    const rankingList = document.getElementById("rankingList");
    if (!rankingList) return;

    rankingList.innerHTML = "";
    countdownById.clear();

    Object.keys(latestEntries).forEach((key) => delete latestEntries[key]);

    if (!data) return;

    const rankings = Object.entries(data).sort((a, b) => {
      const aNumber = a[1].number ?? a[1].initiative ?? 0;
      const bNumber = b[1].number ?? b[1].initiative ?? 0;
      return bNumber - aNumber;
    });

    rankings.forEach(([id, entry]) => {
      latestEntries[id] = entry;

      setCountdownState(id, {
        remaining: typeof entry.countdownRemaining === "number" ? entry.countdownRemaining : null,
        active: !!entry.countdownActive,
        ended: !!entry.countdownEnded
      });

      const listItem = document.createElement("li");
      listItem.className = "list-item";
      listItem.dataset.entryId = id;

      const nameButton = document.createElement("button");
      nameButton.type = "button";
      nameButton.className = "name";
      nameButton.dataset.role = "open-stat";
      nameButton.dataset.entryId = id;
      nameButton.textContent = entry.name ?? entry.playerName ?? "Unknown";
      listItem.appendChild(nameButton);

      const acDiv = document.createElement("div");
      acDiv.className = "ac";
      acDiv.textContent = `AC: ${entry.ac ?? "N/A"}`;
      listItem.appendChild(acDiv);

      const healthDiv = document.createElement("div");
      healthDiv.className = "health";
      healthDiv.textContent = `HP: ${entry.health ?? "N/A"}`;
      listItem.appendChild(healthDiv);

      const healthInput = document.createElement("input");
      healthInput.type = "number";
      healthInput.placeholder = "Damage";
      healthInput.className = "damage-input";
      healthInput.dataset.entryId = id;
      healthInput.dataset.currentHealth =
        typeof entry.health === "number" ? String(entry.health) : "";

      healthInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const damage = parseInt(healthInput.value, 10);
        if (isNaN(damage)) return;

        const currentHealth = parseInt(healthInput.dataset.currentHealth, 10);
        if (Number.isNaN(currentHealth)) return;

        const updatedHealth = Math.max(currentHealth - damage, 0);
        updateHealth(id, updatedHealth, healthInput);
        healthInput.value = "";
      });

      listItem.appendChild(healthInput);

      const effectRow = buildEffectsRow(id, entry);
      listItem.appendChild(effectRow);

      if (typeof entry.health === "number" && entry.health <= 0) {
        listItem.classList.add("defeated");
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.className = "remove-button";
        removeButton.dataset.role = "remove-entry";
        removeButton.dataset.entryId = id;
        listItem.appendChild(removeButton);
      }

      rankingList.appendChild(listItem);
      applyRowCountdownClasses(id, getCountdownState(id));
    });

    syncModalCountdown(currentStatEntryId);
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

      if (latestEntries[id]) latestEntries[id].health = newHealth;
      if (currentStatEntryId === id) {
        document.getElementById("stat-hp").textContent = newHealth;
      }
    })
    .catch((error) => {
      console.error("Error updating health:", error);
    });
}

function applyDamageToAll() {
  const healthInputs = document.querySelectorAll(".damage-input");

  healthInputs.forEach((input) => {
    const damage = parseInt(input.value, 10);
    if (isNaN(damage)) return;

    const currentHealth = parseInt(input.dataset.currentHealth, 10);
    if (Number.isNaN(currentHealth)) return;

    const updatedHealth = Math.max(currentHealth - damage, 0);
    const id = input.dataset.entryId;

    updateHealth(id, updatedHealth, input);
    input.value = "";
  });
}

function clearList() {
  remove(ref(db, getEntriesPath()))
    .then(() => {
      document.getElementById("rankingList").innerHTML = "";
      countdownById.clear();
      window.roundCounter = 1;
      window.updateRoundDisplay?.();
    })
    .catch((error) => {
      console.error("Error clearing list:", error);
    });
}

function removeEntry(id) {
  remove(ref(db, `${getEntriesPath()}/${id}`)).catch((error) => {
    console.error("Error removing entry:", error);
  });
}

async function setCountdown(id, turns) {
  if (!id || !Number.isFinite(turns) || turns < 1) return;

  const reference = ref(db, `${getEntriesPath()}/${id}`);
  setCountdownState(id, { remaining: turns, active: true, ended: false });
  applyRowCountdownClasses(id, getCountdownState(id));
  syncModalCountdown(id);

  return update(reference, {
    countdownActive: true,
    countdownRemaining: turns,
    countdownEnded: false
  });
}

async function clearCountdown(id) {
  if (!id) return;

  const reference = ref(db, `${getEntriesPath()}/${id}`);
  setCountdownState(id, { remaining: null, active: false, ended: false });
  applyRowCountdownClasses(id, getCountdownState(id));
  syncModalCountdown(id);

  return update(reference, {
    countdownActive: null,
    countdownRemaining: null,
    countdownEnded: null
  });
}

async function decrementCountdownIfNeeded(entryId) {
  const state = getCountdownState(entryId);
  if (!state.active) return;
  if (typeof state.remaining !== "number") return;
  if (state.remaining <= 0) return;

  const nextRemaining = state.remaining - 1;
  const reference = ref(db, `${getEntriesPath()}/${entryId}`);

  if (nextRemaining <= 0) {
    setCountdownState(entryId, { remaining: 0, active: false, ended: true });
    applyRowCountdownClasses(entryId, getCountdownState(entryId));
    syncModalCountdown(entryId);

    await update(reference, {
      countdownRemaining: 0,
      countdownActive: false,
      countdownEnded: true
    });
    return;
  }

  setCountdownState(entryId, { remaining: nextRemaining, active: true, ended: false });
  applyRowCountdownClasses(entryId, getCountdownState(entryId));
  syncModalCountdown(entryId);

  await update(reference, {
    countdownRemaining: nextRemaining,
    countdownActive: true,
    countdownEnded: false
  });
}

async function cleanupEndedCountdownIfNeeded(entryId) {
  if (!entryId) return;
  const state = getCountdownState(entryId);
  if (!state.ended) return;

  try {
    await clearCountdown(entryId);
  } catch (error) {
    console.error("Error cleaning up ended countdown:", error);
  }
}

window.addEventListener("tracker:highlightChange", async (event) => {
  const previousId = event?.detail?.previousId ?? null;
  const currentId = event?.detail?.currentId ?? null;
  const reason = event?.detail?.reason ?? "sync";

  if ((reason === "next" || reason === "prev") && previousId && previousId !== currentId) {
    await cleanupEndedCountdownIfNeeded(previousId);
    const prevRow = rowFor(previousId);
    if (prevRow) prevRow.classList.remove("countdown-expired");
  }

  if (currentId && (reason === "next" || reason === "prev")) {
    try {
      await decrementCountdownIfNeeded(currentId);
    } catch (error) {
      console.error("Error decrementing countdown:", error);
    }
  }

  if (currentId) {
    const currentState = getCountdownState(currentId);
    const row = rowFor(currentId);
    if (row) {
      if (currentState.ended) row.classList.add("countdown-expired");
      else row.classList.remove("countdown-expired");
    }
  }
});

function bindRankingListDelegation() {
  const rankingList = document.getElementById("rankingList");
  if (!rankingList) return;

  rankingList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-role]");
    if (!target) return;

    const role = target.dataset.role;
    const entryId = target.dataset.entryId;

    if (role === "open-stat" && entryId) {
      openStatModal(entryId);
      return;
    }

    if (role === "open-effects" && entryId) {
      openEffectsModal(entryId);
      return;
    }

    if (role === "remove-entry" && entryId) {
      removeEntry(entryId);
      return;
    }

    if (role === "open-effect-description" && entryId) {
      const entry = latestEntries[entryId];
      const effectName = target.dataset.effectName;
      const effect = normalizeEffects(entry?.effects).find((item) => item.name === effectName);
      if (effect) openEffectDescriptionModal(effect);
    }
  });
}

function bindModalActions() {
  document.getElementById("stat-modal-close")?.addEventListener("click", closeStatModal);
  document.getElementById("stat-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "stat-modal") closeStatModal();
  });

  document.getElementById("effect-picker-close")?.addEventListener("click", closeEffectPickerModal);
  document.getElementById("effect-picker-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "effect-picker-modal") closeEffectPickerModal();
  });

  document.getElementById("effects-modal-close")?.addEventListener("click", closeEffectsModal);
  document.getElementById("effects-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "effects-modal") closeEffectsModal();
  });

  document
    .getElementById("effect-description-close")
    ?.addEventListener("click", closeEffectDescriptionModal);
  document.getElementById("effect-description-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "effect-description-modal") closeEffectDescriptionModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  document.getElementById("stat-delete")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const entry = latestEntries[currentStatEntryId];
    const entryName = entry?.name ?? "this entry";
    const confirmed = window.confirm(
      `Are you sure you want to delete "${entryName}" from the list?`
    );

    if (!confirmed) return;

    removeEntry(currentStatEntryId);
    closeStatModal();
  });

  document.getElementById("stat-heal")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const healAmount = parseInt(document.getElementById("stat-heal-amount")?.value, 10);
    if (isNaN(healAmount) || healAmount <= 0) return;

    const input = getHealthInputForEntry(currentStatEntryId);
    if (!input) return;

    const currentHealth = parseInt(input.dataset.currentHealth ?? "0", 10) || 0;
    updateHealth(currentStatEntryId, currentHealth + healAmount, input);
    document.getElementById("stat-heal-amount").value = "";
  });

  document.getElementById("stat-countdown-set")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;

    const turns = parseInt(document.getElementById("stat-countdown-amount")?.value, 10);
    if (isNaN(turns) || turns <= 0) return;

    try {
      await setCountdown(currentStatEntryId, turns);
      document.getElementById("stat-countdown-amount").value = "";
    } catch (error) {
      console.error("Error setting countdown:", error);
    }
  });

  document.getElementById("stat-countdown-clear")?.addEventListener("click", async () => {
    if (!currentStatEntryId) return;
    try {
      await clearCountdown(currentStatEntryId);
    } catch (error) {
      console.error("Error clearing countdown:", error);
    }
  });

  document.getElementById("stat-add-effect")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    openEffectPickerModal(currentStatEntryId);
  });

  const effectsModalList = document.getElementById("effects-modal-list");
  effectsModalList?.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-role]");
    if (!target || !currentEffectsEntryId) return;

    const effectName = target.dataset.effectName;
    const entry = latestEntries[currentEffectsEntryId];
    const effect = normalizeEffects(entry?.effects).find((item) => item.name === effectName);

    if (target.dataset.role === "modal-open-effect-description" && effect) {
      openEffectDescriptionModal(effect);
      return;
    }

    if (target.dataset.role === "modal-remove-effect" && effectName) {
      const key = sanitizeEffectKey(effectName);
      try {
        await remove(ref(db, `${getEntriesPath()}/${currentEffectsEntryId}/effects/${key}`));
      } catch (error) {
        console.error("Error removing effect:", error);
      }
    }
  });

  const effectPickerList = document.getElementById("effect-picker-list");
  effectPickerList?.addEventListener("click", async (event) => {
    const target = event.target.closest('[data-role="picker-add-effect"]');
    if (!target || !currentEffectsEntryId) return;

    const effectName = target.dataset.effectName;
    const effect = EFFECTS.find((item) => item.name === effectName);
    if (!effect) return;

    try {
      const key = sanitizeEffectKey(effect.name);
      await update(ref(db, `${getEntriesPath()}/${currentEffectsEntryId}/effects`), {
        [key]: {
          name: effect.name,
          url: effect.url || "",
          icon: effect.icon || "icons/effects/test.png",
          type: effect.type || "",
          description: effect.description || ""
        }
      });
    } catch (error) {
      console.error("Error adding effect:", error);
    }
  });
}

onReady(() => {
  bindRankingListDelegation();
  bindModalActions();

  requireAuth().then(() => {
    fetchRankings();

    document.getElementById("apply-damage-button")?.addEventListener("click", applyDamageToAll);
    document.getElementById("clear-list-button")?.addEventListener("click", async () => {
      await clearList();
      window.roundCounter = 1;
      window.updateRoundDisplay?.();
    });
  }).catch((error) => {
    console.error("Auth failed on DND page:", error);
  });
});