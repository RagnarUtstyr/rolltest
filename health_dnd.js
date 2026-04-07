// health_dnd.js
import { EFFECTS } from "./effects.js";
import {
  ref,
  update,
  onValue,
  remove
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";

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
let currentHpEntryId = null;

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
  const inputEl = document.getElementById("stat-countdown-amount");

  if (remainingEl) {
    if (ended) remainingEl.textContent = "ENDED (0)";
    else if (active) remainingEl.textContent = `${remaining ?? "—"}`;
    else if (remaining === 0) remainingEl.textContent = "0";
    else remainingEl.textContent = "—";
  }

  if (inputEl) inputEl.value = "";
}

function openStatModal({
  id,
  name,
  ac,
  health,
  url,
  initiative,
  countdownRemaining,
  countdownActive,
  countdownEnded
}) {
  const modal = document.getElementById("stat-modal");
  if (!modal) return;

  currentStatEntryId = id;

  document.getElementById("stat-modal-title").textContent = name ?? "";
  document.getElementById("stat-init").textContent = initiative ?? "N/A";
  document.getElementById("stat-ac").textContent = ac ?? "N/A";
  document.getElementById("stat-hp").textContent = health ?? "N/A";

  const link = document.getElementById("stat-url");
  if (url) {
    link.style.display = "";
    link.href = url;
  } else {
    link.style.display = "none";
    link.removeAttribute("href");
  }

  setStatCountdownDisplay({
    remaining: countdownRemaining,
    active: countdownActive,
    ended: countdownEnded
  });

  const healInput = document.getElementById("stat-heal-amount");
  if (healInput) healInput.value = "";

  modal.setAttribute("aria-hidden", "false");
}

function closeStatModal() {
  document.getElementById("stat-modal")?.setAttribute("aria-hidden", "true");
}

function openHpModal(entryId, currentHp, name) {
  currentHpEntryId = entryId;

  const modal = document.getElementById("hp-modal");
  if (!modal) return;

  const input = document.getElementById("hp-set-amount");
  if (input) {
    input.value = currentHp ?? "";
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  const title = document.getElementById("hp-modal-title");
  if (title) title.textContent = `Set HP: ${name ?? "Entry"}`;

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

function closeEffectDescriptionModal() {
  document.getElementById("effect-description-modal")?.setAttribute("aria-hidden", "true");
}

function openEffectDescriptionModal(effect) {
  const modal = document.getElementById("effect-description-modal");
  if (!modal) return;

  document.getElementById("effect-description-title").textContent = effect.name || "Effect";
  document.getElementById("effect-description-body").textContent =
    effect.description || effect.type || effect.url || "No description available.";

  modal.setAttribute("aria-hidden", "false");
}

function openEffectsModal(entryId, effects, titleText = "Effects") {
  const modal = document.getElementById("effects-modal");
  const list = document.getElementById("effects-modal-list");
  const title = document.getElementById("effects-modal-title");
  if (!modal || !list) return;

  list.innerHTML = "";
  if (title) title.textContent = titleText;

  const normalized = normalizeEffects(effects);

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
      leftButton.addEventListener("click", () => openEffectDescriptionModal(effect));

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "remove-button";
      removeBtn.style.marginTop = "0";
      removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = sanitizeEffectKey(effect.name);
        try {
          await remove(ref(db, `${getEntriesPath()}/${entryId}/effects/${key}`));
        } catch (error) {
          console.error("Error removing effect:", error);
        }
      });

      row.appendChild(leftButton);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  modal.setAttribute("aria-hidden", "false");
}

function openEffectPickerModal() {
  if (!currentStatEntryId) return;

  const modal = document.getElementById("effect-picker-modal");
  const list = document.getElementById("effect-picker-list");
  if (!modal || !list) return;

  list.innerHTML = "";

  const entry = latestEntries[currentStatEntryId];
  const existing = new Set(normalizeEffects(entry?.effects).map((effect) => effect.name));

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

    addBtn.addEventListener("click", async () => {
      try {
        const key = sanitizeEffectKey(effect.name);
        await update(ref(db, `${getEntriesPath()}/${currentStatEntryId}/effects`), {
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

    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function updateCountdownBadge(row, state) {
  const nameCol = row.querySelector(".name");
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

function renderEffectsPreview(entryId, entry, listItem) {
  const effectArray = normalizeEffects(entry.effects);
  if (!effectArray.length) return;

  const preview = document.createElement("div");
  preview.className = "effects-preview";
  preview.style.display = "flex";
  preview.style.alignItems = "center";
  preview.style.gap = "8px";
  preview.style.flexWrap = "wrap";
  preview.style.margin = "8px 0 4px";

  effectArray.forEach((effect) => {
    const iconButton = document.createElement("button");
    iconButton.type = "button";
    iconButton.style.border = "0";
    iconButton.style.background = "transparent";
    iconButton.style.padding = "0";
    iconButton.style.cursor = "pointer";
    iconButton.title = effect.name || "Effect";
    iconButton.setAttribute("aria-label", effect.name || "Effect");
    iconButton.addEventListener("click", () => openEffectDescriptionModal(effect));

    const icon = document.createElement("img");
    icon.src = effect.icon || "icons/effects/test.png";
    icon.alt = effect.name || "Effect";
    icon.style.width = "28px";
    icon.style.height = "28px";
    icon.style.objectFit = "cover";
    icon.style.borderRadius = "6px";

    iconButton.appendChild(icon);
    preview.appendChild(iconButton);
  });

  const effectsButton = document.createElement("button");
  effectsButton.textContent = "Effects";
  effectsButton.className = "effects-button";
  effectsButton.addEventListener("click", () =>
    openEffectsModal(entryId, effectArray, `${entry.name || "Entry"} Effects`)
  );
  preview.appendChild(effectsButton);

  listItem.appendChild(preview);
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

      const nameAcContainer = document.createElement("div");
      nameAcContainer.className = "name-ac-container";

      const nameDiv = document.createElement("div");
      nameDiv.className = "name";
      nameDiv.textContent = entry.name ?? entry.playerName ?? "Unknown";
      nameDiv.addEventListener("click", () => {
        const state = getCountdownState(id);
        openStatModal({
          id,
          name: entry.name ?? entry.playerName ?? "Unknown",
          ac: entry.ac,
          health: entry.health,
          url: entry.url,
          initiative: entry.initiative ?? entry.number,
          countdownRemaining: state.remaining,
          countdownActive: state.active,
          countdownEnded: state.ended
        });
      });

      const acDiv = document.createElement("div");
      acDiv.className = "ac";
      acDiv.textContent = `AC: ${entry.ac ?? "N/A"}`;

      nameAcContainer.appendChild(nameDiv);
      nameAcContainer.appendChild(acDiv);
      listItem.appendChild(nameAcContainer);

      const healthDiv = document.createElement("div");
      healthDiv.className = "health";
      healthDiv.textContent = `HP: ${entry.health ?? "N/A"}`;
      healthDiv.addEventListener("click", () =>
        openHpModal(id, entry.health ?? "", entry.name ?? "Entry")
      );
      listItem.appendChild(healthDiv);

      renderEffectsPreview(id, entry, listItem);

      const addEffectBtn = document.createElement("button");
      addEffectBtn.type = "button";
      addEffectBtn.textContent = "Effect";
      addEffectBtn.className = "remove-button";
      addEffectBtn.style.marginTop = "0";
      addEffectBtn.addEventListener("click", () => {
        currentStatEntryId = id;
        openEffectPickerModal();
      });
      listItem.appendChild(addEffectBtn);

      const healthInput = document.createElement("input");
      healthInput.type = "number";
      healthInput.placeholder = "Damage";
      healthInput.className = "damage-input";
      healthInput.dataset.entryId = id;
      healthInput.dataset.currentHealth = entry.health ?? 0;
      healthInput.style.width = "60px";

      healthInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;

        const damage = parseInt(healthInput.value, 10);
        if (isNaN(damage)) return;

        const currentHealth = parseInt(healthInput.dataset.currentHealth, 10) || 0;
        const updatedHealth = Math.max(currentHealth - damage, 0);
        updateHealth(id, updatedHealth, healthInput);
        healthInput.value = "";
      });

      listItem.appendChild(healthInput);

      const initiativeDiv = document.createElement("div");
      initiativeDiv.className = "initiative";
      initiativeDiv.textContent = `Init: ${entry.initiative ?? entry.number ?? "N/A"}`;
      listItem.appendChild(initiativeDiv);

      if ((entry.health ?? 0) <= 0) {
        listItem.classList.add("defeated");
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.className = "remove-button";
        removeButton.addEventListener("click", () => removeEntry(id));
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

      healthInput.dataset.currentHealth = newHealth;

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

    const currentHealth = parseInt(input.dataset.currentHealth, 10) || 0;
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
    })
    .catch((error) => {
      console.error("Error clearing list:", error);
    });
}

function removeEntry(id) {
  remove(ref(db, `${getEntriesPath()}/${id}`))
    .catch((error) => {
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

onReady(() => {
  document.getElementById("stat-modal-close")?.addEventListener("click", closeStatModal);
  document.getElementById("stat-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "stat-modal") closeStatModal();
  });

  document.getElementById("hp-modal-close")?.addEventListener("click", closeHpModal);
  document.getElementById("hp-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "hp-modal") closeHpModal();
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
    if (e.key !== "Escape") return;
    closeStatModal();
    closeHpModal();
    closeEffectPickerModal();
    closeEffectsModal();
    closeEffectDescriptionModal();
  });

  document.getElementById("stat-delete")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;
    removeEntry(currentStatEntryId);
    closeStatModal();
  });

  document.getElementById("hp-set-button")?.addEventListener("click", () => {
    if (!currentHpEntryId) return;

    const value = parseInt(document.getElementById("hp-set-amount")?.value, 10);
    if (isNaN(value)) return;

    const input = getHealthInputForEntry(currentHpEntryId);
    if (input) updateHealth(currentHpEntryId, value, input);

    closeHpModal();
  });

  document.getElementById("stat-heal")?.addEventListener("click", () => {
    if (!currentStatEntryId) return;

    const healAmount = parseInt(document.getElementById("stat-heal-amount")?.value, 10);
    if (isNaN(healAmount)) return;

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

  document.getElementById("stat-add-effect")?.addEventListener("click", openEffectPickerModal);

  requireAuth().then(() => {
    fetchRankings();

    document.getElementById("apply-damage-button")?.addEventListener("click", applyDamageToAll);
    document.getElementById("clear-list-button")?.addEventListener("click", clearList);
  });
});