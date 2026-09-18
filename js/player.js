import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { watchOrLoadGame } from "./game-service.js?v=20260917olui1";
import { BANES } from "./banes.js";
import { OPENLEGEND_BANES } from "./openlegend_banes.js";
import { EFFECTS } from "./effects.js";
import { FATIGUE_DATA, clampFatigueLevel, getFatigueLevels, hasFatigueSlowedLink } from "./fatigue.js";
import {
  ref,
  get,
  set,
  update,
  onValue
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
const dndSheetApp = document.getElementById("dnd-sheet-app");

const dndBuilderLink = document.getElementById("dnd-builder-link");
const openLegendBuilderLink = document.getElementById("openlegend-builder-link");

const trackerListEl = document.getElementById("tracker-list");
const trackerEmptyEl = document.getElementById("tracker-empty");
const playerBanesPanel = document.getElementById("player-banes-panel");
const playerBanesPreviewEl = document.getElementById("player-banes-preview");
const playerFatiguePanel = document.getElementById("player-fatigue-panel");
const playerFatigueViewEl = document.getElementById("player-fatigue-view");
const playerFatigueLevelDisplayEl = document.getElementById("player-fatigue-level-display");
const playerFatigueSummaryTextEl = document.getElementById("player-fatigue-summary-text");
const playerFatigueSpecialTextEl = document.getElementById("player-fatigue-special-text");
const playerEffectsPanel = document.getElementById("player-effects-panel");
const playerEffectsPreviewEl = document.getElementById("player-effects-preview");
const playerSharedNotesEl = document.getElementById("player-shared-notes");
const playerSharedNotesSaveBtn = document.getElementById("player-shared-notes-save");
const playerSharedNotesStatusEl = document.getElementById("player-shared-notes-status");
const playerSharedNotesMetaEl = document.getElementById("player-shared-notes-meta");
const playerPingDmBtn = document.getElementById("player-ping-dm");
const playerPingDmStatusEl = document.getElementById("player-ping-dm-status");

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

function isOpenLegendMode(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "openlegend" || normalized === "ol" || normalized === "open_legend";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyModeStyles(currentMode) {
  const dndStyle = document.getElementById("player-dnd-style");
  const olStyle = document.getElementById("player-ol-style");
  const isOl = isOpenLegendMode(currentMode);

  document.body.classList.toggle("player-mode-openlegend", isOl);
  document.body.classList.toggle("player-mode-dnd", currentMode === "dnd");

  if (!dndStyle || !olStyle) return;

  dndStyle.disabled = true;
  olStyle.disabled = true;

  if (currentMode === "dnd") {
    dndStyle.disabled = false;
  } else if (isOl) {
    olStyle.disabled = false;
  }
}

applyModeStyles(mode);

const pageTitleEl = document.getElementById("player-page-title");
if (isOpenLegendMode(mode) && pageTitleEl) {
  pageTitleEl.textContent = "Open Legend";
} else if (mode === "dnd" && pageTitleEl) {
  pageTitleEl.textContent = "D&D";
}

if (isOpenLegendMode(mode)) {
  metaEl.innerHTML = `
    <div class="ol-game-meta-main">
      <strong>${escapeHtml(game.title || "Open Legend")}</strong>
    </div>
    <div class="ol-game-code-card">
      <span>Code</span>
      <strong>${escapeHtml(game.code)}</strong>
    </div>
  `;
} else {
  metaEl.innerHTML = `
    <div><strong>${escapeHtml(game.title)}</strong></div>
    <div class="muted">Code: ${escapeHtml(game.code)}</div>
  `;
}

if (mode === "dnd") {
  dndSheetApp?.removeAttribute("hidden");
  playerEffectsPanel?.classList.remove("hidden");

  if (dndBuilderLink) {
    dndBuilderLink.href = `dnd_character_builder_firebase.html?code=${encodeURIComponent(code)}`;
  }
} else if (isOpenLegendMode(mode)) {
  olSection.classList.remove("hidden");

  if (openLegendBuilderLink) {
    openLegendBuilderLink.href = `openlegend_character_builder.html?code=${encodeURIComponent(code)}`;
  }

  playerBanesPanel?.classList.remove("hidden");
  playerFatiguePanel?.classList.remove("hidden");
} else {
  statusEl.textContent = `Unsupported game mode: ${game.mode}`;
  throw new Error(`Unsupported game mode: ${game.mode}`);
}

function setupPlayerMobileCarousel(config) {
  const carousel = document.getElementById(config.carouselId);
  const track = document.getElementById(config.trackId);
  if (!carousel || !track) return;

  carousel.hidden = false;

  const slides = Array.from(track.querySelectorAll("[data-carousel-slide]"));
  const tabs = Array.from(carousel.querySelectorAll("[data-carousel-tab]"));
  const dots = Array.from(carousel.querySelectorAll(".ol-carousel-dot"));
  const prevBtn = document.getElementById(config.prevId);
  const nextBtn = document.getElementById(config.nextId);
  const mobileQuery = window.matchMedia("(max-width: 720px)");

  const restoreMarkers = new Map();
  Object.values(config.placement).flat().filter(Boolean).forEach((node) => {
    if (restoreMarkers.has(node)) return;
    const marker = document.createComment(`restore-${node.id || "player-panel"}`);
    node.parentNode?.insertBefore(marker, node);
    restoreMarkers.set(node, marker);
  });

  let activeIndex = 0;
  let scrollTimer = null;
  let touchStartX = null;
  let touchStartIndex = 0;

  const wrapIndex = (index) => {
    if (!slides.length) return 0;
    return ((index % slides.length) + slides.length) % slides.length;
  };

  function updateActive(nextIndex) {
    activeIndex = wrapIndex(nextIndex);
    const activeKey = slides[activeIndex]?.dataset.carouselSlide;

    tabs.forEach((tab) => {
      const active = tab.dataset.carouselTab === activeKey;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    dots.forEach((dot, index) => dot.classList.toggle("is-active", index === activeIndex));
    if (prevBtn) prevBtn.disabled = false;
    if (nextBtn) nextBtn.disabled = false;
  }

  function goTo(index, smooth = true) {
    if (!mobileQuery.matches || !slides.length) return;
    updateActive(index);
    const slide = slides[activeIndex];
    track.scrollTo({ left: slide.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  }

  function movePanelsIntoCarousel() {
    Object.entries(config.placement).forEach(([key, nodes]) => {
      const slot = carousel.querySelector(`[data-carousel-slot="${key}"]`);
      if (!slot) return;
      nodes.filter(Boolean).forEach((node) => slot.appendChild(node));
    });
    carousel.classList.add("is-mobile-active");
    requestAnimationFrame(() => goTo(activeIndex, false));
  }

  function restoreDesktopLayout() {
    restoreMarkers.forEach((marker, node) => {
      if (marker.parentNode) marker.parentNode.insertBefore(node, marker.nextSibling);
    });
    carousel.classList.remove("is-mobile-active");
    track.scrollLeft = 0;
    updateActive(0);
  }

  function applyResponsiveLayout() {
    if (mobileQuery.matches) movePanelsIntoCarousel();
    else restoreDesktopLayout();
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const index = slides.findIndex((slide) => slide.dataset.carouselSlide === tab.dataset.carouselTab);
      if (index >= 0) goTo(index);
    });
  });

  prevBtn?.addEventListener("click", () => goTo(activeIndex - 1));
  nextBtn?.addEventListener("click", () => goTo(activeIndex + 1));

  track.addEventListener("scroll", () => {
    if (!mobileQuery.matches) return;
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const center = track.scrollLeft + (track.clientWidth / 2);
      let nearest = 0;
      let nearestDistance = Infinity;
      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + (slide.offsetWidth / 2);
        const distance = Math.abs(slideCenter - center);
        if (distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      updateActive(nearest);
    }, 70);
  }, { passive: true });

  // Native scroll-snap has hard edges. Detect an outward swipe at either edge
  // and wrap to the opposite end so the mobile carousel never dead-ends.
  track.addEventListener("touchstart", (event) => {
    if (!mobileQuery.matches || !event.touches?.length) return;
    touchStartX = event.touches[0].clientX;
    touchStartIndex = activeIndex;
  }, { passive: true });

  track.addEventListener("touchend", (event) => {
    if (!mobileQuery.matches || touchStartX === null || !event.changedTouches?.length) return;
    const delta = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) < 42) return;

    if (delta < 0 && touchStartIndex === slides.length - 1) {
      goTo(0, true);
    } else if (delta > 0 && touchStartIndex === 0) {
      goTo(slides.length - 1, true);
    }
  }, { passive: true });

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", applyResponsiveLayout);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(applyResponsiveLayout);
  }

  updateActive(0);
  applyResponsiveLayout();
}

function setupPlayerMobileCarousels() {
  if (isOpenLegendMode(mode)) {
    setupPlayerMobileCarousel({
      carouselId: "ol-mobile-carousel",
      trackId: "ol-carousel-track",
      prevId: "ol-carousel-prev",
      nextId: "ol-carousel-next",
      placement: {
        overview: [
          document.getElementById("player-name-panel"),
          document.getElementById("player-openlegend-overview-panel"),
          document.getElementById("player-openlegend-damage-panel")
        ],
        actions: [
          document.getElementById("player-initiative-panel"),
          document.getElementById("player-openlegend-actions-panel")
        ],
        attributes: [document.getElementById("player-openlegend-attributes-panel")],
        trackers: [document.getElementById("player-trackers-panel")],
        banes: [document.getElementById("player-banes-panel"), document.getElementById("player-fatigue-panel")],
        notes: [document.getElementById("player-shared-notes-panel")]
      }
    });
    return;
  }

  if (mode === "dnd") {
    setupDndSheetCarousel();
  }
}


let currentDndBuilderData = null;
let currentDndPageIndex = 0;

const DND_ABILITY_ORDER = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const DND_ABILITY_SHORT = { Strength:"STR", Dexterity:"DEX", Constitution:"CON", Intelligence:"INT", Wisdom:"WIS", Charisma:"CHA" };
const DND_SKILL_DATA = {
  Athletics:"Strength", Acrobatics:"Dexterity", "Sleight of Hand":"Dexterity", Stealth:"Dexterity",
  Arcana:"Intelligence", History:"Intelligence", Investigation:"Intelligence", Nature:"Intelligence", Religion:"Intelligence",
  "Animal Handling":"Wisdom", Insight:"Wisdom", Medicine:"Wisdom", Perception:"Wisdom", Survival:"Wisdom",
  Deception:"Charisma", Intimidation:"Charisma", Performance:"Charisma", Persuasion:"Charisma"
};
const DND_BACKGROUND_SKILLS = {
  Acolyte:["Insight","Religion"], Artisan:["Investigation","Persuasion"], Criminal:["Sleight of Hand","Stealth"],
  Guard:["Athletics","Perception"], Hermit:["Medicine","Religion"], Noble:["History","Persuasion"],
  Sage:["Arcana","History"], Soldier:["Athletics","Intimidation"], Wayfarer:["Insight","Stealth"]
};
const DND_SPECIES_SKILLS = { Elf:["Perception"] };
const DND_SPECIES_SPEED = { Human:30, Dwarf:30, Elf:30, Halfling:30, Gnome:30, Dragonborn:30, Orc:30, Tiefling:30 };
const DND_CLASS_HD = { Barbarian:12, Bard:8, Cleric:8, Druid:8, Fighter:10, Monk:8, Paladin:10, Ranger:10, Rogue:8, Sorcerer:6, Warlock:8, Wizard:6 };
const DND_CLASS_SAVES = {
  Barbarian:["Strength","Constitution"], Bard:["Dexterity","Charisma"], Cleric:["Wisdom","Charisma"], Druid:["Intelligence","Wisdom"],
  Fighter:["Strength","Constitution"], Monk:["Strength","Dexterity"], Paladin:["Wisdom","Charisma"], Ranger:["Strength","Dexterity"],
  Rogue:["Dexterity","Intelligence"], Sorcerer:["Constitution","Charisma"], Warlock:["Wisdom","Charisma"], Wizard:["Intelligence","Wisdom"]
};
const DND_CLASS_CASTING = { Bard:"full", Cleric:"full", Druid:"full", Paladin:"half", Ranger:"half", Sorcerer:"full", Warlock:"pact", Wizard:"full" };
const DND_SPELL_SLOTS_FULL = {
  1:[2,0,0,0,0,0,0,0,0],2:[3,0,0,0,0,0,0,0,0],3:[4,2,0,0,0,0,0,0,0],4:[4,3,0,0,0,0,0,0,0],
  5:[4,3,2,0,0,0,0,0,0],6:[4,3,3,0,0,0,0,0,0],7:[4,3,3,1,0,0,0,0,0],8:[4,3,3,2,0,0,0,0,0],
  9:[4,3,3,3,1,0,0,0,0],10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
  13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],16:[4,3,3,3,2,1,1,1,0],
  17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1]
};
const DND_WEAPON_META = {
  Club:{ability:"Strength",damage:"1d4",type:"Bludgeoning",properties:["Light"]},
  Dagger:{ability:"Dexterity/Strength",damage:"1d4",type:"Piercing",range:"20/60 ft",properties:["Finesse","Light","Thrown"]},
  Greatsword:{ability:"Strength",damage:"2d6",type:"Slashing",properties:["Heavy","Two-Handed"]},
  Greataxe:{ability:"Strength",damage:"1d12",type:"Slashing",properties:["Heavy","Two-Handed"]},
  Handaxe:{ability:"Strength",damage:"1d6",type:"Slashing",range:"20/60 ft",properties:["Light","Thrown"]},
  Javelin:{ability:"Strength",damage:"1d6",type:"Piercing",range:"30/120 ft",properties:["Thrown"]},
  Longbow:{ability:"Dexterity",damage:"1d8",type:"Piercing",range:"150/600 ft",properties:["Ammunition","Heavy","Two-Handed"]},
  Longsword:{ability:"Strength",damage:"1d8",type:"Slashing",properties:["Versatile"]},
  Mace:{ability:"Strength",damage:"1d6",type:"Bludgeoning",properties:[]}, Quarterstaff:{ability:"Strength",damage:"1d6",type:"Bludgeoning",properties:["Versatile"]},
  Rapier:{ability:"Dexterity",damage:"1d8",type:"Piercing",properties:["Finesse"]}, Scimitar:{ability:"Dexterity",damage:"1d6",type:"Slashing",properties:["Finesse","Light"]},
  Shortbow:{ability:"Dexterity",damage:"1d6",type:"Piercing",range:"80/320 ft",properties:["Ammunition","Two-Handed"]}, Shortsword:{ability:"Dexterity",damage:"1d6",type:"Piercing",properties:["Finesse","Light"]},
  Spear:{ability:"Strength",damage:"1d6",type:"Piercing",range:"20/60 ft",properties:["Thrown","Versatile"]}, Warhammer:{ability:"Strength",damage:"1d8",type:"Bludgeoning",properties:["Versatile"]},
  CrossbowLight:{label:"Light Crossbow",ability:"Dexterity",damage:"1d8",type:"Piercing",range:"80/320 ft",properties:["Ammunition","Loading","Two-Handed"]}
};
const DND_CLASS_ACTIONS = {
  Barbarian:[[1,"Rage","Bonus Action"],[2,"Reckless Attack","Attack"]],
  Bard:[[1,"Bardic Inspiration","Bonus Action"],[2,"Song of Rest","Rest"]],
  Cleric:[[1,"Spellcasting","Action"],[2,"Channel Divinity","Action"]],
  Druid:[[1,"Spellcasting","Action"],[2,"Wild Shape","Action"]],
  Fighter:[[1,"Second Wind","Bonus Action"],[2,"Action Surge","Action"],[5,"Extra Attack","Action"]],
  Monk:[[1,"Martial Arts","Action"],[2,"Ki","Bonus Action"],[3,"Deflect Missiles","Reaction"]],
  Paladin:[[1,"Lay on Hands","Action"],[2,"Divine Smite","On Hit"],[3,"Channel Divinity","Action"]],
  Ranger:[[1,"Favored Enemy","Feature"],[2,"Spellcasting","Action"],[5,"Extra Attack","Action"]],
  Rogue:[[1,"Sneak Attack","On Hit"],[2,"Cunning Action","Bonus Action"],[5,"Uncanny Dodge","Reaction"]],
  Sorcerer:[[1,"Spellcasting","Action"],[2,"Font of Magic","Feature"],[3,"Metamagic","Feature"]],
  Warlock:[[1,"Pact Magic","Action"],[2,"Eldritch Invocations","Feature"]],
  Wizard:[[1,"Spellcasting","Action"],[1,"Arcane Recovery","Rest"]]
};
const DND_SPELL_META = {
  "Fire Bolt":{school:"Evocation",time:"1 action",range:"120 ft",tags:["Damage","Fire"]},
  "Mage Hand":{school:"Conjuration",time:"1 action",range:"30 ft",tags:["Utility","Control"]},
  Light:{school:"Evocation",time:"1 action",range:"Touch",tags:["Utility","Exploration"]},
  "Magic Missile":{school:"Evocation",time:"1 action",range:"120 ft",tags:["Damage","Force"]},
  Shield:{school:"Abjuration",time:"1 reaction",range:"Self",tags:["Defense","Protection"]},
  "Detect Magic":{school:"Divination",time:"1 action",range:"Self",tags:["Utility","Exploration"]},
  "Misty Step":{school:"Conjuration",time:"1 bonus action",range:"Self",tags:["Movement","Teleportation"]},
  "Scorching Ray":{school:"Evocation",time:"1 action",range:"120 ft",tags:["Damage","Fire"]},
  Fireball:{school:"Evocation",time:"1 action",range:"150 ft",tags:["Damage","Fire"]},
  "Cure Wounds":{school:"Evocation",time:"1 action",range:"Touch",tags:["Healing"]},
  "Healing Word":{school:"Evocation",time:"1 bonus action",range:"60 ft",tags:["Healing"]},
  "Eldritch Blast":{school:"Evocation",time:"1 action",range:"120 ft",tags:["Damage","Force"]},
  Guidance:{school:"Divination",time:"1 action",range:"Touch",tags:["Support"]},
  Bless:{school:"Enchantment",time:"1 action",range:"30 ft",tags:["Support"]}
};

function dndMod(score) { return Math.floor((Number(score || 10) - 10) / 2); }
function dndSigned(value) { const n = Number(value || 0); return `${n >= 0 ? "+" : ""}${n}`; }
function dndTotalLevel(builder = {}) { return (builder.classes || []).reduce((sum, c) => sum + Number(c?.level || 0), 0) || 1; }
function dndProfBonus(builder = {}) { return 2 + Math.floor((Math.max(1, dndTotalLevel(builder)) - 1) / 4); }
function dndAbilities(builder = {}, sheet = {}) {
  const a = builder.abilities || {};
  return {
    Strength:Number(a.Strength ?? sheet.strength ?? sheet.str ?? 10), Dexterity:Number(a.Dexterity ?? sheet.dexterity ?? sheet.dex ?? 10),
    Constitution:Number(a.Constitution ?? sheet.constitution ?? sheet.con ?? 10), Intelligence:Number(a.Intelligence ?? sheet.intelligence ?? sheet.int ?? 10),
    Wisdom:Number(a.Wisdom ?? sheet.wisdom ?? sheet.wis ?? 10), Charisma:Number(a.Charisma ?? sheet.charisma ?? sheet.cha ?? 10)
  };
}
function dndHitDiceSummary(builder = {}) {
  const pools = {};
  (builder.classes || []).forEach((c) => { const die = DND_CLASS_HD[c?.name]; if (die) pools[die] = (pools[die] || 0) + Number(c?.level || 0); });
  return Object.entries(pools).sort((a,b)=>Number(a[0])-Number(b[0])).map(([die,count])=>`${count}d${die}`).join(" / ") || "—";
}
function dndMaxHpFromBuilder(builder = {}, sheet = {}) {
  const saved = Number(sheet.baseHp);
  if (Number.isFinite(saved) && saved > 0) return saved;
  const abilities = dndAbilities(builder, sheet);
  const levels = dndTotalLevel(builder);
  const rolled = (builder.classes || []).reduce((sum,c)=> sum + (Array.isArray(c?.hpLog) ? c.hpLog.reduce((a,b)=>a+Number(b||0),0) : 0), 0);
  return Math.max(levels, rolled + (dndMod(abilities.Constitution) * levels));
}
function dndSkillSources(builder = {}) {
  const source = Object.fromEntries(Object.keys(DND_SKILL_DATA).map((skill)=>[skill,[]]));
  const add = (skill, label) => { if (source[skill] && !source[skill].includes(label)) source[skill].push(label); };
  (DND_BACKGROUND_SKILLS[builder.background] || []).forEach((skill)=>add(skill, builder.background || "Background"));
  (DND_SPECIES_SKILLS[builder.species] || []).forEach((skill)=>add(skill, builder.species || "Species"));
  (builder.extraSkillProficiencies || []).forEach((skill)=>add(skill, "Proficient"));
  (builder.classes || []).forEach((c)=> Object.values(c?.featureChoices || {}).forEach((text)=> {
    const lower = String(text || "").toLowerCase();
    Object.keys(DND_SKILL_DATA).forEach((skill)=> { if (lower.includes(skill.toLowerCase())) add(skill, c?.name || "Class"); });
  }));
  return source;
}
function dndActionRows(builder = {}) {
  const rows = [{name:"Attack", type:"Action"}];
  (builder.classes || []).forEach((c)=> {
    (DND_CLASS_ACTIONS[c?.name] || []).forEach(([level,name,type])=> { if (Number(c?.level || 0) >= level) rows.push({name,type}); });
  });
  rows.push({name:"Opportunity Attack", type:"Reaction"});
  const seen = new Set();
  return rows.filter((row)=> { const key = row.name; if (seen.has(key)) return false; seen.add(key); return true; });
}
function dndSpellSlots(builder = {}) {
  let caster = 0;
  (builder.classes || []).forEach((c)=> { const kind=DND_CLASS_CASTING[c?.name]; if(kind==="full") caster+=Number(c?.level||0); else if(kind==="half") caster+=Math.floor(Number(c?.level||0)/2); });
  return caster > 0 ? (DND_SPELL_SLOTS_FULL[Math.max(1,Math.min(20,caster))] || []) : [];
}
function dndWeaponAttackMod(meta, abilities, prof, magic) {
  const mods = String(meta?.ability || "Strength").split("/").map((a)=>dndMod(abilities[a]));
  return Math.max(...mods) + prof + Number(magic || 0);
}
function dndWeaponDamage(meta, abilities, magic) {
  const mods = String(meta?.ability || "Strength").split("/").map((a)=>dndMod(abilities[a]));
  const bonus = Math.max(...mods) + Number(magic || 0);
  return `${meta?.damage || "—"}${bonus ? ` ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)}` : ""}`;
}

function renderDndActionList(target, rows, limit = Infinity) {
  if (!target) return;
  target.innerHTML = rows.slice(0, limit).map((row)=>`<div class="dnd-action-row"><span class="dnd-action-symbol">✦</span><div><small>${escapeHtml(row.type)}</small><strong>${escapeHtml(row.name)}</strong></div><span class="dnd-row-chevron">›</span></div>`).join("");
}
function renderDndAttributes(target, builder, sheet, compact = false) {
  if (!target) return;
  const abilities = dndAbilities(builder, sheet);
  const prof = Number(sheet.prof ?? sheet.proficiencyBonus ?? dndProfBonus(builder));
  const firstClass = builder?.classes?.[0]?.name;
  const saves = new Set(DND_CLASS_SAVES[firstClass] || []);
  target.innerHTML = DND_ABILITY_ORDER.map((name)=> {
    const score = abilities[name]; const mod = dndMod(score); const save = mod + (saves.has(name) ? prof : 0);
    return `<div class="dnd-attribute-card${compact ? " is-compact" : ""}"><span>${DND_ABILITY_SHORT[name]}</span><strong>${score}</strong><div><span>Mod ${dndSigned(mod)}</span><span>Save ${dndSigned(save)}</span></div></div>`;
  }).join("");
}
function renderDndSkills(builder, sheet) {
  const target = document.getElementById("dnd-skills-groups"); if (!target) return;
  const abilities = dndAbilities(builder, sheet); const prof = Number(sheet.prof ?? sheet.proficiencyBonus ?? dndProfBonus(builder)); const sources=dndSkillSources(builder);
  target.innerHTML = DND_ABILITY_ORDER.map((ability)=> {
    const skills = Object.keys(DND_SKILL_DATA).filter((s)=>DND_SKILL_DATA[s]===ability);
    const skillHtml = skills.length ? skills.map((skill)=> { const proficient=(sources[skill]||[]).length>0; const value=dndMod(abilities[ability])+(proficient?prof:0); return `<div class="dnd-skill-card"><span>${escapeHtml(skill)}</span><strong>${dndSigned(value)}</strong></div>`; }).join("") : `<div class="dnd-skill-empty">—</div>`;
    return `<section class="dnd-skill-group"><div class="dnd-skill-ability"><span>${escapeHtml(ability)}</span><strong>${abilities[ability]}</strong><small>Mod ${dndSigned(dndMod(abilities[ability]))}</small></div><div class="dnd-skill-boxes">${skillHtml}</div></section>`;
  }).join("");
}
function renderDndWeapons(builder, sheet) {
  const target=document.getElementById("dnd-weapons-list"); const summary=document.getElementById("dnd-weapons-summary"); if(!target) return;
  const abilities=dndAbilities(builder,sheet); const prof=Number(sheet.prof ?? sheet.proficiencyBonus ?? dndProfBonus(builder)); const weapons=Array.isArray(builder.weapons)?builder.weapons:[];
  if(summary) summary.innerHTML=`<div><span>Attack Bonus</span><strong>${weapons.length ? dndSigned(dndWeaponAttackMod(DND_WEAPON_META[weapons[0]?.name]||{},abilities,prof,weapons[0]?.magic)) : "—"}</strong></div><div><span>Proficiency</span><strong>${dndSigned(prof)}</strong></div>`;
  target.innerHTML = weapons.length ? weapons.map((weapon)=> { const meta=DND_WEAPON_META[weapon?.name]||{ability:"Strength",damage:"—",type:"Weapon",properties:[]}; const attack=dndWeaponAttackMod(meta,abilities,prof,weapon?.magic); return `<article class="dnd-weapon-card"><div class="dnd-weapon-mark">⚔</div><div class="dnd-weapon-main"><h3>${escapeHtml(meta.label||weapon?.name||"Weapon")}</h3><div class="dnd-weapon-tags">${(meta.properties||[]).map((p)=>`<span>${escapeHtml(p)}</span>`).join("")}</div></div><div class="dnd-weapon-stat"><span>Attack</span><strong>${dndSigned(attack)}</strong></div><div class="dnd-weapon-stat"><span>Damage</span><strong>${escapeHtml(dndWeaponDamage(meta,abilities,weapon?.magic))}</strong></div><div class="dnd-weapon-stat"><span>Type</span><strong>${escapeHtml(meta.type||"—")}</strong>${meta.range?`<small>${escapeHtml(meta.range)}</small>`:""}</div></article>`; }).join("") : `<div class="dnd-empty-card">No weapons</div>`;
}
function renderDndSpells(builder) {
  const slotsTarget=document.getElementById("dnd-spell-slots"); const listTarget=document.getElementById("dnd-spells-list"); if(!slotsTarget||!listTarget)return;
  const slots=dndSpellSlots(builder); const active=slots.map((n,i)=>({level:i+1,count:n})).filter((x)=>x.count>0);
  slotsTarget.innerHTML = active.length ? active.map((x)=>`<div class="dnd-slot-card"><span>Lv ${x.level}</span><div class="dnd-slot-diamonds">${Array.from({length:x.count},()=>'<b>◆</b>').join("")}</div><strong>${x.count} / ${x.count}</strong></div>`).join("") : `<div class="dnd-empty-card">No spell slots</div>`;
  const spells=Array.isArray(builder.spells)?builder.spells:[]; const grouped={}; spells.forEach((s)=>{ const lvl=Number(s?.level||0); (grouped[lvl] ||= []).push(s); });
  const groups=[]; if(grouped[0]?.length) groups.push([0,"Cantrips",grouped[0]]); Object.keys(grouped).map(Number).filter((n)=>n>0).sort((a,b)=>a-b).forEach((lvl)=>groups.push([lvl,`Level ${lvl} Spells`,grouped[lvl]]));
  listTarget.innerHTML = groups.length ? groups.map(([lvl,label,items])=>`<section class="dnd-spell-group"><div class="dnd-spell-group-title"><h3>${label}</h3><span>${items.length}</span></div><div class="dnd-spell-card-grid">${items.map((spell)=>{ const meta=DND_SPELL_META[spell?.name]||{school:"Spell",time:"—",range:"—",tags:[]}; return `<article class="dnd-spell-card"><h4>${escapeHtml(spell?.name||"Spell")}</h4><small>${escapeHtml(meta.school)}</small><div class="dnd-spell-meta"><span>${escapeHtml(meta.time)}</span><span>${escapeHtml(meta.range)}</span></div><div class="dnd-spell-tags">${(meta.tags||[]).map((tag)=>`<span>${escapeHtml(tag)}</span>`).join("")}<span>${lvl===0?"Cantrip":`Level ${lvl}`}</span></div></article>`;}).join("")}</div></section>`).join("") : `<div class="dnd-empty-card">No cantrips or spells</div>`;
}
function renderDndProfile(builder, sheet) {
  const target=document.getElementById("dnd-profile-content"); if(!target)return;
  const classes=Array.isArray(builder.classes)?builder.classes:[]; const classText=classes.map((c)=>`${c?.name||"Class"} ${c?.level||1}`).join(" / ")||sheet.classSummary||"—";
  const subclass=classes.map((c)=>c?.subclass).filter(Boolean).join(" / "); const money=builder.money||{}; const profs=builder.proficiencies||{};
  const features=[...(builder.feats||[]),...(builder.features?String(builder.features).split(/\n|,/).map((x)=>x.trim()).filter(Boolean):[])].join(", ")||"—";
  const moneyHtml=["PP","GP","EP","SP","CP"].map((k)=>`<div><span>${k}</span><strong>${Number(money[k.toLowerCase()]||0)}</strong></div>`).join("");
  target.innerHTML=`
    <div class="dnd-profile-top">
      <article><span>Class</span><strong>${escapeHtml(classText)}</strong>${subclass?`<small>${escapeHtml(subclass)}</small>`:""}</article>
      <article><span>Race</span><strong>${escapeHtml(builder.species||"—")}</strong></article>
      <article><span>Background</span><strong>${escapeHtml(builder.background||"—")}</strong></article>
      <article><span>Alignment</span><strong>${escapeHtml(builder.alignment||"—")}</strong></article>
    </div>
    <article class="dnd-profile-wide"><span>Experience</span><strong>${escapeHtml(builder.experience ?? "0")}</strong></article>
    <article class="dnd-profile-wide"><span>Features</span><strong>${escapeHtml(features)}</strong></article>
    <section class="dnd-proficiency-card"><h3>Proficiencies</h3><div><article><span>Armor</span><strong>${escapeHtml(profs.armor||"—")}</strong></article><article><span>Weapons</span><strong>${escapeHtml(profs.weapons||"—")}</strong></article><article><span>Tools</span><strong>${escapeHtml(profs.tools||"—")}</strong></article><article><span>Languages</span><strong>${escapeHtml(profs.languages||"—")}</strong></article></div></section>
    <div class="dnd-profile-pair"><article><span>Equipment</span><strong>${escapeHtml(builder.equipment||"—")}</strong></article><article><span>Money</span><div class="dnd-money-grid">${moneyHtml}</div></article></div>
    <div class="dnd-profile-pair"><article><span>Personal Traits</span><strong>${escapeHtml(builder.personalTraits||"—")}</strong></article><article><span>Ideals</span><strong>${escapeHtml(builder.ideals||"—")}</strong></article></div>
    <div class="dnd-profile-pair"><article><span>Bonds</span><strong>${escapeHtml(builder.bonds||"—")}</strong></article><article><span>Flaws</span><strong>${escapeHtml(builder.flaws||"—")}</strong></article></div>
    <article class="dnd-profile-wide"><span>Notes</span><strong>${escapeHtml(builder.notes||"—")}</strong></article>`;
}
function updateDndHpView(builder = currentDndBuilderData || {}, sheet = getCurrentSheetCache() || {}) {
  const current=Number(sheet.currentHp ?? sheet.hp ?? document.getElementById("player-hp")?.value ?? 0); const max=dndMaxHpFromBuilder(builder,sheet);
  const currentEl=document.getElementById("dnd-current-hp-display"), maxEl=document.getElementById("dnd-max-hp-display"), fill=document.getElementById("dnd-hp-fill");
  if(currentEl) currentEl.textContent=Number.isFinite(current)?String(current):"—"; if(maxEl) maxEl.textContent=max>0?String(max):"—";
  if(fill){ const pct=max>0?Math.max(0,Math.min(100,(current/max)*100)):0; fill.style.width=`${pct}%`; fill.parentElement?.setAttribute("aria-valuenow",String(Math.max(0,current||0))); fill.parentElement?.setAttribute("aria-valuemax",String(max||0)); }
}
function renderDndDashboard(builder = currentDndBuilderData || {}, sheet = getCurrentSheetCache() || {}) {
  if(mode!=="dnd" || !document.getElementById("dnd-sheet-app")) return;
  currentDndBuilderData=builder||{}; const abilities=dndAbilities(builder,sheet); const level=dndTotalLevel(builder); const classes=(builder.classes||[]); const classNames=classes.map((c)=>c?.name).filter(Boolean).join(" / ")||"D&D"; const subclass=classes.map((c)=>c?.subclass).filter(Boolean).join(" / ");
  const title=document.getElementById("dnd-character-title"); if(title) title.textContent=builder.name||sheet.name||sheet.playerName||"Character";
  const subtitle=document.getElementById("dnd-character-subtitle"); if(subtitle) subtitle.textContent=[`Level ${level}`,builder.species,classNames,subclass].filter(Boolean).join("  •  ");
  updateDndHpView(builder,sheet);
  const init=Number(sheet.initiativeBonus ?? dndMod(abilities.Dexterity)); const prof=Number(sheet.prof ?? sheet.proficiencyBonus ?? dndProfBonus(builder));
  const setText=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=value; };
  setText("dnd-view-initiative",dndSigned(init)); setText("dnd-view-speed",`${DND_SPECIES_SPEED[builder.species] ?? 30} ft`); setText("dnd-view-hit-dice",dndHitDiceSummary(builder)); setText("dnd-view-ac",String(sheet.ac ?? "—")); setText("dnd-view-prof",dndSigned(prof));
  renderDndActionList(document.getElementById("dnd-overview-actions"),dndActionRows(builder),4); renderDndActionList(document.getElementById("dnd-actions-full"),dndActionRows(builder));
  renderDndAttributes(document.getElementById("dnd-overview-attributes"),builder,sheet,true); renderDndAttributes(document.getElementById("dnd-attributes-full"),builder,sheet,false);
  renderDndSkills(builder,sheet); renderDndWeapons(builder,sheet); renderDndSpells(builder); renderDndProfile(builder,sheet);
  const initInput=document.getElementById("dnd-initiative-input"); if(initInput && document.activeElement!==initInput) initInput.value=document.getElementById("player-initiative")?.value||"";
  syncDndViewportHeight();
}
function syncDndViewportHeight() {
  const track = document.getElementById("dnd-sheet-track");
  const viewport = track?.parentElement;
  const page = track?.querySelectorAll("[data-dnd-page]")?.[currentDndPageIndex];
  if (!viewport || !page) return;
  requestAnimationFrame(() => { viewport.style.height = `${page.scrollHeight}px`; });
}
function goToDndPage(indexOrKey, smooth = true) {
  const app=document.getElementById("dnd-sheet-app"), track=document.getElementById("dnd-sheet-track"); if(!app||!track)return;
  const pages=Array.from(track.querySelectorAll("[data-dnd-page]")); const tabs=Array.from(app.querySelectorAll("[data-dnd-tab]")); const dots=Array.from(app.querySelectorAll(".dnd-sheet-dot")); if(!pages.length)return;
  let index=typeof indexOrKey==="string"?pages.findIndex((p)=>p.dataset.dndPage===indexOrKey):Number(indexOrKey); if(index<0)index=0; index=((index%pages.length)+pages.length)%pages.length; currentDndPageIndex=index;
  track.style.transition=smooth?"transform .32s ease":"none"; track.style.transform=`translateX(-${index*100}%)`; pages.forEach((p,i)=>p.classList.toggle("is-active",i===index)); const key=pages[index].dataset.dndPage;
  tabs.forEach((tab)=>{ const active=tab.dataset.dndTab===key; tab.classList.toggle("is-active",active); tab.setAttribute("aria-selected",String(active)); if(active) tab.scrollIntoView({behavior:smooth?"smooth":"auto",block:"nearest",inline:"center"}); }); dots.forEach((dot,i)=>dot.classList.toggle("is-active",i===index));
  syncDndViewportHeight();
  if (smooth) setTimeout(syncDndViewportHeight, 360);
}
function setupDndSheetCarousel() {
  const app=document.getElementById("dnd-sheet-app"), track=document.getElementById("dnd-sheet-track"); if(!app||!track)return; app.hidden=false;
  const effects=document.getElementById("player-effects-panel"), trackers=document.getElementById("player-trackers-panel"), notes=document.getElementById("player-shared-notes-panel");
  if(effects) document.getElementById("dnd-effects-mount")?.appendChild(effects); if(trackers) document.getElementById("dnd-trackers-mount")?.appendChild(trackers); if(notes) document.getElementById("dnd-notes-mount")?.appendChild(notes);
  app.querySelectorAll("[data-dnd-tab]").forEach((tab)=>tab.addEventListener("click",()=>goToDndPage(tab.dataset.dndTab)));
  app.querySelectorAll("[data-dnd-go]").forEach((button)=>button.addEventListener("click",()=>goToDndPage(button.dataset.dndGo)));
  document.getElementById("dnd-sheet-prev")?.addEventListener("click",()=>goToDndPage(currentDndPageIndex-1)); document.getElementById("dnd-sheet-next")?.addEventListener("click",()=>goToDndPage(currentDndPageIndex+1));
  app.querySelectorAll("[data-open-dnd-builder]").forEach((button)=>button.addEventListener("click",()=>{ window.location.href=`dnd_character_builder_firebase.html?code=${encodeURIComponent(code)}`; }));
  let startX=null; track.addEventListener("pointerdown",(e)=>{ if(e.pointerType==="mouse" && window.innerWidth>720)return; startX=e.clientX; }); track.addEventListener("pointerup",(e)=>{ if(startX===null)return; const delta=e.clientX-startX; startX=null; if(Math.abs(delta)<45)return; goToDndPage(currentDndPageIndex+(delta<0?1:-1)); });
  document.getElementById("dnd-overview-text-dm")?.addEventListener("click",()=>goToDndPage("notes"));
  document.getElementById("dnd-initiative-input")?.addEventListener("input",(e)=>{ const hidden=document.getElementById("player-initiative"); if(hidden) hidden.value=e.target.value; });
  document.getElementById("dnd-save-initiative-button")?.addEventListener("click",saveInitiativeToGame);
  window.addEventListener("resize", syncDndViewportHeight, { passive:true });
  goToDndPage(0,false);
}

setupPlayerMobileCarousels();

function playerSheetPath() {
  return `games/${code}/players/${user.uid}`;
}

function playerEntryPath() {
  return `games/${code}/entries/${user.uid}`;
}

function sharedNotePath() {
  // Keep shared DM/player notes inside the player's own character node.
  // This inherits the same Firebase permissions the player already uses for
  // games/{code}/players/{uid}, avoiding a separate participantNotes rule.
  return `games/${code}/players/${user.uid}/sharedNote`;
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

function normalizeSharedNote(value) {
  if (!value) {
    return {
      text: "", updatedAt: 0, updatedByRole: "", updatedByName: "",
      pingActive: false, pingEligible: false, pingedAt: 0, pingedNoteUpdatedAt: 0, dmReadAt: 0
    };
  }
  if (typeof value === "string") {
    return {
      text: value, updatedAt: 0, updatedByRole: "", updatedByName: "",
      pingActive: false, pingEligible: false, pingedAt: 0, pingedNoteUpdatedAt: 0, dmReadAt: 0
    };
  }
  return {
    text: String(value.text || ""),
    updatedAt: Number(value.updatedAt) || 0,
    updatedByRole: String(value.updatedByRole || ""),
    updatedByName: String(value.updatedByName || ""),
    pingActive: value.pingActive === true,
    pingEligible: value.pingEligible === true,
    pingedAt: Number(value.pingedAt) || 0,
    pingedNoteUpdatedAt: Number(value.pingedNoteUpdatedAt) || 0,
    dmReadAt: Number(value.dmReadAt) || 0
  };
}

function formatSharedNoteMeta(note) {
  if (!note.updatedAt) return "";
  return new Date(note.updatedAt).toLocaleString();
}

let currentSharedNote = normalizeSharedNote(null);

function canPingDm(note = currentSharedNote) {
  return note.pingEligible === true
    && note.updatedByRole === "player"
    && note.text.trim().length > 0
    && note.updatedAt > note.pingedNoteUpdatedAt;
}

function renderPingState(note = currentSharedNote) {
  if (!playerPingDmBtn) return;
  const ready = canPingDm(note);
  playerPingDmBtn.disabled = !ready;
  playerPingDmBtn.classList.toggle("is-ready", ready);

  if (!playerPingDmStatusEl) return;
  if (ready) {
    playerPingDmStatusEl.textContent = "Ready";
  } else if (note.pingActive) {
    playerPingDmStatusEl.textContent = "Ping sent";
  } else if (note.dmReadAt && note.dmReadAt >= note.pingedAt && note.pingedAt) {
    playerPingDmStatusEl.textContent = "Read";
  } else {
    playerPingDmStatusEl.textContent = "";
  }
}

function renderSharedNote(value) {
  const note = normalizeSharedNote(value);
  currentSharedNote = note;
  if (playerSharedNotesEl && document.activeElement !== playerSharedNotesEl) {
    playerSharedNotesEl.value = note.text;
  }
  if (playerSharedNotesMetaEl) playerSharedNotesMetaEl.textContent = formatSharedNoteMeta(note);
  const dndPreview = document.getElementById("dnd-overview-note-preview");
  if (dndPreview) dndPreview.textContent = note.text || "—";
  renderPingState(note);
}

async function saveSharedNote() {
  if (!playerSharedNotesEl) return;
  if (playerSharedNotesStatusEl) playerSharedNotesStatusEl.textContent = "Saving…";

  try {
    const nextText = playerSharedNotesEl.value;
    if (nextText === currentSharedNote.text) {
      if (playerSharedNotesStatusEl) playerSharedNotesStatusEl.textContent = "No changes to save.";
      return;
    }

    const shared = getSharedValues();
    await update(ref(db, sharedNotePath()), {
      text: nextText,
      updatedAt: Date.now(),
      updatedByUid: user.uid,
      updatedByRole: "player",
      updatedByName: shared.name || "Player",
      pingEligible: true
    });
    if (playerSharedNotesStatusEl) playerSharedNotesStatusEl.textContent = "Saved";
  } catch (error) {
    console.error("Could not save shared note:", error);
    if (playerSharedNotesStatusEl) playerSharedNotesStatusEl.textContent = error.message || "Could not save note.";
  }
}

async function pingDm() {
  if (!canPingDm(currentSharedNote)) {
    if (playerPingDmStatusEl) playerPingDmStatusEl.textContent = "";
    return;
  }

  if (playerPingDmStatusEl) playerPingDmStatusEl.textContent = "Pinging DM…";
  try {
    const now = Date.now();
    await update(ref(db, sharedNotePath()), {
      pingActive: true,
      pingEligible: false,
      pingedAt: now,
      pingedNoteUpdatedAt: currentSharedNote.updatedAt,
      pingedByUid: user.uid
    });
    if (playerPingDmStatusEl) playerPingDmStatusEl.textContent = "Ping sent";
  } catch (error) {
    console.error("Could not ping DM:", error);
    if (playerPingDmStatusEl) playerPingDmStatusEl.textContent = error.message || "Could not ping DM.";
  }
}

let hasLivePlayerSheet = false;

function startSharedPlayerWatchers() {
  onValue(ref(db, sharedNotePath()), (snapshot) => {
    renderSharedNote(snapshot.exists() ? snapshot.val() : null);
  }, (error) => {
    console.error("Could not watch shared note:", error);
  });

  onValue(ref(db, playerSheetPath()), (snapshot) => {
    hasLivePlayerSheet = snapshot.exists();
    if (!snapshot.exists()) return;

    const data = snapshot.val() || {};
    setCurrentSheetCache(data);
    if (mode === "dnd") {
      setDndValues(data);
      renderDndDashboard(currentDndBuilderData || {}, data);
    } else {
      renderOpenLegendAttributes(data.attributes ?? {});
      const fatiguePoints = data?.fatigue?.points ?? getCurrentFatigue();
      setPlayerBanes(syncFatigueLinkedBanes(data.banes ?? [], fatiguePoints));
      setPlayerFatigue(fatiguePoints);
    }
  }, (error) => {
    console.error("Could not watch player sheet status:", error);
  });

  if (mode === "dnd") {
    onValue(ref(db, dndBuilderSheetPath()), (snapshot) => {
      currentDndBuilderData = snapshot.exists() ? (snapshot.val() || {}) : {};
      renderDndDashboard(currentDndBuilderData, getCurrentSheetCache() || {});
    }, (error) => {
      console.error("Could not watch D&D builder sheet:", error);
    });
  }

  onValue(ref(db, playerEntryPath()), (snapshot) => {
    if (hasLivePlayerSheet || !snapshot.exists()) return;
    const data = snapshot.val() || {};
    if (mode === "dnd") {
      setPlayerEffects(data.effects ?? []);
    } else {
      const fatiguePoints = data?.fatigue?.points ?? getCurrentFatigue();
      setPlayerBanes(syncFatigueLinkedBanes(data.banes ?? [], fatiguePoints));
      setPlayerFatigue(fatiguePoints);
    }
  }, (error) => {
    console.error("Could not watch initiative entry status:", error);
  });
}

function getCurrentSheetCache() {
  return window.__playerSheetCache || null;
}

function setCurrentSheetCache(data) {
  window.__playerSheetCache = data || null;
}

const OPEN_LEGEND_ATTRIBUTE_ORDER = [
  "Agility", "Fortitude", "Might", "Learning", "Logic", "Perception",
  "Will", "Deception", "Persuasion", "Presence",
  "Alteration", "Creation", "Energy", "Entropy", "Influence", "Movement", "Prescience", "Protection"
];

function openLegendAttributeDie(score) {
  const value = Number(score);
  const diceMap = {
    0: "—", 1: "1d4", 2: "1d6", 3: "1d8", 4: "1d10",
    5: "2d6", 6: "2d8", 7: "2d10", 8: "3d8", 9: "3d10", 10: "4d8"
  };
  return Number.isFinite(value) ? (diceMap[value] || "—") : "—";
}

function renderOpenLegendAttributes(attributes = {}) {
  const grid = document.getElementById("player-openlegend-attributes-grid");
  if (!grid) return;
  grid.replaceChildren();

  const raw = attributes && typeof attributes === "object" ? attributes : {};
  const seen = new Set();
  const rows = [];

  OPEN_LEGEND_ATTRIBUTE_ORDER.forEach((name) => {
    if (Object.prototype.hasOwnProperty.call(raw, name)) {
      rows.push([name, Number(raw[name]) || 0]);
      seen.add(name);
    }
  });
  Object.entries(raw)
    .filter(([name]) => !seen.has(name))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([name, value]) => rows.push([name, Number(value) || 0]));

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No attributes saved.";
    grid.appendChild(empty);
    return;
  }

  rows.forEach(([name, value]) => {
    const card = document.createElement("div");
    card.className = "ol-attribute-card";
    card.innerHTML = `
      <span class="ol-attribute-name">${name}</span>
      <strong class="ol-attribute-score">${value}</strong>
      <span class="ol-attribute-die">${openLegendAttributeDie(value)}</span>
    `;
    grid.appendChild(card);
  });
}

function getCurrentBanes() {
  return normalizeBanes(getCurrentSheetCache()?.banes);
}

function getCurrentEffects() {
  return normalizeEffects(getCurrentSheetCache()?.effects);
}

function getCurrentFatigue() {
  return clampFatigueLevel(getCurrentSheetCache()?.fatigue?.points ?? 0);
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

function setPlayerFatigue(points) {
  const safePoints = clampFatigueLevel(points);
  const existing = getCurrentSheetCache() || {};
  setCurrentSheetCache({
    ...existing,
    fatigue: {
      ...(existing.fatigue || {}),
      points: safePoints
    }
  });
  renderPlayerFatigue(safePoints);
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

function renderPlayerFatigue(points = 0) {
  const safePoints = clampFatigueLevel(points);
  const input = document.getElementById("player-fatigue-value");
  if (input) input.value = String(safePoints);
  if (playerFatigueLevelDisplayEl) {
    playerFatigueLevelDisplayEl.textContent = String(safePoints);
  }
  if (playerFatigueSpecialTextEl) {
    playerFatigueSpecialTextEl.textContent = FATIGUE_DATA.special || "";
  }

  const activeLevels = getFatigueLevels(safePoints);
  if (playerFatigueSummaryTextEl) {
    playerFatigueSummaryTextEl.textContent = "";
  }

  if (!playerFatigueViewEl) return;

  if (!activeLevels.length) {
    playerFatigueViewEl.innerHTML = '<span class="muted fatigue-empty">No fatigue levels active.</span>';
    return;
  }

  playerFatigueViewEl.innerHTML = "";
  activeLevels.forEach((description, index) => {
    const card = document.createElement("div");
    card.className = "fatigue-level-card";
    card.innerHTML = `
      <h3>Level ${index + 1}</h3>
      <p>${description}</p>
    `;
    playerFatigueViewEl.appendChild(card);
  });
}

function closeBanePickerModal() {
  document.getElementById("bane-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeBanesModal() {
  document.getElementById("banes-modal")?.setAttribute("aria-hidden", "true");
}

function closeBaneDetailModal() {
  document.getElementById("bane-detail-modal")?.setAttribute("aria-hidden", "true");
}

function closeFatigueModal() {
  document.getElementById("fatigue-modal")?.setAttribute("aria-hidden", "true");
}

function openFatigueModal() {
  renderPlayerFatigue(getCurrentFatigue());
  document.getElementById("fatigue-modal")?.setAttribute("aria-hidden", "false");
}

function sanitizeBaneLookup(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findOpenLegendBaneEntry(bane) {
  const rawName = typeof bane === "string" ? bane : bane?.name;
  const rawUrl = typeof bane === "string" ? "" : bane?.url;
  const rawSlug = String(rawUrl || "").split("/").filter(Boolean).pop() || "";
  const key = sanitizeBaneLookup(rawName);
  const slugKey = sanitizeBaneLookup(rawSlug);
  return OPENLEGEND_BANES.find((entry) => (
    sanitizeBaneLookup(entry.name) === key
    || sanitizeBaneLookup(entry.id) === key
    || sanitizeBaneLookup(entry.slug) === key
    || sanitizeBaneLookup(entry.slug) === slugKey
  )) || null;
}

function openBaneDetailModal(bane) {
  const modal = document.getElementById("bane-detail-modal");
  const title = document.getElementById("bane-detail-modal-title");
  const content = document.getElementById("bane-detail-modal-content");
  if (!modal || !content) return;

  const entry = findOpenLegendBaneEntry(bane);
  const name = entry?.name || bane?.name || "Bane";
  const icon = entry?.icon || bane?.icon || "../icons/banes/test.png";
  const summary = entry?.summary || "—";
  const description = entry?.descriptionHtml || entry?.description || "No local bane details available.";
  const effect = entry?.effectHtml || "";
  const special = entry?.specialHtml || "";
  const attackAttributes = Array.isArray(entry?.attackAttributes) && entry.attackAttributes.length
    ? entry.attackAttributes.join(", ")
    : "—";
  const attackLines = Array.isArray(entry?.attackLines) && entry.attackLines.length
    ? entry.attackLines.join("<br>")
    : "—";
  const duration = entry?.duration || "—";
  const invocationTime = entry?.invocationTime || "—";
  const powerLevel = entry?.powerLevel || "—";
  const url = entry?.url || bane?.url || "";

  if (title) title.textContent = name;
  content.innerHTML = `
    <div class="bane-picker-row" style="display:block;">
      <div class="bane-picker-left" style="margin-bottom:12px;">
        <img class="bane-icon" src="${icon}" alt="${name}">
        <strong>${name}</strong>
      </div>
      <p class="muted" style="margin:0 0 12px 0;">${summary}</p>
      <div class="formula-list" style="margin-bottom:16px;">
        <div class="formula-row"><span>Duration</span><span>${duration}</span></div>
        <div class="formula-row"><span>Invocation Time</span><span>${invocationTime}</span></div>
        <div class="formula-row"><span>Power Level</span><span>${powerLevel}</span></div>
        <div class="formula-row"><span>Attack Attributes</span><span>${attackAttributes}</span></div>
        <div class="formula-row"><span>Attack</span><span>${attackLines}</span></div>
      </div>
      <h4 style="margin:16px 0 8px;">Description</h4>
      <div>${description}</div>
      ${effect ? `<h4 style="margin:16px 0 8px;">Effect</h4><div>${effect}</div>` : ""}
      ${special ? `<h4 style="margin:16px 0 8px;">Special</h4><div>${special}</div>` : ""}
      ${url ? `<p style="margin-top:16px;"><a class="button-link" target="_blank" rel="noopener" href="${url}">Official page</a></p>` : ""}
    </div>
  `;
  modal.setAttribute("aria-hidden", "false");
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

    const left = document.createElement("div");
    left.className = "bane-picker-left";

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

    left.appendChild(icon);
    left.appendChild(name);
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

    left.appendChild(icon);
    left.appendChild(name);
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

function getSlowedBaneTemplate() {
  return BANES.find((bane) => String(bane?.name || "").toLowerCase() === "slowed") || {
    name: "Slowed",
    url: "https://openlegendrpg.com/bane/slowed",
    icon: "../icons/banes/slowed.png"
  };
}

function syncFatigueLinkedBanes(banes, fatiguePoints) {
  const safeBanes = normalizeBanes(banes);
  const needsSlowed = hasFatigueSlowedLink(fatiguePoints);
  const slowedName = "slowed";
  const manualOrNormalSlowed = safeBanes.find((bane) => (
    String(bane?.name || "").toLowerCase() === slowedName && !bane?.autoFromFatigue
  ));
  let next = safeBanes.filter((bane) => !(bane?.autoFromFatigue && String(bane?.name || "").toLowerCase() === slowedName));

  if (needsSlowed && !manualOrNormalSlowed) {
    const slowed = getSlowedBaneTemplate();
    next = [
      ...next,
      {
        name: slowed.name,
        url: slowed.url,
        icon: slowed.icon || "../icons/banes/slowed.png",
        key: sanitizeBaneKey(`${slowed.name}-fatigue-auto`),
        autoFromFatigue: true
      }
    ];
  }

  return next;
}

async function persistPlayerBanes(banes, statusMessage = "Banes updated.") {
  const existing = (await getCurrentSheet()) || {};
  const payload = buildSheetPayload(existing);
  payload.banes = syncFatigueLinkedBanes(banes, payload.fatigue?.points ?? getCurrentFatigue());
  payload.statusUpdatedAt = Date.now();
  payload.updatedAt = Date.now();

  await set(ref(db, playerSheetPath()), payload);
  const entrySnap = await get(ref(db, playerEntryPath()));
  if (entrySnap.exists()) {
    await update(ref(db, playerEntryPath()), {
      banes: payload.banes,
      statusUpdatedAt: payload.statusUpdatedAt
    });
  }
  setCurrentSheetCache(payload);
  renderPlayerBanes(payload.banes);
  renderPlayerFatigue(payload.fatigue?.points ?? 0);
  statusEl.textContent = statusMessage;
}

async function persistPlayerEffects(effects, statusMessage = "Effects updated.") {
  const existing = (await getCurrentSheet()) || {};
  const payload = buildSheetPayload(existing);
  payload.effects = normalizeEffects(effects);
  payload.statusUpdatedAt = Date.now();
  payload.updatedAt = Date.now();

  await set(ref(db, playerSheetPath()), payload);
  const entrySnap = await get(ref(db, playerEntryPath()));
  if (entrySnap.exists()) {
    await update(ref(db, playerEntryPath()), {
      effects: payload.effects,
      statusUpdatedAt: payload.statusUpdatedAt
    });
  }
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

async function persistPlayerFatigue(points, statusMessage = "Fatigue updated.") {
  const safePoints = clampFatigueLevel(points);
  const existing = (await getCurrentSheet()) || {};
  const payload = buildSheetPayload(existing);
  payload.fatigue = {
    ...(payload.fatigue || {}),
    name: FATIGUE_DATA.name,
    points: safePoints,
    levels: getFatigueLevels(safePoints)
  };
  payload.banes = syncFatigueLinkedBanes(payload.banes, safePoints);
  payload.updatedAt = Date.now();

  await set(ref(db, playerSheetPath()), payload);
  const entrySnap = await get(ref(db, playerEntryPath()));
  if (entrySnap.exists()) {
    await update(ref(db, playerEntryPath()), {
      fatigue: payload.fatigue,
      banes: payload.banes
    });
  }
  setCurrentSheetCache(payload);
  renderPlayerFatigue(safePoints);
  renderPlayerBanes(payload.banes);
  statusEl.textContent = statusMessage;
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

function getInitiativeFormulaDisplay(data = {}) {
  if (data.initiativeFormula) return String(data.initiativeFormula);

  const die = data.initiativeDie;
  const bonus = Number(data.initiativeBonus);

  if (die) {
    return `${String(die).toLowerCase()}${Number.isFinite(bonus) ? (bonus >= 0 ? `+${bonus}` : `${bonus}`) : ""}`;
  }

  return "—";
}

function setInitiativeFormulaDisplay(data = {}) {
  const el = document.getElementById("player-initiative-formula");
  if (!el) return;
  el.textContent = getInitiativeFormulaDisplay(data);
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
    data.initiative ?? data.number ?? data.initiativeBonus ?? "";
  const dndInitiativeInput = document.getElementById("dnd-initiative-input");
  if (dndInitiativeInput && document.activeElement !== dndInitiativeInput) {
    dndInitiativeInput.value = document.getElementById("player-initiative").value;
  }

  setInitiativeFormulaDisplay(data);
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
  renderDndDashboard(currentDndBuilderData || {}, { ...(getCurrentSheetCache() || {}), ...data });
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

function updateOlHpBar() {
  const currentEl = document.getElementById("player-ol-current-hp");
  const maxEl = document.getElementById("player-ol-max-hp");
  const fillEl = document.getElementById("player-ol-hp-fill");
  const barEl = fillEl?.parentElement;
  if (!currentEl || !maxEl || !fillEl || !barEl) return;

  const current = numberOrNull(currentEl.textContent);
  const max = numberOrNull(maxEl.textContent);
  const valid = current !== null && max !== null && max > 0;
  const percent = valid ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  fillEl.style.width = `${percent}%`;
  fillEl.classList.toggle("is-low", valid && percent <= 25);
  fillEl.classList.toggle("is-mid", valid && percent > 25 && percent <= 50);
  barEl.setAttribute("aria-valuenow", String(valid ? Math.max(0, current) : 0));
  if (valid) barEl.setAttribute("aria-valuemax", String(max));
  else barEl.removeAttribute("aria-valuemax");
}

function setOlMaxHp(value) {
  const el = document.getElementById("player-ol-max-hp");
  if (!el) return;
  el.textContent = value === null || value === undefined || value === "" || Number(value) <= 0 ? "—" : String(value);
  updateOlHpBar();
}

function setOlCurrentHp(value) {
  const el = document.getElementById("player-ol-current-hp");
  if (!el) return;
  el.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
  updateOlHpBar();
}

function getOlLethalValue() {
  return parseNumber(document.getElementById("player-ol-lethal")?.value, 0);
}

function setOlLethalValue(value) {
  const el = document.getElementById("player-ol-lethal");
  if (!el) return;
  el.value = value === null || value === undefined || value === "" ? "" : String(value);
}

function getOpenLegendValues() {
  return {
    currentHp: getOlCurrentHp(),
    lethal: getOlLethalValue(),
    grd: parseNumber(document.getElementById("player-ol-grd-view")?.textContent, 0),
    res: parseNumber(document.getElementById("player-ol-res-view")?.textContent, 0),
    tgh: parseNumber(document.getElementById("player-ol-tgh-view")?.textContent, 0),
    banes: getCurrentBanes(),
    fatigue: {
      name: FATIGUE_DATA.name,
      points: getCurrentFatigue(),
      levels: getFatigueLevels(getCurrentFatigue())
    }
  };
}

function setOpenLegendValues(data = {}) {
  const cached = getCurrentSheetCache() || {};
  setOlMaxHp(data.baseHp ?? data.maxHealth ?? cached.baseHp ?? cached.maxHealth ?? "");
  setOlCurrentHp(data.currentHp ?? "");
  setOlLethalValue(data.lethal ?? "");
  document.getElementById("player-ol-grd-view").textContent = data.grd ?? "—";
  document.getElementById("player-ol-res-view").textContent = data.res ?? "—";
  document.getElementById("player-ol-tgh-view").textContent = data.tgh ?? "—";
  setPlayerBanes(syncFatigueLinkedBanes(data.banes ?? [], data?.fatigue?.points ?? 0));
  setPlayerFatigue(data?.fatigue?.points ?? 0);
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
  const input = document.getElementById("dnd-hp-adjust-input");
  const damage = parseNumber(input?.value, NaN);
  if (Number.isNaN(damage) || damage < 0) {
    setDndResult("Enter a valid amount.");
    return;
  }

  const currentHp = parseNumber(document.getElementById("player-hp").value, 0);
  const nextHp = Math.max(0, currentHp - damage);

  document.getElementById("player-hp").value = nextHp;
  if (input) input.value = "";
  setDndResult(`HP ${nextHp}`);
  updateDndHpView(currentDndBuilderData || {}, { ...(getCurrentSheetCache() || {}), currentHp: nextHp, hp: nextHp });
  scheduleAutoSave("D&D damage applied.");
}

async function healDndHp() {
  const input = document.getElementById("dnd-hp-adjust-input");
  const healAmount = parseNumber(input?.value, NaN);
  if (Number.isNaN(healAmount) || healAmount < 0) {
    setDndResult("Enter a valid amount.");
    return;
  }

  let builderData = currentDndBuilderData;
  if (!builderData || !Object.keys(builderData).length) {
    const builderSnap = await get(ref(db, dndBuilderSheetPath()));
    builderData = builderSnap.exists() ? builderSnap.val() : {};
    currentDndBuilderData = builderData;
  }

  const sheet = getCurrentSheetCache() || {};
  const maxHp = dndMaxHpFromBuilder(builderData || {}, sheet);
  const currentHp = parseNumber(document.getElementById("player-hp").value, 0);
  const nextHp = Math.min(maxHp, currentHp + healAmount);

  document.getElementById("player-hp").value = nextHp;
  if (input) input.value = "";
  setDndResult(`HP ${nextHp}`);
  updateDndHpView(builderData || {}, { ...sheet, currentHp: nextHp, hp: nextHp, baseHp: maxHp });
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
  const lethal = Math.max(0, getOlLethalValue());
  const nextHp = Math.max(0, baseHp - lethal);
  setOlCurrentHp(nextHp);
  setOlResult(lethal > 0 ? `HP reset to ${nextHp} (${baseHp} - ${lethal} lethal).` : "HP reset to base HP.");
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
    const lethal = Math.max(0, getOlLethalValue());
    const maxHp = Math.max(0, baseHp - lethal);
    const currentHp = parseNumber(getOlCurrentHp(), maxHp);
    const nextHp = Math.min(maxHp, currentHp + healAmount);

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
      lethal: ol.lethal,
      grd: ol.grd,
      res: ol.res,
      tgh: ol.tgh,
      banes: ol.banes,
      fatigue: ol.fatigue
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
      renderOpenLegendAttributes(data.attributes ?? {});
      setOpenLegendValues({
        currentHp: data.currentHp ?? "",
        baseHp: data.baseHp ?? data.maxHealth ?? "",
        maxHealth: data.maxHealth ?? "",
        lethal: data.lethal ?? "",
        grd: data.grd ?? "—",
        res: data.res ?? "—",
        tgh: data.tgh ?? "—",
        banes: data.banes ?? [],
        fatigue: data.fatigue ?? { points: 0 }
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
      ...entry,
      name: entry.name ?? entry.playerName ?? user.displayName ?? "",
      initiative: entry.number ?? entry.initiative ?? entry.initiativeBonus ?? ""
    });

    if (mode === "dnd") {
      setDndValues(entry);
    } else {
      renderOpenLegendAttributes(entry.attributes ?? {});
      setOpenLegendValues({
        currentHp: entry.currentHp ?? "",
        baseHp: entry.baseHp ?? entry.maxHealth ?? "",
        maxHealth: entry.maxHealth ?? "",
        lethal: entry.lethal ?? "",
        grd: entry.grd ?? "—",
        res: entry.res ?? "—",
        tgh: entry.tgh ?? "—",
        banes: entry.banes ?? [],
        fatigue: entry.fatigue ?? { points: 0 }
      });
    }

    renderTrackerList([]);
    statusEl.textContent = "Loaded existing room character data.";
    return;
  }

  setCurrentSheetCache({ name: user.displayName ?? "", banes: [], effects: [], fatigue: { points: 0 } });
  setSharedValues({ name: user.displayName ?? "" });
  if (mode === "dnd") setPlayerEffects([]);
  else {
    renderOpenLegendAttributes({});
    setPlayerBanes([]);
    setPlayerFatigue(0);
  }
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
  const existingEntrySnap = await get(ref(db, playerEntryPath()));
  const existingEntry = existingEntrySnap.exists() ? (existingEntrySnap.val() || {}) : {};
  const previousMaxHealth = Number(existingEntry.maxHealth);
  const hasPreviousMaxHealth = Number.isFinite(previousMaxHealth) && previousMaxHealth > 0;

  const entryPayload = {
    uid: user.uid,
    playerName: shared.name,
    initiative: shared.initiative,
    name: shared.name,
    number: shared.initiative,
    updatedAt: Date.now(),
    statusUpdatedAt: Number(sheetPayload.statusUpdatedAt) || Date.now(),
    banes: mode === "dnd" ? [] : normalizeBanes(sheetPayload.banes),
    effects: mode === "dnd" ? normalizeEffects(sheetPayload.effects) : []
  };

  if (sheetPayload.initiativeDie != null) entryPayload.initiativeDie = sheetPayload.initiativeDie;
  if (sheetPayload.initiativeBonus != null) entryPayload.initiativeBonus = sheetPayload.initiativeBonus;
  if (sheetPayload.initiativeAttribute != null) entryPayload.initiativeAttribute = sheetPayload.initiativeAttribute;
  if (sheetPayload.initiativeFormula != null) entryPayload.initiativeFormula = sheetPayload.initiativeFormula;

  if (mode === "dnd") {
    entryPayload.health = sheetPayload.currentHp ?? sheetPayload.hp ?? "";
    entryPayload.currentHp = sheetPayload.currentHp ?? sheetPayload.hp ?? "";
    const dndBaseHp = Number(sheetPayload.baseHp);
    entryPayload.maxHealth = Number.isFinite(dndBaseHp) && dndBaseHp > 0
      ? dndBaseHp
      : hasPreviousMaxHealth
        ? previousMaxHealth
        : (sheetPayload.hp ?? sheetPayload.currentHp ?? "");
    entryPayload.ac = sheetPayload.ac ?? "";
  } else {
    entryPayload.health = sheetPayload.currentHp ?? "";
    entryPayload.currentHp = sheetPayload.currentHp ?? "";
    const olBaseHp = Number(sheetPayload.baseHp);
    entryPayload.maxHealth = Number.isFinite(olBaseHp) && olBaseHp > 0
      ? olBaseHp
      : hasPreviousMaxHealth
        ? previousMaxHealth
        : (sheetPayload.currentHp ?? "");
    entryPayload.lethal = sheetPayload.lethal ?? 0;
    entryPayload.grd = sheetPayload.grd ?? 0;
    entryPayload.res = sheetPayload.res ?? 0;
    entryPayload.tgh = sheetPayload.tgh ?? 0;
    entryPayload.fatigue = sheetPayload.fatigue ?? { points: 0 };
  }

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
document.getElementById("bane-detail-modal-close")?.addEventListener("click", closeBaneDetailModal);
document.getElementById("bane-picker-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "bane-picker-modal") closeBanePickerModal();
});
document.getElementById("banes-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "banes-modal") closeBanesModal();
});
document.getElementById("bane-detail-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "bane-detail-modal") closeBaneDetailModal();
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

document.getElementById("player-view-fatigue-btn")?.addEventListener("click", openFatigueModal);
document.getElementById("fatigue-modal-close")?.addEventListener("click", closeFatigueModal);
document.getElementById("fatigue-modal")?.addEventListener("click", (e) => {
  if (e.target?.id === "fatigue-modal") closeFatigueModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  if (document.getElementById("bane-picker-modal")?.getAttribute("aria-hidden") === "false") {
    closeBanePickerModal();
  }
  if (document.getElementById("banes-modal")?.getAttribute("aria-hidden") === "false") {
    closeBanesModal();
  }
  if (document.getElementById("bane-detail-modal")?.getAttribute("aria-hidden") === "false") {
    closeBaneDetailModal();
  }
  if (document.getElementById("effect-picker-modal")?.getAttribute("aria-hidden") === "false") {
    closeEffectPickerModal();
  }
  if (document.getElementById("effects-modal")?.getAttribute("aria-hidden") === "false") {
    closeEffectsModal();
  }
  if (document.getElementById("fatigue-modal")?.getAttribute("aria-hidden") === "false") {
    closeFatigueModal();
  }
});

document.getElementById("player-fatigue-up-btn")?.addEventListener("click", async () => {
  await persistPlayerFatigue(getCurrentFatigue() + 1, "Fatigue increased.");
});

document.getElementById("player-fatigue-down-btn")?.addEventListener("click", async () => {
  await persistPlayerFatigue(getCurrentFatigue() - 1, "Fatigue decreased.");
});

document.getElementById("player-fatigue-value")?.addEventListener("input", async (e) => {
  await persistPlayerFatigue(e.target?.value ?? 0, "Fatigue updated.");
});

saveInitiativeBtn?.addEventListener("click", saveInitiativeToGame);
playerSharedNotesSaveBtn?.addEventListener("click", saveSharedNote);
playerPingDmBtn?.addEventListener("click", pingDm);

document.getElementById("dnd-apply-damage-btn")?.addEventListener("click", applyDndDamage);
document.getElementById("dnd-heal-btn")?.addEventListener("click", healDndHp);
document.getElementById("dnd-reset-hp-btn")?.addEventListener("click", resetDndFromBuilder);

document.getElementById("ol-apply-damage-btn")?.addEventListener("click", applyOpenLegendDamage);
document.getElementById("ol-reset-hp-btn")?.addEventListener("click", resetOpenLegendHp);
document.getElementById("ol-heal-btn")?.addEventListener("click", healOpenLegendHp);
document.getElementById("player-ol-lethal")?.addEventListener("input", () => {
  scheduleAutoSave("Open Legend lethal updated.");
});

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
startSharedPlayerWatchers();