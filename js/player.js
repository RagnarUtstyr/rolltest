import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { watchOrLoadGame } from "./game-service.js";
import { BANES } from "./banes.js";
import { OPENLEGEND_BANES } from "./openlegend_banes.js";
import { EFFECTS } from "./effects.js";
import { OPENLEGEND_FEATS } from "./openlegend_feats.js";
import { findOpenLegendWeaponPreset, getOpenLegendAttributeDie, composeOpenLegendWeaponDamage } from "./openlegend_weapons.js";
import {
  ref,
  get,
  set
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").toUpperCase();

const metaEl = document.getElementById("player-game-meta");
const statusEl = document.getElementById("player-status");
const saveInitiativeBtn = document.getElementById("save-initiative-button");

const initiativeSoundMap = {
  low: "./sounds/initiative-0-5.mp3",
  midLow: "./sounds/initiative-6-10.mp3",
  mid: "./sounds/initiative-11-15.mp3",
  high: "./sounds/initiative-16-20.mp3",
  epic: "./sounds/initiative-21-plus.mp3"
};

let currentInitiativeAudio = null;

function getInitiativeSoundKey(value) {
  const num = Number(value);

  if (Number.isNaN(num)) return null;
  if (num <= 5) return "low";
  if (num <= 10) return "midLow";
  if (num <= 15) return "mid";
  if (num <= 20) return "high";
  return "epic";
}

function getInitiativeSoundPath(value) {
  const key = getInitiativeSoundKey(value);
  return key ? initiativeSoundMap[key] : null;
}

function playInitiativeSound(value) {
  const soundPath = getInitiativeSoundPath(value);
  if (!soundPath) return;

  try {
    if (currentInitiativeAudio) {
      currentInitiativeAudio.pause();
      currentInitiativeAudio.currentTime = 0;
    }

    currentInitiativeAudio = new Audio(soundPath);
    currentInitiativeAudio.play().catch((error) => {
      console.warn("Could not play initiative sound:", error);
    });
  } catch (error) {
    console.warn("Initiative sound failed:", error);
  }
}

const dndSection = document.getElementById("player-dnd-section");
const olSection = document.getElementById("player-openlegend-section");

const dndBuilderLink = document.getElementById("dnd-builder-link");
const openLegendBuilderLink = document.getElementById("openlegend-builder-link");

const trackerListEl = document.getElementById("tracker-list");
const trackerEmptyEl = document.getElementById("tracker-empty");
const playerBanesPanel = document.getElementById("player-banes-panel");
const playerBanesPreviewEl = document.getElementById("player-banes-preview");
const playerEffectsPanel = document.getElementById("player-effects-panel");
const playerEffectsPreviewEl = document.getElementById("player-effects-preview");
const playerFeatsPanel = document.getElementById("player-feats-panel");
const playerFeatsPreviewEl = document.getElementById("player-feats-preview");
const playerFeatModal = document.getElementById("player-feat-modal");
const playerFeatModalContent = document.getElementById("player-feat-modal-content");
const playerFeatModalClose = document.getElementById("player-feat-modal-close");
const playerWeaponsPanel = document.getElementById("player-weapons-panel");
const playerWeaponsPreviewEl = document.getElementById("player-weapons-preview");
const playerWeaponModal = document.getElementById("player-weapon-modal");
const playerWeaponModalContent = document.getElementById("player-weapon-modal-content");
const playerWeaponModalClose = document.getElementById("player-weapon-modal-close");
const baneDetailModal = document.getElementById("bane-detail-modal");
const baneDetailContent = document.getElementById("bane-detail-content");
const baneDetailClose = document.getElementById("bane-detail-close");

const user = await requireAuth();

if (!code) {
  statusEl.textContent = "Missing game code.";
  throw new Error("Missing game code.");
}

const game = await watchOrLoadGame(code);
if (!game) {
  statusEl.textContent = "Game not found.";
  throw new Error("Game not found.");
}

const mode = String(game.mode || "").toLowerCase();

function applyModeStyles(currentMode) {
  const dndStyle = document.getElementById("player-dnd-style");
  const olStyle = document.getElementById("player-ol-style");

  if (!dndStyle || !olStyle) return;

  dndStyle.disabled = true;
  olStyle.disabled = true;

  if (currentMode === "dnd") {
    dndStyle.disabled = false;
  } else if (
    currentMode === "openlegend" ||
    currentMode === "ol" ||
    currentMode === "open_legend"
  ) {
    olStyle.disabled = false;
  }
}

applyModeStyles(mode);

metaEl.innerHTML = `
  <div><strong>${game.title}</strong></div>
  <div class="muted">Code: ${game.code} · ${game.mode} · Admin: ${game.ownerName}</div>
`;

if (mode === "dnd") {
  dndSection.classList.remove("hidden");
  playerEffectsPanel?.classList.remove("hidden");

  if (dndBuilderLink) {
    dndBuilderLink.href = `dnd_character_builder_firebase.html?code=${encodeURIComponent(code)}`;
  }
} else if (
  mode === "openlegend" ||
  mode === "ol" ||
  mode === "open_legend"
) {
  olSection.classList.remove("hidden");

  if (openLegendBuilderLink) {
    openLegendBuilderLink.href = `openlegend_character_builder.html?code=${encodeURIComponent(code)}`;
  }

  playerBanesPanel?.classList.remove("hidden");
  playerFeatsPanel?.classList.remove("hidden");
} else {
  statusEl.textContent = `Unsupported game mode: ${game.mode}`;
  throw new Error(`Unsupported game mode: ${game.mode}`);
}

function playerSheetPath() {
  return `games/${code}/players/${user.uid}`;
}

function playerEntryPath() {
  return `games/${code}/entries/${user.uid}`;
}

function dndBuilderSheetPath() {
  return `games/${code}/builderSheetsDnd/${user.uid}`;
}

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumber(value, fallback = 0) {
  const parsed = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function makeId() {
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

function sanitizeBaneKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function sanitizeEffectKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function normalizeBanes(banes) {
  if (!banes) return [];
  if (Array.isArray(banes)) return banes.filter(Boolean);
  return Object.values(banes).filter(Boolean);
}

function normalizeEffects(effects) {
  if (!effects) return [];
  if (Array.isArray(effects)) return effects.filter(Boolean);
  return Object.values(effects).filter(Boolean);
}

function getCurrentSheetCache() {
  return window.__playerSheetCache || null;
}

function setCurrentSheetCache(data) {
  window.__playerSheetCache = data || null;
  renderPlayerFeats(Array.isArray(data?.feats) ? data.feats : []);
  renderPlayerWeapons(Array.isArray(data?.weapons) ? data.weapons : []);
}

function getCurrentBanes() {
  return normalizeBanes(getCurrentSheetCache()?.banes);
}

function getCurrentEffects() {
  return normalizeEffects(getCurrentSheetCache()?.effects);
}

function setPlayerBanes(banes) {
  const safeBanes = normalizeBanes(banes);
  const existing = getCurrentSheetCache() || {};
  setCurrentSheetCache({ ...existing, banes: safeBanes });
  renderPlayerBanes(safeBanes);
}

function setPlayerEffects(effects) {
  const safeEffects = normalizeEffects(effects);
  const existing = getCurrentSheetCache() || {};
  setCurrentSheetCache({ ...existing, effects: safeEffects });
  renderPlayerEffects(safeEffects);
}

function renderPlayerBanes(banes = []) {
  if (!playerBanesPreviewEl) return;

  const safeBanes = normalizeBanes(banes);
  if (!safeBanes.length) {
    playerBanesPreviewEl.innerHTML = '<span class="muted player-banes-empty">No banes added.</span>';
    return;
  }

  playerBanesPreviewEl.innerHTML = "";
  safeBanes.slice(0, 4).forEach((bane) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "player-bane-chip";
    chip.title = bane.name || "Bane";
    chip.innerHTML = `
      <img src="${bane.icon || "../icons/banes/test.png"}" alt="${bane.name || "Bane"}">
      <span>${bane.name || "Unknown"}</span>
    `;
    chip.addEventListener("click", () => {
      openBaneDetailModal(bane);
    });
    playerBanesPreviewEl.appendChild(chip);
  });

  if (safeBanes.length > 4) {
    const more = document.createElement("span");
    more.className = "muted";
    more.textContent = `+${safeBanes.length - 4} more`;
    playerBanesPreviewEl.appendChild(more);
  }
}

function renderPlayerEffects(effects = []) {
  if (!playerEffectsPreviewEl) return;

  const safeEffects = normalizeEffects(effects);
  if (!safeEffects.length) {
    playerEffectsPreviewEl.innerHTML = '<span class="muted player-banes-empty">No effects added.</span>';
    return;
  }

  playerEffectsPreviewEl.innerHTML = "";
  safeEffects.slice(0, 4).forEach((effect) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "player-bane-chip";
    chip.title = effect.name || "Effect";
    chip.innerHTML = `
      <img src="${effect.icon || "icons/effects/test.png"}" alt="${effect.name || "Effect"}">
      <span>${effect.name || "Unknown"}</span>
    `;
    chip.addEventListener("click", () => {
      openEffectDescriptionModal(effect);
    });
    playerEffectsPreviewEl.appendChild(chip);
  });

  if (safeEffects.length > 4) {
    const more = document.createElement("span");
    more.className = "muted";
    more.textContent = `+${safeEffects.length - 4} more`;
    playerEffectsPreviewEl.appendChild(more);
  }
}

function findFeatEntry(name) {
  return OPENLEGEND_FEATS.find((feat) => feat.name === name) || null;
}

function getWeaponComputedDamage(weapon = {}) {
  const score = getCurrentSheetCache()?.attributes?.[weapon.attribute] ?? 0;
  return composeOpenLegendWeaponDamage({
    attributeDie: getOpenLegendAttributeDie(score),
    bonusDice: weapon.bonusDice,
    flatBonus: weapon.flatBonus,
    customDamage: weapon.customDamage || ""
  });
}

function renderPlayerWeapons(weapons = []) {
  if (!playerWeaponsPreviewEl) return;

  const safeWeapons = Array.isArray(weapons) ? weapons.filter(Boolean) : [];
  if (!safeWeapons.length) {
    playerWeaponsPreviewEl.innerHTML = '<span class="muted player-banes-empty">No weapons added.</span>';
    return;
  }

  playerWeaponsPreviewEl.innerHTML = "";
  safeWeapons.slice(0, 6).forEach((weapon) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "player-bane-chip";
    chip.title = weapon.name || "Weapon";
    chip.innerHTML = `<span>${weapon.name || "Weapon"}</span>`;
    chip.addEventListener("click", () => openPlayerWeaponModal(weapon));
    playerWeaponsPreviewEl.appendChild(chip);
  });

  if (safeWeapons.length > 6) {
    const more = document.createElement("span");
    more.className = "muted";
    more.textContent = `+${safeWeapons.length - 6} more`;
    playerWeaponsPreviewEl.appendChild(more);
  }
}

function openPlayerWeaponModal(weapon) {
  if (!playerWeaponModal || !playerWeaponModalContent || !weapon) return;
  const preset = findOpenLegendWeaponPreset(weapon.presetKey || weapon.name);
  const score = Number(getCurrentSheetCache()?.attributes?.[weapon.attribute] || 0);
  const die = getOpenLegendAttributeDie(score);
  const damage = getWeaponComputedDamage(weapon);

  playerWeaponModalContent.innerHTML = `
    <h2>${weapon.name || "Weapon"}</h2>
    <p><strong>Damage:</strong> ${damage || '—'} &nbsp; <strong>Attack:</strong> ${weapon.attribute || '—'} (${die || '—'}) &nbsp; <strong>VS:</strong> ${weapon.vs || 'GRD'}</p>
    <div class="formula-list">
      <div class="formula-row"><span>Category</span><span>${preset?.category || 'Custom'}</span></div>
      <div class="formula-row"><span>Range</span><span>${weapon.range || '—'}</span></div>
      <div class="formula-row"><span>Boon</span><span>${Number(weapon.boon || 0)}</span></div>
      <div class="formula-row"><span>Bane</span><span>${Number(weapon.bane || 0)}</span></div>
      <div class="formula-row"><span>Tags</span><span>${weapon.tags || '—'}</span></div>
    </div>
    <h3>Notes</h3>
    <div>${weapon.notes || '—'}</div>
  `;
  playerWeaponModal.setAttribute("aria-hidden", "false");
}

function closePlayerWeaponModal() {
  if (playerWeaponModal) playerWeaponModal.setAttribute("aria-hidden", "true");
}

function renderPlayerFeats(feats = []) {
  if (!playerFeatsPreviewEl) return;

  const safeFeats = Array.isArray(feats) ? feats.filter(Boolean) : [];
  if (!safeFeats.length) {
    playerFeatsPreviewEl.innerHTML = '<span class="muted player-banes-empty">No feats added.</span>';
    return;
  }

  playerFeatsPreviewEl.innerHTML = "";
  safeFeats.slice(0, 6).forEach((feat) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "player-bane-chip";
    const entry = findFeatEntry(feat.key || feat.name);
    const level = Number(feat.level || 1);
    chip.title = feat.name || feat.key || "Feat";
    chip.innerHTML = `<span>${feat.name || feat.key || "Feat"}${entry && entry.maxLevel > 1 ? ` Lv ${level}` : ""}</span>`;
    chip.addEventListener("click", () => openPlayerFeatModal(feat));
    playerFeatsPreviewEl.appendChild(chip);
  });

  if (safeFeats.length > 6) {
    const more = document.createElement("span");
    more.className = "muted";
    more.textContent = `+${safeFeats.length - 6} more`;
    playerFeatsPreviewEl.appendChild(more);
  }
}

function openPlayerFeatModal(feat) {
  if (!playerFeatModal || !playerFeatModalContent) return;
  const entry = findFeatEntry(feat?.key || feat?.name);
  if (!entry) return;

  const level = Number(feat.level || 1);
  const tiers = (entry.tiers || []).map((tier) => `
    <div class="formula-row">
      <span>Tier ${tier.level}</span>
      <span>${tier.text || "None"}</span>
    </div>
  `).join("");

  playerFeatModalContent.innerHTML = `
    <h2>${entry.name}</h2>
    <p><strong>Level:</strong> ${level}/${entry.maxLevel} &nbsp; <strong>Total Cost:</strong> ${entry.costPerLevel * level}</p>
    <h3>Description</h3>
    <div>${entry.descriptionHtml || entry.description || "—"}</div>
    <h3>Prerequisites</h3>
    <div class="formula-list">${tiers || '<div class="formula-row"><span>Tier 1</span><span>None</span></div>'}</div>
    <h3>Effect</h3>
    <div>${entry.effectHtml || "—"}</div>
    ${entry.specialHtml ? `<h3>Special</h3><div>${entry.specialHtml}</div>` : ""}
  `;
  playerFeatModal.setAttribute("aria-hidden", "false");
}

function closePlayerFeatModal() {
  if (playerFeatModal) playerFeatModal.setAttribute("aria-hidden", "true");
}



function findBaneEntry(nameOrSlug) {
  const key = String(nameOrSlug || "").trim().toLowerCase();
  if (!key) return null;
  return OPENLEGEND_BANES.find((bane) => {
    return String(bane.name || "").trim().toLowerCase() === key
      || String(bane.slug || "").trim().toLowerCase() === key
      || String(bane.id || "").trim().toLowerCase() === key;
  }) || null;
}

function buildBaneDetailHtml(bane) {
  const entry = findBaneEntry(bane?.name || bane?.slug || bane?.id) || bane || {};
  const title = entry.displayTitle || entry.name || bane?.name || "Bane";
  const description = entry.descriptionHtml || entry.description || entry.summary || "No description available.";
  const effect = entry.effectHtml || entry.effect || "";
  const icon = entry.icon || bane?.icon || "../icons/banes/test.png";
  const url = entry.url || bane?.url || "";

  return `
    <div class="bane-detail-header">
      <img src="${icon}" alt="${title}">
      <div>
        <h3 id="bane-detail-title">${title}</h3>
        <div class="muted">Open Legend bane reference</div>
      </div>
    </div>
    <div class="bane-detail-section">
      <h4>Description</h4>
      <div>${description}</div>
    </div>
    ${effect ? `<div class="bane-detail-section"><h4>Effect</h4><div>${effect}</div></div>` : ""}
    ${url ? `<div class="bane-detail-actions"><a class="button-link" href="${url}" target="_blank" rel="noopener">Official page</a></div>` : ""}
  `;
}

function openBaneDetailModal(bane) {
  if (!baneDetailModal || !baneDetailContent || !bane) return;
  baneDetailContent.innerHTML = buildBaneDetailHtml(bane);
  baneDetailModal.setAttribute("aria-hidden", "false");
}

function closeBaneDetailModal() {
  baneDetailModal?.setAttribute("aria-hidden", "true");
}

function closeBanePickerModal() {
  document.getElementById("bane-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeBanesModal() {
  document.getElementById("banes-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectPickerModal() {
  document.getElementById("effect-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeEffectsModal() {
  document.getElementById("effects-modal")?.setAttribute("aria-hidden", "true");
}

function openBanePickerModal() {
  if (mode !== "openlegend" && mode !== "ol" && mode !== "open_legend") return;

  const modal = document.getElementById("bane-picker-modal");
  const list = document.getElementById("bane-picker-list");
  if (!modal || !list) return;

  const selectedNames = new Set(getCurrentBanes().map((bane) => bane.name));
  list.innerHTML = "";

  BANES.forEach((bane) => {
    const row = document.createElement("div");
    row.className = "bane-picker-row";

    const left = document.createElement("button");
    left.type = "button";
    left.className = "bane-picker-open";
    left.addEventListener("click", () => {
      openBaneDetailModal(bane);
    });

    const inner = document.createElement("div");
    inner.className = "bane-picker-left";

    const icon = document.createElement("img");
    icon.className = "bane-icon";
    icon.src = bane.icon || "../icons/banes/test.png";
    icon.alt = bane.name || "Bane";

    const name = document.createElement("span");
    name.textContent = bane.name || "Unknown";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = selectedNames.has(bane.name) ? "Added" : "Add";
    addBtn.className = "bane-picker-add-btn";
    addBtn.disabled = selectedNames.has(bane.name);
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await addPlayerBane(bane);
      openBanePickerModal();
    });

    inner.appendChild(icon);
    inner.appendChild(name);
    left.appendChild(inner);
    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function openBanesModal() {
  const modal = document.getElementById("banes-modal");
  const list = document.getElementById("banes-modal-list");
  if (!modal || !list) return;

  const banes = getCurrentBanes();
  list.innerHTML = "";

  if (!banes.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No banes added.";
    list.appendChild(empty);
  } else {
    banes.forEach((bane) => {
      const row = document.createElement("div");
      row.className = "bane-picker-row";

      const leftButton = document.createElement("button");
      leftButton.type = "button";
      leftButton.className = "bane-picker-open";

      const left = document.createElement("div");
      left.className = "bane-picker-left";

      const icon = document.createElement("img");
      icon.className = "bane-icon";
      icon.src = bane.icon || "../icons/banes/test.png";
      icon.alt = bane.name || "Bane";

      const name = document.createElement("span");
      name.textContent = bane.name || "Unknown";

      left.appendChild(icon);
      left.appendChild(name);
      leftButton.appendChild(left);
      leftButton.addEventListener("click", () => {
        openBaneDetailModal(bane);
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "player-bane-remove-btn";
      removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await removePlayerBane(bane.name);
        openBanesModal();
      });

      row.appendChild(leftButton);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  modal.setAttribute("aria-hidden", "false");
}

function openEffectDescriptionModal(effect) {
  const modal = document.getElementById("effects-modal");
  const list = document.getElementById("effects-modal-list");
  const title = document.getElementById("effects-modal-title");
  if (!modal || !list) return;

  list.innerHTML = "";

  if (title) {
    title.textContent = effect?.name || "Effect";
  }

  const wrap = document.createElement("div");
  wrap.className = "bane-picker-row";
  wrap.style.display = "block";

  const header = document.createElement("div");
  header.className = "bane-picker-left";
  header.style.marginBottom = "12px";

  const icon = document.createElement("img");
  icon.className = "bane-icon";
  icon.src = effect?.icon || "icons/effects/test.png";
  icon.alt = effect?.name || "Effect";

  const name = document.createElement("strong");
  name.textContent = effect?.name || "Unknown";

  header.appendChild(icon);
  header.appendChild(name);

  const desc = document.createElement("p");
  desc.className = "muted";
  desc.style.margin = "0";
  desc.textContent = effect?.description || "No description available.";

  wrap.appendChild(header);
  wrap.appendChild(desc);
  list.appendChild(wrap);

  modal.setAttribute("aria-hidden", "false");
}

function openEffectPickerModal() {
  if (mode !== "dnd") return;

  const modal = document.getElementById("effect-picker-modal");
  const list = document.getElementById("effect-picker-list");
  if (!modal || !list) return;

  const selectedNames = new Set(getCurrentEffects().map((effect) => effect.name));
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

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = selectedNames.has(effect.name) ? "Added" : "Add";
    addBtn.className = "bane-picker-add-btn";
    addBtn.disabled = selectedNames.has(effect.name);
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await addPlayerEffect(effect);
      openEffectPickerModal();
    });

    inner.appendChild(icon);
    inner.appendChild(name);
    left.appendChild(inner);
    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function openEffectsModal() {
  const modal = document.getElementById("effects-modal");
  const list = document.getElementById("effects-modal-list");
  const title = document.getElementById("effects-modal-title");
  if (!modal || !list) return;

  if (title) {
    title.textContent = "Manage effects";
  }

  const effects = getCurrentEffects();
  list.innerHTML = "";

  if (!effects.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No effects added.";
    list.appendChild(empty);
  } else {
    effects.forEach((effect) => {
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
        openEffectDescriptionModal(effect);
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.className = "player-bane-remove-btn";
      removeBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await removePlayerEffect(effect.name);
        openEffectsModal();
      });

      row.appendChild(leftButton);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }

  modal.setAttribute("aria-hidden", "false");
}

async function persistPlayerBanes(banes, statusMessage = "Banes updated.") {
  const existing = (await getCurrentSheet()) || {};
  const payload = buildSheetPayload(existing);
  payload.banes = normalizeBanes(banes);
  payload.updatedAt = Date.now();

  await set(ref(db, playerSheetPath()), payload);
  setCurrentSheetCache(payload);
  renderPlayerBanes(payload.banes);
  statusEl.textContent = statusMessage;
}

async function persistPlayerEffects(effects, statusMessage = "Effects updated.") {
  const existing = (await getCurrentSheet()) || {};
  const payload = buildSheetPayload(existing);
  payload.effects = normalizeEffects(effects);
  payload.updatedAt = Date.now();

  await set(ref(db, playerSheetPath()), payload);
  setCurrentSheetCache(payload);
  renderPlayerEffects(payload.effects);
  statusEl.textContent = statusMessage;
}

async function addPlayerBane(bane) {
  const current = getCurrentBanes();
  if (current.some((item) => item?.name === bane.name)) return;

  await persistPlayerBanes([
    ...current,
    {
      name: bane.name,
      url: bane.url,
      icon: bane.icon || "../icons/banes/test.png",
      key: sanitizeBaneKey(bane.name)
    }
  ], `${bane.name} added.`);
}

async function removePlayerBane(baneName) {
  const current = getCurrentBanes();
  const next = current.filter((bane) => bane?.name !== baneName);
  await persistPlayerBanes(next, `${baneName} removed.`);
}

async function addPlayerEffect(effect) {
  const current = getCurrentEffects();
  if (current.some((item) => item?.name === effect.name)) return;

  await persistPlayerEffects(
    [
      ...current,
      {
        name: effect.name,
        url: effect.url || "",
        icon: effect.icon || "icons/effects/test.png",
        type: effect.type || "",
        description: effect.description || "",
        key: sanitizeEffectKey(effect.name)
      }
    ],
    `${effect.name} added.`
  );
}

async function removePlayerEffect(effectName) {
  const current = getCurrentEffects();
  const next = current.filter((effect) => effect?.name !== effectName);
  await persistPlayerEffects(next, `${effectName} removed.`);
}

function getSharedValues() {
  return {
    name: document.getElementById("player-name").value.trim(),
    initiative: numberOrNull(document.getElementById("player-initiative").value)
  };
}

function setSharedValues(data = {}) {
  document.getElementById("player-name").value =
    data.name ?? data.playerName ?? user.displayName ?? "";

  document.getElementById("player-initiative").value =
    data.initiative ?? data.initiativeBonus ?? data.number ?? "";
}

function getDndValues() {
  return {
    hp: numberOrNull(document.getElementById("player-hp").value),
    ac: numberOrNull(document.getElementById("player-ac").value),
    prof: numberOrNull(document.getElementById("player-prof").value),
    str: numberOrNull(document.getElementById("player-str").value),
    dex: numberOrNull(document.getElementById("player-dex").value),
    con: numberOrNull(document.getElementById("player-con").value),
    int: numberOrNull(document.getElementById("player-int").value),
    wis: numberOrNull(document.getElementById("player-wis").value),
    cha: numberOrNull(document.getElementById("player-cha").value),
    effects: getCurrentEffects()
  };
}

function mapDndFirebaseToPlayerValues(data = {}) {
  return {
    hp: data.hp ?? data.currentHp ?? data.health ?? data.baseHp ?? "",
    ac: data.ac ?? "",
    prof: data.prof ?? data.proficiencyBonus ?? "",
    str: data.str ?? data.strength ?? "",
    dex: data.dex ?? data.dexterity ?? "",
    con: data.con ?? data.constitution ?? "",
    int: data.int ?? data.intelligence ?? "",
    wis: data.wis ?? data.wisdom ?? "",
    cha: data.cha ?? data.charisma ?? ""
  };
}

function setDndValues(data = {}) {
  const mapped = mapDndFirebaseToPlayerValues(data);

  document.getElementById("player-hp").value = mapped.hp ?? "";
  document.getElementById("player-ac").value = mapped.ac ?? "";
  document.getElementById("player-prof").value = mapped.prof ?? "";
  document.getElementById("player-str").value = mapped.str ?? "";
  document.getElementById("player-dex").value = mapped.dex ?? "";
  document.getElementById("player-con").value = mapped.con ?? "";
  document.getElementById("player-int").value = mapped.int ?? "";
  document.getElementById("player-wis").value = mapped.wis ?? "";
  document.getElementById("player-cha").value = mapped.cha ?? "";
  setPlayerEffects(data.effects ?? []);
}

function setDndResult(message) {
  const el = document.getElementById("dnd-calc-result");
  if (el) el.textContent = message || "";
}

function getOlCurrentHp() {
  const el = document.getElementById("player-ol-current-hp");
  if (!el) return null;
  return numberOrNull(el.textContent);
}

function setOlCurrentHp(value) {
  const el = document.getElementById("player-ol-current-hp");
  if (!el) return;
  el.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
}

function getOpenLegendValues() {
  return {
    currentHp: getOlCurrentHp(),
    grd: parseNumber(document.getElementById("player-ol-grd-view")?.textContent, 0),
    res: parseNumber(document.getElementById("player-ol-res-view")?.textContent, 0),
    tgh: parseNumber(document.getElementById("player-ol-tgh-view")?.textContent, 0),
    banes: getCurrentBanes()
  };
}

function setOpenLegendValues(data = {}) {
  setOlCurrentHp(data.currentHp ?? "");
  document.getElementById("player-ol-grd-view").textContent = data.grd ?? "—";
  document.getElementById("player-ol-res-view").textContent = data.res ?? "—";
  document.getElementById("player-ol-tgh-view").textContent = data.tgh ?? "—";
  setPlayerBanes(data.banes ?? []);
  renderPlayerWeapons(data.weapons ?? []);
}

function getSelectedOlDefense() {
  const selected = document.querySelector(".ol-defense-choice:checked");
  return selected ? selected.value : null;
}

function setOlResult(message) {
  const el = document.getElementById("ol-calc-result");
  if (el) el.textContent = message || "";
}

function getOlBaseHpFromSheet(sheet) {
  return parseNumber(sheet?.baseHp, 0);
}

function applyDndDamage() {
  const damage = parseNumber(document.getElementById("dnd-damage-input").value, NaN);
  if (Number.isNaN(damage) || damage < 0) {
    setDndResult("Enter a valid damage amount.");
    return;
  }

  const currentHp = parseNumber(document.getElementById("player-hp").value, 0);
  const nextHp = Math.max(0, currentHp - damage);

  document.getElementById("player-hp").value = nextHp;
  document.getElementById("dnd-damage-input").value = "";
  setDndResult(`Took ${damage} damage. HP is now ${nextHp}.`);
  scheduleAutoSave("D&D damage applied.");
}

async function healDndHp() {
  const healAmount = parseNumber(document.getElementById("dnd-heal-amount").value, NaN);
  if (Number.isNaN(healAmount) || healAmount < 0) {
    setDndResult("Enter a valid heal amount.");
    return;
  }

  const allowTemp = !!document.getElementById("dnd-temp-heal")?.checked;
  const builderSnap = await get(ref(db, dndBuilderSheetPath()));
  const builderData = builderSnap.exists() ? builderSnap.val() : null;

  const totalLevels = parseNumber(
    (builderData?.classes || []).reduce((sum, c) => sum + Number(c?.level || 0), 0),
    0
  );
  const hpRolled = parseNumber(
    (builderData?.classes || []).reduce((sum, c) => {
      const hpLog = Array.isArray(c?.hpLog) ? c.hpLog : [];
      return sum + hpLog.reduce((a, b) => a + Number(b || 0), 0);
    }, 0),
    0
  );
  const conScore = Number(builderData?.abilities?.Constitution || 10);
  const conMod = Math.floor((conScore - 10) / 2);
  const baseHp = Math.max(totalLevels, hpRolled + (conMod * totalLevels));

  const currentHp = parseNumber(document.getElementById("player-hp").value, 0);

  const nextHp = allowTemp
    ? currentHp + healAmount
    : Math.min(baseHp, currentHp + healAmount);

  document.getElementById("player-hp").value = nextHp;
  document.getElementById("dnd-heal-amount").value = "";

  if (allowTemp) {
    setDndResult(`Healed ${healAmount}. HP is now ${nextHp} (temp allowed).`);
  } else {
    setDndResult(`Healed ${healAmount}. HP is now ${nextHp}.`);
  }

  scheduleAutoSave("D&D healing applied.");
}

async function resetDndFromBuilder() {
  const builderSnap = await get(ref(db, dndBuilderSheetPath()));

  if (!builderSnap.exists()) {
    setDndResult("No builder values found to reset from.");
    return;
  }

  const builderData = builderSnap.val();

  const totalLevels = parseNumber(
    (builderData?.classes || []).reduce((sum, c) => sum + Number(c?.level || 0), 0),
    0
  );

  const hpRolled = parseNumber(
    (builderData?.classes || []).reduce((sum, c) => {
      const hpLog = Array.isArray(c?.hpLog) ? c.hpLog : [];
      return sum + hpLog.reduce((a, b) => a + Number(b || 0), 0);
    }, 0),
    0
  );

  const conScore = Number(builderData?.abilities?.Constitution || 10);
  const conMod = Math.floor((conScore - 10) / 2);
  const rebuiltHp = Math.max(totalLevels, hpRolled + (conMod * totalLevels));

  const armorTable = {
    None:{base:10, dex:"full", maxDex:null},
    Padded:{base:11, dex:"full", maxDex:null},
    Leather:{base:11, dex:"full", maxDex:null},
    StuddedLeather:{base:12, dex:"full", maxDex:null},
    Hide:{base:12, dex:"cap", maxDex:2},
    ChainShirt:{base:13, dex:"cap", maxDex:2},
    ScaleMail:{base:14, dex:"cap", maxDex:2},
    Breastplate:{base:14, dex:"cap", maxDex:2},
    HalfPlate:{base:15, dex:"cap", maxDex:2},
    RingMail:{base:14, dex:"none", maxDex:0},
    ChainMail:{base:16, dex:"none", maxDex:0},
    Splint:{base:17, dex:"none", maxDex:0},
    Plate:{base:18, dex:"none", maxDex:0}
  };
  const shieldTable = { None: 0, Shield: 2 };

  const dexScore = Number(builderData?.abilities?.Dexterity || 10);
  const dexMod = Math.floor((dexScore - 10) / 2);
  const armorKey = builderData?.armor || "None";
  const shieldKey = builderData?.shield || "None";
  const armorData = armorTable[armorKey] || armorTable.None;

  const dexPart =
    armorData.dex === "full"
      ? dexMod
      : armorData.dex === "cap"
        ? Math.min(dexMod, armorData.maxDex)
        : 0;

  const rebuiltAc =
    armorData.base +
    dexPart +
    Number(shieldTable[shieldKey] || 0) +
    Number(builderData?.armorMagic || 0) +
    Number(builderData?.shieldMagic || 0);

  const rebuiltProf = 2 + Math.floor((Math.max(1, totalLevels) - 1) / 4);

  setDndValues({
    hp: rebuiltHp,
    ac: rebuiltAc,
    prof: rebuiltProf,
    str: Number(builderData?.abilities?.Strength ?? ""),
    dex: Number(builderData?.abilities?.Dexterity ?? ""),
    con: Number(builderData?.abilities?.Constitution ?? ""),
    int: Number(builderData?.abilities?.Intelligence ?? ""),
    wis: Number(builderData?.abilities?.Wisdom ?? ""),
    cha: Number(builderData?.abilities?.Charisma ?? ""),
    effects: getCurrentEffects()
  });

  setDndResult("D&D fields reset from character builder.");
  scheduleAutoSave("D&D fields reset from builder.");
}

function applyOpenLegendDamage() {
  const damage = parseNumber(document.getElementById("ol-damage-input").value, NaN);
  if (Number.isNaN(damage) || damage < 0) {
    setOlResult("Enter a valid damage amount.");
    return;
  }

  const defenseKey = getSelectedOlDefense();
  if (!defenseKey) {
    setOlResult("Choose GRD, RES, or TGH.");
    return;
  }

  const values = getOpenLegendValues();
  const currentHp = parseNumber(values.currentHp, 0);
  const defenseValue = parseNumber(values[defenseKey], 0);

  let hpLoss = 0;
  if (damage >= defenseValue) {
    hpLoss = Math.max(3, damage - defenseValue);
  }

  const nextHp = Math.max(0, currentHp - hpLoss);
  setOlCurrentHp(nextHp);

  if (hpLoss > 0) {
    setOlResult(`DMG ${damage} vs ${defenseKey.toUpperCase()} ${defenseValue}. HP reduced by ${hpLoss}.`);
  } else {
    setOlResult(`DMG ${damage} vs ${defenseKey.toUpperCase()} ${defenseValue}. No HP damage taken.`);
  }

  document.getElementById("ol-damage-input").value = "";
  scheduleAutoSave("Open Legend damage applied.");
}

async function resetOpenLegendHp() {
  const existing = await getCurrentSheet();
  const baseHp = getOlBaseHpFromSheet(existing);
  setOlCurrentHp(baseHp);
  setOlResult("HP reset to base HP.");
  scheduleAutoSave("HP reset.");
}

function healOpenLegendHp() {
  const healAmount = parseNumber(document.getElementById("ol-heal-amount").value, NaN);
  if (Number.isNaN(healAmount) || healAmount < 0) {
    setOlResult("Enter a valid heal amount.");
    return;
  }

  getCurrentSheet().then((existing) => {
    const baseHp = getOlBaseHpFromSheet(existing);
    const currentHp = parseNumber(getOlCurrentHp(), baseHp);
    const nextHp = Math.min(baseHp, currentHp + healAmount);

    setOlCurrentHp(nextHp);
    setOlResult(`Healed ${healAmount}. Current HP is now ${nextHp}.`);
    document.getElementById("ol-heal-amount").value = "";
    scheduleAutoSave("HP healed.");
  });
}

function normalizeTrackers(trackers) {
  if (!Array.isArray(trackers)) return [];
  return trackers.filter(Boolean);
}

function renderTrackerList(trackers = []) {
  trackerListEl.innerHTML = "";
  const safeTrackers = normalizeTrackers(trackers);
  trackerEmptyEl.classList.toggle("hidden", safeTrackers.length > 0);

  for (const tracker of safeTrackers) {
    const li = document.createElement("li");
    li.className = "tracker-card";

    const total = Math.max(0, Number(tracker.amount) || 0);
    const value = Math.max(0, Math.min(total, Number(tracker.value) || 0));

    let boxesHtml = "";
    for (let i = 0; i < total; i += 1) {
      boxesHtml += `<input type="checkbox" ${i < value ? "checked" : ""} disabled />`;
    }

    li.innerHTML = `
      <div>
        <div class="tracker-top">
          <span class="tracker-name">${tracker.name || "Tracker"}</span>
          <span class="tracker-progress">${value} / ${total}</span>
        </div>
        <div class="tracker-boxes">${boxesHtml || '<span class="muted">No boxes</span>'}</div>
      </div>
      <div class="tracker-controls">
        <button type="button" class="button-small deduct-btn">Deduct</button>
        <button type="button" class="button-small add-btn">Add</button>
        <button type="button" class="remove-button button-small delete-tracker-btn">Delete</button>
      </div>
    `;

    li.querySelector(".deduct-btn").addEventListener("click", () => {
      changeTrackerValue(tracker.id, value - 1);
    });

    li.querySelector(".add-btn").addEventListener("click", () => {
      changeTrackerValue(tracker.id, value + 1);
    });

    li.querySelector(".delete-tracker-btn").addEventListener("click", async () => {
      const confirmed = confirm(`Delete tracker "${tracker.name || "Tracker"}"?`);
      if (!confirmed) return;
      await deleteTracker(tracker.id);
    });

    trackerListEl.appendChild(li);
  }
}

async function getCurrentSheet() {
  const snap = await get(ref(db, playerSheetPath()));
  return snap.exists() ? snap.val() : null;
}

function buildSheetPayload(existing = {}) {
  const shared = getSharedValues();

  let payload = {
    ...(existing || {}),
    uid: user.uid,
    userEmail: user.email || "",
    userName: user.displayName || "",
    mode,
    name: shared.name,
    initiative: shared.initiative,
    initiativeBonus: shared.initiative,
    trackers: existing.trackers || [],
    updatedAt: Date.now()
  };

  if (mode === "dnd") {
    const dnd = getDndValues();
    const existingBaseHp = parseNumber(existing.baseHp, dnd.hp ?? 0);

    payload = {
      ...payload,
      ...dnd,
      baseHp: existingBaseHp,
      currentHp: dnd.hp,
      proficiencyBonus: dnd.prof,
      strength: dnd.str,
      dexterity: dnd.dex,
      constitution: dnd.con,
      intelligence: dnd.int,
      wisdom: dnd.wis,
      charisma: dnd.cha
    };
  } else {
    const ol = getOpenLegendValues();
    payload = {
      ...payload,
      currentHp: ol.currentHp,
      grd: ol.grd,
      res: ol.res,
      tgh: ol.tgh,
      banes: ol.banes,
      feats: existing.feats || [],
      weapons: existing.weapons || []
    };
  }

  return payload;
}

let autoSaveTimer = null;
let isAutoSaving = false;

function scheduleAutoSave(message = "Saved.") {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    await autoSaveCharacter(message);
  }, 500);
}

async function autoSaveCharacter(message = "Saved.") {
  if (isAutoSaving) return;
  isAutoSaving = true;

  try {
    const existing = (await getCurrentSheet()) || {};
    const payload = buildSheetPayload(existing);
    await set(ref(db, playerSheetPath()), payload);
    setCurrentSheetCache(payload);
    statusEl.textContent = message;
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Could not auto-save character sheet.";
  } finally {
    isAutoSaving = false;
  }
}

async function loadExistingCharacter() {
  const sheetSnap = await get(ref(db, playerSheetPath()));

  if (sheetSnap.exists()) {
    const data = sheetSnap.val();
    setCurrentSheetCache(data);
    setSharedValues(data);

    if (mode === "dnd") {
      setDndValues(data);
    } else {
      setOpenLegendValues({
        currentHp: data.currentHp ?? "",
        grd: data.grd ?? "—",
        res: data.res ?? "—",
        tgh: data.tgh ?? "—",
        banes: data.banes ?? [],
        weapons: data.weapons ?? []
      });
    }

    renderTrackerList(data.trackers || []);
    statusEl.textContent = "Loaded saved character sheet.";
    return;
  }

  const entrySnap = await get(ref(db, playerEntryPath()));
  if (entrySnap.exists()) {
    const entry = entrySnap.val();
    setCurrentSheetCache(entry);

    setSharedValues({
      name: entry.name ?? entry.playerName ?? user.displayName ?? "",
      initiative: entry.number ?? entry.initiative ?? entry.initiativeBonus ?? ""
    });

    if (mode === "dnd") {
      setDndValues(entry);
    } else {
      setOpenLegendValues({
        currentHp: "",
        grd: "—",
        res: "—",
        tgh: "—",
        banes: entry.banes ?? [],
        weapons: entry.weapons ?? []
      });
    }

    renderTrackerList([]);
    statusEl.textContent = "Loaded existing room character data.";
    return;
  }

  setCurrentSheetCache({ name: user.displayName ?? "", banes: [], effects: [] });
  setSharedValues({ name: user.displayName ?? "" });
  if (mode === "dnd") setPlayerEffects([]);
  else setPlayerBanes([]);
  renderTrackerList([]);
}

async function saveInitiativeToGame() {
  const shared = getSharedValues();

  if (!shared.name) {
    statusEl.textContent = "Please enter a character name.";
    return;
  }

  if (shared.initiative === null) {
    statusEl.textContent = "Please enter initiative.";
    return;
  }

  const existing = (await getCurrentSheet()) || {};
  const sheetPayload = buildSheetPayload(existing);

  const entryPayload = {
    uid: user.uid,
    playerName: shared.name,
    initiative: shared.initiative,
    initiativeBonus: shared.initiative,
    name: shared.name,
    number: shared.initiative,
    updatedAt: Date.now(),
    banes: mode === "dnd" ? [] : normalizeBanes(sheetPayload.banes),
    effects: mode === "dnd" ? normalizeEffects(sheetPayload.effects) : []
  };

  try {
    await set(ref(db, playerSheetPath()), sheetPayload);
    setCurrentSheetCache(sheetPayload);
    await set(ref(db, playerEntryPath()), entryPayload);
    playInitiativeSound(shared.initiative);
    statusEl.textContent = "Initiative saved to this game.";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Could not save initiative to this game.";
  }
}

async function createTracker() {
  const nameInput = document.getElementById("tracker-name");
  const amountInput = document.getElementById("tracker-amount");
  const startFull = document.getElementById("tracker-start-full");

  const trackerName = nameInput.value.trim();
  const amount = parseInt(amountInput.value, 10);

  if (!trackerName || Number.isNaN(amount) || amount < 1) {
    statusEl.textContent = "Enter a tracker name and amount.";
    return;
  }

  const existing = (await getCurrentSheet()) || {};
  const payload = buildSheetPayload(existing);

  payload.trackers = [
    ...(existing.trackers || []),
    {
      id: makeId(),
      name: trackerName,
      amount,
      value: startFull.checked ? amount : 0,
      createdAt: Date.now()
    }
  ];
  payload.updatedAt = Date.now();

  await set(ref(db, playerSheetPath()), payload);
  setCurrentSheetCache(payload);
  renderTrackerList(payload.trackers);
  statusEl.textContent = "Tracker added.";

  nameInput.value = "";
  amountInput.value = "";
  startFull.checked = false;
}

async function changeTrackerValue(trackerId, nextValue) {
  const existing = await getCurrentSheet();
  if (!existing) return;

  const trackers = normalizeTrackers(existing.trackers).map((tracker) => {
    if (tracker.id !== trackerId) return tracker;
    const bounded = Math.max(0, Math.min(Number(tracker.amount) || 0, nextValue));
    return { ...tracker, value: bounded };
  });

  const payload = {
    ...existing,
    trackers,
    updatedAt: Date.now()
  };

  await set(ref(db, playerSheetPath()), payload);
  setCurrentSheetCache(payload);
  renderTrackerList(trackers);
}

async function deleteTracker(trackerId) {
  const existing = await getCurrentSheet();
  if (!existing) return;

  const trackers = normalizeTrackers(existing.trackers).filter(
    (tracker) => tracker.id !== trackerId
  );

  const payload = {
    ...existing,
    trackers,
    updatedAt: Date.now()
  };

  await set(ref(db, playerSheetPath()), payload);
  setCurrentSheetCache(payload);
  renderTrackerList(trackers);
  statusEl.textContent = "Tracker deleted.";
}

document.getElementById("player-add-bane-btn")?.addEventListener("click", openBanePickerModal);
document.getElementById("player-view-banes-btn")?.addEventListener("click", openBanesModal);
document.getElementById("bane-picker-close")?.addEventListener("click", closeBanePickerModal);
document.getElementById("banes-modal-close")?.addEventListener("click", closeBanesModal);
document.getElementById("bane-picker-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "bane-picker-modal") closeBanePickerModal();
});
document.getElementById("banes-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "banes-modal") closeBanesModal();
});
baneDetailClose?.addEventListener("click", closeBaneDetailModal);
baneDetailModal?.addEventListener("click", (e) => {
  if (e.target === baneDetailModal) closeBaneDetailModal();
});

document.getElementById("player-add-effect-btn")?.addEventListener("click", openEffectPickerModal);
document.getElementById("player-view-effects-btn")?.addEventListener("click", openEffectsModal);
document.getElementById("effect-picker-close")?.addEventListener("click", closeEffectPickerModal);
document.getElementById("effects-modal-close")?.addEventListener("click", closeEffectsModal);
document.getElementById("effect-picker-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "effect-picker-modal") closeEffectPickerModal();
});
document.getElementById("effects-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "effects-modal") closeEffectsModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  if (document.getElementById("bane-picker-modal")?.getAttribute("aria-hidden") === "false") {
    closeBanePickerModal();
  }
  if (document.getElementById("banes-modal")?.getAttribute("aria-hidden") === "false") {
    closeBanesModal();
  }
  if (baneDetailModal?.getAttribute("aria-hidden") === "false") {
    closeBaneDetailModal();
  }
  if (document.getElementById("effect-picker-modal")?.getAttribute("aria-hidden") === "false") {
    closeEffectPickerModal();
  }
  if (document.getElementById("effects-modal")?.getAttribute("aria-hidden") === "false") {
    closeEffectsModal();
  }
});

saveInitiativeBtn?.addEventListener("click", saveInitiativeToGame);

document.getElementById("dnd-apply-damage-btn")?.addEventListener("click", applyDndDamage);
document.getElementById("dnd-heal-btn")?.addEventListener("click", healDndHp);
document.getElementById("dnd-reset-hp-btn")?.addEventListener("click", resetDndFromBuilder);

document.getElementById("ol-apply-damage-btn")?.addEventListener("click", applyOpenLegendDamage);
document.getElementById("ol-reset-hp-btn")?.addEventListener("click", resetOpenLegendHp);
document.getElementById("ol-heal-btn")?.addEventListener("click", healOpenLegendHp);

document.getElementById("create-tracker-btn")?.addEventListener("click", createTracker);

document.querySelectorAll(".ol-defense-choice").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    if (!checkbox.checked) return;
    document.querySelectorAll(".ol-defense-choice").forEach((other) => {
      if (other !== checkbox) other.checked = false;
    });
  });
});

[
  "player-name",
  "player-initiative",
  "player-hp",
  "player-ac",
  "player-prof",
  "player-str",
  "player-dex",
  "player-con",
  "player-int",
  "player-wis",
  "player-cha"
].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", () => {
    scheduleAutoSave("Character auto-saved.");
  });
});

await loadExistingCharacter();
playerFeatModalClose?.addEventListener("click", closePlayerFeatModal);
playerWeaponModalClose?.addEventListener("click", closePlayerWeaponModal);
playerFeatModal?.addEventListener("click", (event) => { if (event.target === playerFeatModal) closePlayerFeatModal(); });


playerWeaponModal?.addEventListener("click", (event) => {
  if (event.target === playerWeaponModal) closePlayerWeaponModal();
});
