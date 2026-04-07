import { db } from "./firebase-config.js";
import { ref, update, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { EFFECTS } from "./effects.js";

let currentEntryId = null;

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

function sanitizeEffectKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function openModal(modal) {
  if (modal) modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (modal) modal.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeModal(qs("stat-modal"));
  closeModal(qs("hp-modal"));
  closeModal(qs("effect-picker-modal"));
  closeModal(qs("effects-modal"));
}

function getEffectsFromRow(row) {
  try {
    return JSON.parse(row.dataset.effects || "[]");
  } catch {
    return [];
  }
}

function setEffectsOnRow(row, effects) {
  row.dataset.effects = JSON.stringify(effects || []);
}

function createEffectIcon(effect) {
  const icon = document.createElement("img");
  icon.className = "effect-row-icon";
  icon.src = effect.icon || "icons/effects/test.png";
  icon.alt = effect.name || "Effect";
  icon.title = effect.name || "Effect";
  icon.width = 22;
  icon.height = 22;

  if (effect.url) {
    icon.style.cursor = "pointer";
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open(effect.url, "_blank", "noopener");
    });
  }

  return icon;
}

function renderEffectsSummary(row) {
  const container = row.querySelector(".row-effects");
  if (!container) return;

  const effects = getEffectsFromRow(row);
  container.innerHTML = "";

  if (!effects.length) return;

  const iconsWrap = document.createElement("div");
  iconsWrap.className = "effects-summary-icons";

  effects.forEach((effect) => {
    iconsWrap.appendChild(createEffectIcon(effect));
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "effects-button";
  button.textContent = "Effects";
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    currentEntryId = row.dataset.entryId || null;
    renderEffectsModal(row);
    openModal(qs("effects-modal"));
  });

  container.appendChild(iconsWrap);
  container.appendChild(button);
}

function fillStatModalFromRow(row) {
  currentEntryId = row.dataset.entryId || null;

  const name =
    row.dataset.name || row.querySelector(".name")?.textContent?.trim() || "Unknown";
  const initiative = row.dataset.initiative || "N/A";
  const ac =
    row.dataset.ac ||
    row.querySelector(".ac")?.textContent?.replace(/^AC:\s*/, "") ||
    "N/A";
  const hp =
    row.dataset.health ||
    row.querySelector(".health")?.textContent?.replace(/^HP:\s*/, "") ||
    "N/A";
  const url = row.dataset.url || "";

  if (qs("stat-modal-title")) qs("stat-modal-title").textContent = name;
  if (qs("stat-init")) qs("stat-init").textContent = initiative;
  if (qs("stat-ac")) qs("stat-ac").textContent = ac;
  if (qs("stat-hp")) qs("stat-hp").textContent = hp;

  const link = qs("stat-url");
  if (link) {
    if (url) {
      link.href = url;
      link.style.display = "";
    } else {
      link.removeAttribute("href");
      link.style.display = "none";
    }
  }

  if (qs("stat-heal-amount")) qs("stat-heal-amount").value = "";
  renderEffectsModal(row);
}

function fillHpModalFromRow(row) {
  currentEntryId = row.dataset.entryId || null;

  const name =
    row.dataset.name || row.querySelector(".name")?.textContent?.trim() || "Unknown";
  const hp =
    row.dataset.health ||
    row.querySelector(".health")?.textContent?.replace(/^HP:\s*/, "") ||
    "";

  if (qs("hp-modal-title")) qs("hp-modal-title").textContent = `${name} HP`;
  if (qs("hp-set-amount")) qs("hp-set-amount").value = hp === "N/A" ? "" : hp;
}

function bindCloseBehavior(modalId, closeId) {
  const modal = qs(modalId);
  if (!modal) return;

  qs(closeId)?.addEventListener("click", () => closeModal(modal));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

function findRow(entryId) {
  return document.querySelector(`li[data-entry-id="${entryId}"]`);
}

async function healCurrentEntry() {
  if (!currentEntryId) return;

  const row = findRow(currentEntryId);
  const input = qs("stat-heal-amount");
  if (!row || !input) return;

  const amount = parseInt(input.value, 10);
  if (Number.isNaN(amount) || amount <= 0) return;

  const currentHealth = row.dataset.health === "N/A" ? 0 : parseInt(row.dataset.health, 10);
  const nextHealth = (Number.isNaN(currentHealth) ? 0 : currentHealth) + amount;

  await update(ref(db, `${getEntriesPath()}/${currentEntryId}`), { health: nextHealth });

  row.dataset.health = String(nextHealth);
  row.querySelector(".health").textContent = `HP: ${nextHealth}`;
  if (qs("stat-hp")) qs("stat-hp").textContent = String(nextHealth);
  input.value = "";
}

async function setCurrentEntryHp() {
  if (!currentEntryId) return;

  const row = findRow(currentEntryId);
  const input = qs("hp-set-amount");
  if (!row || !input) return;

  const amount = parseInt(input.value, 10);
  if (Number.isNaN(amount) || amount < 0) return;

  await update(ref(db, `${getEntriesPath()}/${currentEntryId}`), { health: amount });

  row.dataset.health = String(amount);
  row.querySelector(".health").textContent = `HP: ${amount}`;
  if (qs("stat-hp")) qs("stat-hp").textContent = String(amount);

  closeModal(qs("hp-modal"));
}

async function deleteCurrentEntry() {
  if (!currentEntryId) return;
  if (!confirm("Delete this entry from the list?")) return;

  await remove(ref(db, `${getEntriesPath()}/${currentEntryId}`));
  closeAllModals();
  currentEntryId = null;
}

function renderEffectsModal(row) {
  const list = qs("effects-modal-list");
  if (!list) return;

  const effects = getEffectsFromRow(row);
  list.innerHTML = "";

  if (!effects.length) {
    const p = document.createElement("p");
    p.textContent = "No effects added.";
    list.appendChild(p);
    return;
  }

  effects.forEach((effect) => {
    const rowEl = document.createElement("div");
    rowEl.className = "effect-picker-row";

    const left = document.createElement("div");
    left.className = "effect-picker-left";

    const icon = document.createElement("img");
    icon.className = "effect-icon";
    icon.src = effect.icon || "icons/effects/test.png";
    icon.alt = effect.name || "Effect";
    icon.width = 24;
    icon.height = 24;

    const name = document.createElement("span");
    name.textContent = effect.name || "Unknown";

    left.appendChild(icon);
    left.appendChild(name);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-button";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      const entryRow = findRow(currentEntryId);
      if (!entryRow) return;

      const currentEffects = getEffectsFromRow(entryRow);
      const nextEffects = currentEffects.filter((e) => e.name !== effect.name);

      setEffectsOnRow(entryRow, nextEffects);
      renderEffectsSummary(entryRow);
      renderEffectsModal(entryRow);

      await remove(
        ref(
          db,
          `${getEntriesPath()}/${currentEntryId}/effects/${sanitizeEffectKey(effect.name)}`
        )
      );
    });

    rowEl.appendChild(left);
    rowEl.appendChild(removeBtn);
    list.appendChild(rowEl);
  });
}

function renderEffectPicker() {
  const list = qs("effect-picker-list");
  if (!list) return;

  const row = findRow(currentEntryId);
  if (!row) return;

  const currentEffects = getEffectsFromRow(row);
  const currentNames = new Set(currentEffects.map((e) => e.name));

  list.innerHTML = "";

  EFFECTS.forEach((effect) => {
    const rowEl = document.createElement("div");
    rowEl.className = "effect-picker-row";

    const left = document.createElement("div");
    left.className = "effect-picker-left";

    const icon = document.createElement("img");
    icon.className = "effect-icon";
    icon.src = effect.icon || "icons/effects/test.png";
    icon.alt = effect.name || "Effect";
    icon.width = 24;
    icon.height = 24;

    const name = document.createElement("span");
    name.textContent = effect.name;

    left.appendChild(icon);
    left.appendChild(name);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "remove-button";
    addBtn.textContent = currentNames.has(effect.name) ? "Added" : "Add";
    addBtn.disabled = currentNames.has(effect.name);

    addBtn.addEventListener("click", async () => {
      const entryRow = findRow(currentEntryId);
      if (!entryRow) return;

      const nextEffect = {
        name: effect.name,
        type: effect.type || "",
        url: effect.url || "",
        icon: effect.icon || "icons/effects/test.png",
        description: effect.description || "",
      };

      const key = sanitizeEffectKey(effect.name);

      await update(ref(db, `${getEntriesPath()}/${currentEntryId}/effects`), {
        [key]: nextEffect,
      });

      const updatedEffects = [...getEffectsFromRow(entryRow), nextEffect];
      setEffectsOnRow(entryRow, updatedEffects);
      renderEffectsSummary(entryRow);
      renderEffectsModal(entryRow);
      renderEffectPicker();
    });

    rowEl.appendChild(left);
    rowEl.appendChild(addBtn);
    list.appendChild(rowEl);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const rankingList = qs("rankingList");

  bindCloseBehavior("stat-modal", "stat-modal-close");
  bindCloseBehavior("hp-modal", "hp-modal-close");
  bindCloseBehavior("effect-picker-modal", "effect-picker-close");
  bindCloseBehavior("effects-modal", "effects-modal-close");

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  rankingList?.addEventListener("click", (e) => {
    const nameEl = e.target.closest(".name");
    if (nameEl) {
      const row = nameEl.closest("li");
      if (!row) return;
      fillStatModalFromRow(row);
      openModal(qs("stat-modal"));
      return;
    }

    const healthEl = e.target.closest(".health");
    if (healthEl) {
      const row = healthEl.closest("li");
      if (!row) return;
      fillHpModalFromRow(row);
      openModal(qs("hp-modal"));
      return;
    }

    const effectsEl = e.target.closest(".effects-button");
    if (effectsEl) {
      const row = effectsEl.closest("li");
      if (!row) return;

      currentEntryId = row.dataset.entryId || null;
      renderEffectsModal(row);
      openModal(qs("effects-modal"));
      return;
    }
  });

  qs("stat-heal")?.addEventListener("click", healCurrentEntry);
  qs("hp-set-button")?.addEventListener("click", setCurrentEntryHp);
  qs("stat-delete")?.addEventListener("click", deleteCurrentEntry);

  qs("stat-add-effect")?.addEventListener("click", () => {
    if (!currentEntryId) return;
    renderEffectPicker();
    openModal(qs("effect-picker-modal"));
  });

  qs("hp-set-amount")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setCurrentEntryHp();
    }
  });
});