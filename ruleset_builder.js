
import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { watchOrLoadGame } from "./game-service.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { getSystemConfig, normalizeMode } from "./ruleset_systems.js";

const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").trim().toUpperCase();
const forceMode = normalizeMode(params.get("mode") || "");
const builderMetaEl = document.getElementById("builder-meta");
const builderTitleEl = document.getElementById("builder-title");
const builderSubtitleEl = document.getElementById("builder-subtitle");
const builderSummaryEl = document.getElementById("builder-summary");
const builderSectionsEl = document.getElementById("builder-sections");
const saveStatusEl = document.getElementById("save-status");
const saveNowBtn = document.getElementById("save-now-btn");
const backLink = document.getElementById("back-to-player-link");

const user = await requireAuth();
if (!code) throw new Error("Missing game code.");
const game = await watchOrLoadGame(code);
if (!game) throw new Error("Game not found.");

const mode = forceMode || normalizeMode(game.mode);
const config = getSystemConfig(mode);

document.title = `${config.title} Builder`;
builderTitleEl.textContent = `${config.title} Builder`;
builderSubtitleEl.textContent = config.builderSections ? "Expanded guided builder" : "Overview-aligned guided builder";
builderMetaEl.innerHTML = `<strong>${game.title}</strong> · ${config.title} · Code: ${game.code}`;
backLink.href = `player.html?code=${encodeURIComponent(code)}`;

const themeLink = document.getElementById("builder-theme-style");
if (themeLink) themeLink.href = `ruleset_builder_${config.theme || mode}.css`;

function buildSummaryCards() {
  builderSummaryEl.innerHTML = "";
  (config.overviewStats || []).slice(0, 6).forEach((stat) => {
    const card = document.createElement("div");
    card.className = "summary-card";
    card.innerHTML = `<div>${stat.label}</div><div class="value" data-summary-key="${stat.key}">—</div>`;
    builderSummaryEl.appendChild(card);
  });
}

function fieldTemplate([key, label, type]) {
  const spanClass = type === "textarea" ? "field-row span-3" : "field-row";
  const input = type === "textarea"
    ? `<textarea id="field-${key}" data-field-key="${key}"></textarea>`
    : `<input id="field-${key}" data-field-key="${key}" type="${type || "text"}" />`;
  return `<label class="${spanClass}">${label}${input}</label>`;
}

function buildSections() {
  const sections = config.builderSections || [
    {
      title: `${config.title} essentials`,
      fields: [
        ["name","Character name","text"],
        ["currentHp","Current HP","number"],
        ["initiative","Initiative","number"],
        ...((config.overviewStats || []).filter((s) => !["initiative"].includes(s.key)).slice(0, 5).map((s) => [s.key, s.label, "text"])),
        ...((config.resources || []).map((r) => [r.key, r.label, r.type || "text"]))
      ]
    }
  ];

  builderSectionsEl.innerHTML = sections.map((section) => `
    <section class="builder-section">
      <h2>${section.title}</h2>
      <div class="fields-grid">
        ${section.fields.map(fieldTemplate).join("")}
      </div>
    </section>
  `).join("");
}

function builderPath() {
  const suffix = mode === "dnd" ? "builderSheetsDnd" : `builderSheets_${mode}`;
  return `games/${code}/${suffix}/${user.uid}`;
}

function playerPath() {
  return `games/${code}/players/${user.uid}`;
}

function entryPath() {
  return `games/${code}/entries/${user.uid}`;
}

function getFieldValues() {
  const values = {};
  document.querySelectorAll("[data-field-key]").forEach((el) => {
    const key = el.dataset.fieldKey;
    if (!key) return;
    values[key] = el.value;
  });
  values.mode = mode;
  values.updatedAt = Date.now();
  return values;
}

function syncSummary(values) {
  document.querySelectorAll("[data-summary-key]").forEach((el) => {
    const key = el.dataset.summaryKey;
    el.textContent = values[key] || "—";
  });
}

function toNumberMaybe(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
}

async function saveAll() {
  const values = getFieldValues();
  const data = Object.fromEntries(Object.entries(values).map(([k,v]) => [k, toNumberMaybe(v)]));
  const name = String(values.name || "").trim();
  const initiative = Number(values.initiative || 0) || 0;
  const currentHp = Number(values.currentHp || values.hp || values.mechHp || values.health || 0) || 0;

  await set(ref(db, builderPath()), data);
  await set(ref(db, playerPath()), { ...data, name, initiative });
  await set(ref(db, entryPath()), {
    name: name || config.title,
    initiative,
    number: initiative,
    health: currentHp,
    hp: currentHp,
    currentHp,
    ac: data.ac ?? null,
    grd: data.grd ?? null,
    res: data.res ?? null,
    tgh: data.tgh ?? null,
    mode,
    url: `${config.builderFile}?code=${encodeURIComponent(code)}`
  });

  saveStatusEl.textContent = "Saved to Firebase.";
  syncSummary(values);
}

async function loadAll() {
  const snapshot = await get(ref(db, builderPath()));
  const data = snapshot.exists() ? snapshot.val() : {};
  document.querySelectorAll("[data-field-key]").forEach((el) => {
    const key = el.dataset.fieldKey;
    el.value = data[key] ?? "";
  });
  syncSummary(data);
}

buildSummaryCards();
buildSections();
await loadAll();
saveNowBtn?.addEventListener("click", saveAll);
document.addEventListener("input", (event) => {
  const el = event.target;
  if (el?.dataset?.fieldKey) {
    syncSummary(getFieldValues());
  }
});
