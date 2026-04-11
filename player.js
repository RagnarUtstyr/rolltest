
import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { watchOrLoadGame } from "./game-service.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { getSystemConfig, normalizeMode } from "./ruleset_systems.js";

const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").toUpperCase();
const metaEl = document.getElementById("player-game-meta");
const statusEl = document.getElementById("player-status");
const titleEl = document.getElementById("player-title");
const systemHeadingEl = document.getElementById("system-heading");
const systemSubtitleEl = document.getElementById("system-subtitle");
const builderLinkEl = document.getElementById("builder-link");
const overviewCardsEl = document.getElementById("overview-cards");
const resourceFieldsEl = document.getElementById("resource-fields");
const combatSummaryFieldsEl = document.getElementById("combat-summary-fields");
const utilityPanelEl = document.getElementById("mode-utility-panel");
const utilityTitleEl = document.getElementById("mode-utility-title");
const utilityBodyEl = document.getElementById("mode-utility-body");

const playerNameEl = document.getElementById("player-name");
const initiativeEl = document.getElementById("player-initiative");
const saveInitiativeBtn = document.getElementById("save-initiative-button");
const saveSheetBtn = document.getElementById("save-sheet-btn");
const damageInputEl = document.getElementById("damage-input");
const healInputEl = document.getElementById("heal-input");

const trackerListEl = document.getElementById("tracker-list");
const trackerEmptyEl = document.getElementById("tracker-empty");
const trackerNameEl = document.getElementById("tracker-name");
const trackerAmountEl = document.getElementById("tracker-amount");
const trackerStartFullEl = document.getElementById("tracker-start-full");
const createTrackerBtn = document.getElementById("create-tracker-btn");

const effectsPanel = document.getElementById("player-effects-panel");
const effectsPreview = document.getElementById("player-effects-preview");
const banesPanel = document.getElementById("player-banes-panel");
const banesPreview = document.getElementById("player-banes-preview");

const user = await requireAuth();
if (!code) throw new Error("Missing game code.");
const game = await watchOrLoadGame(code);
if (!game) throw new Error("Game not found.");

const mode = normalizeMode(game.mode);
const config = getSystemConfig(mode);

const themeLink = document.getElementById("player-theme-style");
if (themeLink) themeLink.href = `player_${config.theme || mode}.css`;
document.title = `${config.title} Player Sheet`;
titleEl.textContent = `${config.title} Player Sheet`;
systemHeadingEl.textContent = `${config.title} Overview`;
systemSubtitleEl.textContent = "Important table-facing stats before you open the builder.";
metaEl.innerHTML = `<div><strong>${game.title}</strong></div><div class="muted">Code: ${game.code} · ${game.mode} · Admin: ${game.ownerName}</div>`;
builderLinkEl.href = `${config.builderFile}?code=${encodeURIComponent(code)}`;

function playerPath() { return `games/${code}/players/${user.uid}`; }
function entryPath() { return `games/${code}/entries/${user.uid}`; }
function trackersPath() { return `games/${code}/players/${user.uid}/trackers`; }

function buildOverview() {
  overviewCardsEl.innerHTML = (config.overviewStats || []).map((stat) => `
    <div class="overview-card">
      <div class="summary-label">${stat.label}</div>
      <div class="summary-value" data-stat-key="${stat.key}">—</div>
    </div>`).join("");

  resourceFieldsEl.innerHTML = (config.resources || []).map((res) => {
    const input = res.type === "textarea"
      ? `<textarea id="field-${res.key}" data-resource-key="${res.key}"></textarea>`
      : `<input id="field-${res.key}" data-resource-key="${res.key}" type="${res.type || "text"}" />`;
    return `<label class="field-stack">${res.label}${input}</label>`;
  }).join("");

  combatSummaryFieldsEl.innerHTML = (config.combatSummary || ["Important notes", "Top attacks", "Resources"]).map((label, index) =>
    `<label class="field-stack">${label}<textarea id="combat-summary-${index}" data-combat-key="combatSummary${index}"></textarea></label>`
  ).join("");

  if (mode === "dnd") {
    effectsPanel?.classList.remove("hidden");
    utilityPanelEl?.classList.remove("hidden");
    utilityTitleEl.textContent = "D&D quick resources";
    utilityBodyEl.innerHTML = `<span class="chip">Temp HP</span><span class="chip">Death saves</span><span class="chip">Spell DC</span>`;
  } else if (mode === "openlegend") {
    banesPanel?.classList.remove("hidden");
    utilityPanelEl?.classList.remove("hidden");
    utilityTitleEl.textContent = "Open Legend quick resources";
    utilityBodyEl.innerHTML = `<span class="chip">Guard</span><span class="chip">Resolve</span><span class="chip">Toughness</span>`;
  }
}

function renderSheet(sheet = {}) {
  playerNameEl.value = sheet.name || "";
  initiativeEl.value = sheet.initiative ?? "";
  document.querySelectorAll("[data-stat-key]").forEach((el) => {
    const key = el.dataset.statKey;
    el.textContent = sheet[key] ?? sheet[camelFallback(key)] ?? "—";
  });
  document.querySelectorAll("[data-resource-key]").forEach((el) => {
    const key = el.dataset.resourceKey;
    el.value = sheet[key] ?? "";
  });
  document.querySelectorAll("[data-combat-key]").forEach((el) => {
    const key = el.dataset.combatKey;
    el.value = sheet[key] ?? "";
  });
  if (effectsPreview && Array.isArray(sheet.effects)) {
    effectsPreview.innerHTML = sheet.effects.length ? sheet.effects.map((e) => `<span class="chip">${e.name || e}</span>`).join("") : `<span class="muted">No effects added.</span>`;
  }
  if (banesPreview && Array.isArray(sheet.banes)) {
    banesPreview.innerHTML = sheet.banes.length ? sheet.banes.map((b) => `<span class="chip">${b.name || b}</span>`).join("") : `<span class="muted">No banes added.</span>`;
  }
}

function camelFallback(key) {
  return key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function currentHpKey() {
  const keys = ["currentHp", "hp", "health", "mechHp", "wounds"];
  for (const key of keys) {
    if (config.overviewStats?.some((s) => s.key === key) || config.resources?.some((r) => r.key === key)) {
      return key;
    }
  }
  return "currentHp";
}

function readFormValues() {
  const data = {
    mode,
    name: playerNameEl.value.trim(),
    initiative: numberMaybe(initiativeEl.value)
  };
  document.querySelectorAll("[data-resource-key]").forEach((el) => {
    data[el.dataset.resourceKey] = numberMaybeOrString(el.value);
  });
  document.querySelectorAll("[data-combat-key]").forEach((el) => {
    data[el.dataset.combatKey] = el.value;
  });
  document.querySelectorAll("[data-stat-key]").forEach((el) => {
    const key = el.dataset.statKey;
    if (data[key] == null || data[key] === "") {
      const source = document.getElementById(`field-${key}`);
      if (source) data[key] = numberMaybeOrString(source.value);
    }
  });
  const hpKey = currentHpKey();
  const hpField = document.getElementById(`field-${hpKey}`);
  if (hpField && data[hpKey] == null) data[hpKey] = numberMaybeOrString(hpField.value);
  return data;
}

function numberMaybe(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function numberMaybeOrString(value) {
  if (value === "" || value == null) return "";
  const n = Number(value);
  return Number.isFinite(n) && String(value).trim() !== "" ? n : value;
}

async function loadSheet() {
  const playerSnap = await get(ref(db, playerPath()));
  const builderSnap = await get(ref(db, `games/${code}/builderSheets_${mode}/${user.uid}`));
  const dndBuilderSnap = mode === "dnd" ? await get(ref(db, `games/${code}/builderSheetsDnd/${user.uid}`)) : null;
  const data = {
    ...(playerSnap.exists() ? playerSnap.val() : {}),
    ...(builderSnap.exists() ? builderSnap.val() : {}),
    ...(dndBuilderSnap?.exists() ? dndBuilderSnap.val() : {})
  };
  renderSheet(data);
  await loadTrackers();
}

async function saveSheet() {
  const data = readFormValues();
  await set(ref(db, playerPath()), data);
  const hpKey = currentHpKey();
  const entry = {
    name: data.name || config.title,
    initiative: data.initiative ?? 0,
    number: data.initiative ?? 0,
    health: Number(data[hpKey] || 0) || 0,
    currentHp: Number(data[hpKey] || 0) || 0,
    mode,
    url: `${config.builderFile}?code=${encodeURIComponent(code)}`
  };
  if (data.ac != null) entry.ac = data.ac;
  if (data.grd != null) entry.grd = data.grd;
  if (data.res != null) entry.res = data.res;
  if (data.tgh != null) entry.tgh = data.tgh;
  await set(ref(db, entryPath()), entry);
  statusEl.textContent = "Saved player sheet.";
  await loadSheet();
}

async function applyDamageOrHeal(delta) {
  const hpKey = currentHpKey();
  const field = document.getElementById(`field-${hpKey}`);
  if (!field) return;
  const current = Number(field.value || 0) || 0;
  field.value = Math.max(0, current + delta);
  await saveSheet();
}

function makeId() { return `id-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

async function loadTrackers() {
  const snap = await get(ref(db, trackersPath()));
  const data = snap.exists() ? snap.val() : {};
  const trackers = Object.entries(data).map(([id, value]) => ({ id, ...value }));
  renderTrackers(trackers);
}

function renderTrackers(trackers) {
  trackerListEl.innerHTML = "";
  trackerEmptyEl.style.display = trackers.length ? "none" : "block";
  trackers.forEach((tracker) => {
    const li = document.createElement("li");
    li.className = "tracker-item";
    const checks = Array.from({ length: Number(tracker.amount || 0) }).map((_, index) => `
      <button type="button" class="tracker-dot ${index < Number(tracker.filled || 0) ? "active" : ""}" data-id="${tracker.id}" data-index="${index}"></button>`).join("");
    li.innerHTML = `
      <div><strong>${tracker.name}</strong></div>
      <div class="tracker-progress">${checks}</div>
      <div>${tracker.filled || 0}/${tracker.amount || 0}</div>
      <button type="button" class="tracker-remove" data-remove-id="${tracker.id}">Remove</button>`;
    trackerListEl.appendChild(li);
  });
}

async function createTracker() {
  const name = trackerNameEl.value.trim();
  const amount = Number(trackerAmountEl.value || 0);
  if (!name || !amount) return;
  const tracker = { name, amount, filled: trackerStartFullEl.checked ? amount : 0 };
  await set(ref(db, `${trackersPath()}/${makeId()}`), tracker);
  trackerNameEl.value = "";
  trackerAmountEl.value = "";
  trackerStartFullEl.checked = false;
  await loadTrackers();
}

trackerListEl.addEventListener("click", async (event) => {
  const toggleButton = event.target.closest(".tracker-dot");
  if (toggleButton) {
    const id = toggleButton.dataset.id;
    const index = Number(toggleButton.dataset.index || 0);
    const snap = await get(ref(db, `${trackersPath()}/${id}`));
    if (!snap.exists()) return;
    const tracker = snap.val();
    const nextFilled = index + 1 === Number(tracker.filled || 0) ? index : index + 1;
    await set(ref(db, `${trackersPath()}/${id}`), { ...tracker, filled: nextFilled });
    await loadTrackers();
    return;
  }
  const removeButton = event.target.closest("[data-remove-id]");
  if (removeButton) {
    await remove(ref(db, `${trackersPath()}/${removeButton.dataset.removeId}`));
    await loadTrackers();
  }
});

buildOverview();
await loadSheet();
saveInitiativeBtn?.addEventListener("click", saveSheet);
saveSheetBtn?.addEventListener("click", saveSheet);
document.getElementById("apply-damage-btn")?.addEventListener("click", async () => applyDamageOrHeal(-(Number(damageInputEl.value || 0) || 0)));
document.getElementById("apply-heal-btn")?.addEventListener("click", async () => applyDamageOrHeal(Number(healInputEl.value || 0) || 0));
createTrackerBtn?.addEventListener("click", createTracker);
