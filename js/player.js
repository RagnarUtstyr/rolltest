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
const returnToLobbyLink = document.getElementById("return-to-lobby-link");
if (returnToLobbyLink) returnToLobbyLink.href = `lobby.html?code=${encodeURIComponent(code)}`;

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
  let activeIndex = 0;
  let scrollTimer = null;
  let pointerStartX = null;
  let pointerStartIndex = 0;

  Object.entries(config.placement).forEach(([key, nodes]) => {
    const slot = carousel.querySelector(`[data-carousel-slot="${key}"]`);
    if (!slot) return;
    nodes.filter(Boolean).forEach((node) => slot.appendChild(node));
  });
  carousel.classList.add("is-carousel-active");

  const wrapIndex = (index) => slides.length ? ((index % slides.length) + slides.length) % slides.length : 0;
  function updateActive(nextIndex) {
    activeIndex = wrapIndex(nextIndex);
    const key = slides[activeIndex]?.dataset.carouselSlide;
    tabs.forEach((tab) => {
      const active = tab.dataset.carouselTab === key;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      if (active) tab.scrollIntoView({behavior:"smooth", block:"nearest", inline:"center"});
    });
    dots.forEach((dot,index)=>dot.classList.toggle("is-active", index===activeIndex));
  }
  function goTo(index, smooth=true) {
    if (!slides.length) return;
    updateActive(index);
    const slide=slides[activeIndex];
    track.scrollTo({left:slide.offsetLeft, behavior:smooth?"smooth":"auto"});
  }
  tabs.forEach((tab)=>tab.addEventListener("click",()=>{
    const index=slides.findIndex((slide)=>slide.dataset.carouselSlide===tab.dataset.carouselTab);
    if(index>=0)goTo(index);
  }));
  prevBtn?.addEventListener("click",()=>goTo(activeIndex-1));
  nextBtn?.addEventListener("click",()=>goTo(activeIndex+1));
  track.addEventListener("scroll",()=>{
    clearTimeout(scrollTimer);
    scrollTimer=setTimeout(()=>{
      const center=track.scrollLeft+(track.clientWidth/2); let nearest=0; let distance=Infinity;
      slides.forEach((slide,index)=>{ const d=Math.abs((slide.offsetLeft+slide.offsetWidth/2)-center); if(d<distance){distance=d;nearest=index;} });
      updateActive(nearest);
    },70);
  },{passive:true});
  track.addEventListener("pointerdown",(event)=>{pointerStartX=event.clientX;pointerStartIndex=activeIndex;});
  track.addEventListener("pointerup",(event)=>{
    if(pointerStartX===null)return; const delta=event.clientX-pointerStartX; pointerStartX=null; if(Math.abs(delta)<45)return;
    if(delta<0&&pointerStartIndex===slides.length-1)goTo(0,true); else if(delta>0&&pointerStartIndex===0)goTo(slides.length-1,true);
  });
  window.addEventListener("resize",()=>goTo(activeIndex,false),{passive:true});
  updateActive(0); requestAnimationFrame(()=>goTo(0,false));
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
const DND_SPECIES_FEATURES = {
  Human:["Resourceful","Skillful","Versatile"],
  Dwarf:["Darkvision","Dwarven Resilience","Stonecunning"],
  Elf:["Darkvision","Fey Ancestry","Keen Senses"],
  Halfling:["Brave","Halfling Nimbleness","Luck"],
  Gnome:["Darkvision","Gnomish Cunning"],
  Dragonborn:["Breath Weapon","Draconic Resistance"],
  Orc:["Adrenaline Rush","Darkvision","Relentless Endurance"],
  Tiefling:["Darkvision","Fiendish Legacy"]
};
const DND_CLASS_HD = { Barbarian:12, Bard:8, Cleric:8, Druid:8, Fighter:10, Monk:8, Paladin:10, Ranger:10, Rogue:8, Sorcerer:6, Warlock:8, Wizard:6 };
const DND_CLASS_SAVES = {
  Barbarian:["Strength","Constitution"], Bard:["Dexterity","Charisma"], Cleric:["Wisdom","Charisma"], Druid:["Intelligence","Wisdom"],
  Fighter:["Strength","Constitution"], Monk:["Strength","Dexterity"], Paladin:["Wisdom","Charisma"], Ranger:["Strength","Dexterity"],
  Rogue:["Dexterity","Intelligence"], Sorcerer:["Constitution","Charisma"], Warlock:["Wisdom","Charisma"], Wizard:["Intelligence","Wisdom"]
};
const DND_CLASS_SKILL_CHOICES = {
  Barbarian:{count:2,options:["Animal Handling","Athletics","Intimidation","Nature","Perception","Survival"]},
  Bard:{count:3,options:Object.keys(DND_SKILL_DATA)},
  Cleric:{count:2,options:["History","Insight","Medicine","Persuasion","Religion"]},
  Druid:{count:2,options:["Arcana","Animal Handling","Insight","Medicine","Nature","Perception","Religion","Survival"]},
  Fighter:{count:2,options:["Acrobatics","Animal Handling","Athletics","History","Insight","Intimidation","Perception","Survival"]},
  Monk:{count:2,options:["Acrobatics","Athletics","History","Insight","Religion","Stealth"]},
  Paladin:{count:2,options:["Athletics","Insight","Intimidation","Medicine","Persuasion","Religion"]},
  Ranger:{count:3,options:["Animal Handling","Athletics","Insight","Investigation","Nature","Perception","Stealth","Survival"]},
  Rogue:{count:4,options:["Acrobatics","Athletics","Deception","Insight","Intimidation","Investigation","Perception","Performance","Persuasion","Sleight of Hand","Stealth"]},
  Sorcerer:{count:2,options:["Arcana","Deception","Insight","Intimidation","Persuasion","Religion"]},
  Warlock:{count:2,options:["Arcana","Deception","History","Intimidation","Investigation","Nature","Religion"]},
  Wizard:{count:2,options:["Arcana","History","Insight","Investigation","Medicine","Religion"]}
};
const DND_MULTICLASS_SKILL_CHOICES = { Bard:1, Ranger:1, Rogue:1 };
const DND_CLASS_PROFICIENCIES = {
  Barbarian:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Bard:{armor:["Light armor"],weapons:["Simple weapons","Hand crossbows","Longswords","Rapiers","Shortswords"],tools:["Three musical instruments"]},
  Cleric:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons"],tools:[]},
  Druid:{armor:["Light armor","Medium armor","Shields"],weapons:["Clubs","Daggers","Darts","Javelins","Maces","Quarterstaffs","Scimitars","Slings","Spears"],tools:["Herbalism kit"]},
  Fighter:{armor:["All armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Monk:{armor:[],weapons:["Simple weapons","Shortswords"],tools:["One artisan tool or musical instrument"]},
  Paladin:{armor:["All armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Ranger:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Rogue:{armor:["Light armor"],weapons:["Simple weapons","Hand crossbows","Longswords","Rapiers","Shortswords"],tools:["Thieves' tools"]},
  Sorcerer:{armor:[],weapons:["Daggers","Darts","Slings","Quarterstaffs","Light crossbows"],tools:[]},
  Warlock:{armor:["Light armor"],weapons:["Simple weapons"],tools:[]},
  Wizard:{armor:[],weapons:["Daggers","Darts","Slings","Quarterstaffs","Light crossbows"],tools:[]}
};
const DND_MULTICLASS_PROFICIENCIES = {
  Barbarian:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Bard:{armor:["Light armor"],weapons:[],tools:["One musical instrument"]},
  Cleric:{armor:["Light armor","Medium armor","Shields"],weapons:[],tools:[]},
  Druid:{armor:["Light armor","Medium armor","Shields"],weapons:[],tools:[]},
  Fighter:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Monk:{armor:[],weapons:["Simple weapons","Shortswords"],tools:[]},
  Paladin:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Ranger:{armor:["Light armor","Medium armor","Shields"],weapons:["Simple weapons","Martial weapons"],tools:[]},
  Rogue:{armor:["Light armor"],weapons:[],tools:["Thieves' tools"]},
  Sorcerer:{armor:[],weapons:[],tools:[]}, Warlock:{armor:["Light armor"],weapons:["Simple weapons"],tools:[]}, Wizard:{armor:[],weapons:[],tools:[]}
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


const DND_SPECIES = ["Human","Dwarf","Elf","Halfling","Gnome","Dragonborn","Orc","Tiefling"];
const DND_BACKGROUNDS = ["Acolyte","Artisan","Criminal","Guard","Hermit","Noble","Sage","Soldier","Wayfarer"];
const DND_BACKGROUND_FEAT = {Acolyte:"Magic Initiate",Artisan:"Crafter",Criminal:"Alert",Guard:"Alert",Hermit:"Healer",Noble:"Skilled",Sage:"Magic Initiate",Soldier:"Savage Attacker",Wayfarer:"Lucky"};
const DND_CLASSES = Object.keys(DND_CLASS_HD);
const DND_SUBCLASSES = {
  Barbarian:{chooseAt:3,options:["Path of the Berserker","Path of the Totem Warrior"]},
  Bard:{chooseAt:3,options:["College of Lore","College of Valor"]},
  Cleric:{chooseAt:1,options:["Knowledge Domain","Life Domain","Light Domain","Nature Domain","Tempest Domain","Trickery Domain","War Domain"]},
  Druid:{chooseAt:2,options:["Circle of the Land","Circle of the Moon"]},
  Fighter:{chooseAt:3,options:["Champion","Battle Master","Eldritch Knight"]},
  Monk:{chooseAt:3,options:["Way of the Open Hand","Way of Shadow","Way of the Four Elements"]},
  Paladin:{chooseAt:3,options:["Oath of Devotion","Oath of the Ancients","Oath of Vengeance"]},
  Ranger:{chooseAt:3,options:["Hunter","Beast Master"]},
  Rogue:{chooseAt:3,options:["Thief","Assassin","Arcane Trickster"]},
  Sorcerer:{chooseAt:1,options:["Draconic Bloodline","Wild Magic"]},
  Warlock:{chooseAt:1,options:["The Archfey","The Fiend","The Great Old One"]},
  Wizard:{chooseAt:2,options:["School of Abjuration","School of Conjuration","School of Divination","School of Enchantment","School of Evocation","School of Illusion","School of Necromancy","School of Transmutation"]}
};
const DND_CLASS_ASI_LEVELS = {
  Barbarian:[4,8,12,16,19], Bard:[4,8,12,16,19], Cleric:[4,8,12,16,19], Druid:[4,8,12,16,19],
  Fighter:[4,6,8,12,14,16,19], Monk:[4,8,12,16,19], Paladin:[4,8,12,16,19], Ranger:[4,8,12,16,19],
  Rogue:[4,8,10,12,16,19], Sorcerer:[4,8,12,16,19], Warlock:[4,8,12,16,19], Wizard:[4,8,12,16,19]
};
const DND_CLASS_FEATURES = {
  Barbarian:{1:["Rage","Unarmored Defense"],2:["Reckless Attack","Danger Sense"],3:["Primal Path"],5:["Extra Attack","Fast Movement"],7:["Feral Instinct"],9:["Brutal Critical"],11:["Relentless Rage"],15:["Persistent Rage"],18:["Indomitable Might"],20:["Primal Champion"]},
  Bard:{1:["Spellcasting","Bardic Inspiration"],2:["Jack of All Trades","Song of Rest"],3:["Bard College","Expertise"],5:["Font of Inspiration"],6:["Countercharm"],10:["Expertise","Magical Secrets"],14:["Magical Secrets"],18:["Magical Secrets"],20:["Superior Inspiration"]},
  Cleric:{1:["Spellcasting","Divine Domain"],2:["Channel Divinity"],5:["Destroy Undead"],6:["Domain Feature"],8:["Domain Feature"],10:["Divine Intervention"],17:["Domain Feature"],20:["Divine Intervention Improvement"]},
  Druid:{1:["Druidic","Spellcasting"],2:["Wild Shape","Druid Circle"],4:["Wild Shape Improvement"],8:["Wild Shape Improvement"],18:["Timeless Body","Beast Spells"],20:["Archdruid"]},
  Fighter:{1:["Fighting Style","Second Wind"],2:["Action Surge"],3:["Martial Archetype"],4:["Ability Score Improvement"],5:["Extra Attack"],6:["Ability Score Improvement"],9:["Indomitable"],11:["Extra Attack"],13:["Indomitable"],17:["Action Surge","Indomitable"],20:["Extra Attack"]},
  Monk:{1:["Unarmored Defense","Martial Arts"],2:["Ki","Unarmored Movement"],3:["Monastic Tradition","Deflect Missiles"],4:["Slow Fall"],5:["Extra Attack","Stunning Strike"],7:["Evasion","Stillness of Mind"],10:["Purity of Body"],14:["Diamond Soul"],18:["Empty Body"],20:["Perfect Self"]},
  Paladin:{1:["Divine Sense","Lay on Hands"],2:["Fighting Style","Spellcasting","Divine Smite"],3:["Divine Health","Sacred Oath"],5:["Extra Attack"],6:["Aura of Protection"],10:["Aura of Courage"],11:["Improved Divine Smite"],14:["Cleansing Touch"],18:["Aura Improvements"]},
  Ranger:{1:["Favored Enemy","Natural Explorer"],2:["Fighting Style","Spellcasting"],3:["Ranger Archetype","Primeval Awareness"],5:["Extra Attack"],8:["Land's Stride"],14:["Vanish"],18:["Feral Senses"],20:["Foe Slayer"]},
  Rogue:{1:["Expertise","Sneak Attack","Thieves' Cant"],2:["Cunning Action"],3:["Roguish Archetype"],5:["Uncanny Dodge"],6:["Expertise"],7:["Evasion"],11:["Reliable Talent"],14:["Blindsense"],15:["Slippery Mind"],18:["Elusive"],20:["Stroke of Luck"]},
  Sorcerer:{1:["Spellcasting","Sorcerous Origin"],2:["Font of Magic"],3:["Metamagic"],10:["Metamagic Option"],17:["Metamagic Option"],20:["Sorcerous Restoration"]},
  Warlock:{1:["Otherworldly Patron","Pact Magic"],2:["Eldritch Invocations"],3:["Pact Boon"],11:["Mystic Arcanum"],13:["Mystic Arcanum"],15:["Mystic Arcanum"],17:["Mystic Arcanum"],20:["Eldritch Master"]},
  Wizard:{1:["Spellcasting","Arcane Recovery"],2:["Arcane Tradition"],18:["Spell Mastery"],20:["Signature Spells"]}
};
const DND_ARMORS = {
  None:{base:10,dex:"full",maxDex:null}, Padded:{base:11,dex:"full",maxDex:null}, Leather:{base:11,dex:"full",maxDex:null}, StuddedLeather:{label:"Studded Leather",base:12,dex:"full",maxDex:null},
  Hide:{base:12,dex:"cap",maxDex:2}, ChainShirt:{label:"Chain Shirt",base:13,dex:"cap",maxDex:2}, ScaleMail:{label:"Scale Mail",base:14,dex:"cap",maxDex:2}, Breastplate:{base:14,dex:"cap",maxDex:2}, HalfPlate:{label:"Half Plate",base:15,dex:"cap",maxDex:2},
  RingMail:{label:"Ring Mail",base:14,dex:"none",maxDex:0}, ChainMail:{label:"Chain Mail",base:16,dex:"none",maxDex:0}, Splint:{base:17,dex:"none",maxDex:0}, Plate:{base:18,dex:"none",maxDex:0}
};
const DND_SHIELDS = {None:0,Shield:2};
const DND_WEAPON_ICON = {
  Club:"quarterstaff.png", Dagger:"dagger.png", Greatsword:"longsword.png", Greataxe:"handaxe.png", Handaxe:"handaxe.png",
  Javelin:"javelin.png", Longbow:"shortbow.png", Longsword:"longsword.png", Mace:"mace.png", Quarterstaff:"quarterstaff.png",
  Rapier:"longsword.png", Scimitar:"longsword.png", Shortbow:"shortbow.png", Shortsword:"longsword.png", Spear:"spear.png",
  Warhammer:"warhammer.png", CrossbowLight:"crossbow.png"
};
const DND_SPELLS = [
  {name:"Acid Splash",level:0,classes:["Sorcerer","Wizard"]},{name:"Blade Ward",level:0,classes:["Bard","Sorcerer","Warlock","Wizard"]},{name:"Chill Touch",level:0,classes:["Sorcerer","Warlock","Wizard"]},{name:"Dancing Lights",level:0,classes:["Bard","Sorcerer","Wizard"]},{name:"Eldritch Blast",level:0,classes:["Warlock"]},{name:"Fire Bolt",level:0,classes:["Sorcerer","Wizard"]},{name:"Guidance",level:0,classes:["Cleric","Druid"]},{name:"Light",level:0,classes:["Bard","Cleric","Sorcerer","Wizard"]},{name:"Mage Hand",level:0,classes:["Bard","Sorcerer","Warlock","Wizard"]},{name:"Minor Illusion",level:0,classes:["Bard","Sorcerer","Warlock","Wizard"]},{name:"Poison Spray",level:0,classes:["Druid","Sorcerer","Warlock","Wizard"]},{name:"Prestidigitation",level:0,classes:["Bard","Sorcerer","Warlock","Wizard"]},{name:"Resistance",level:0,classes:["Cleric","Druid"]},{name:"Sacred Flame",level:0,classes:["Cleric"]},{name:"Shillelagh",level:0,classes:["Druid"]},{name:"Shocking Grasp",level:0,classes:["Sorcerer","Wizard"]},{name:"Spare the Dying",level:0,classes:["Cleric"]},{name:"Thaumaturgy",level:0,classes:["Cleric"]},{name:"True Strike",level:0,classes:["Bard","Sorcerer","Warlock","Wizard"]},
  {name:"Bless",level:1,classes:["Cleric","Paladin"]},{name:"Burning Hands",level:1,classes:["Sorcerer","Wizard"]},{name:"Charm Person",level:1,classes:["Bard","Druid","Sorcerer","Warlock","Wizard"]},{name:"Cure Wounds",level:1,classes:["Bard","Cleric","Druid","Paladin","Ranger"]},{name:"Detect Magic",level:1,classes:["Bard","Cleric","Druid","Paladin","Ranger","Sorcerer","Warlock","Wizard"]},{name:"Disguise Self",level:1,classes:["Bard","Sorcerer","Warlock","Wizard"]},{name:"Faerie Fire",level:1,classes:["Bard","Druid"]},{name:"Feather Fall",level:1,classes:["Bard","Sorcerer","Wizard"]},{name:"Find Familiar",level:1,classes:["Wizard"]},{name:"Guiding Bolt",level:1,classes:["Cleric"]},{name:"Healing Word",level:1,classes:["Bard","Cleric","Druid"]},{name:"Hex",level:1,classes:["Warlock"]},{name:"Mage Armor",level:1,classes:["Sorcerer","Wizard"]},{name:"Magic Missile",level:1,classes:["Sorcerer","Wizard"]},{name:"Shield",level:1,classes:["Sorcerer","Wizard"]},{name:"Sleep",level:1,classes:["Bard","Sorcerer","Wizard"]},{name:"Thunderwave",level:1,classes:["Bard","Druid","Wizard"]},
  {name:"Aid",level:2,classes:["Cleric","Paladin"]},{name:"Darkness",level:2,classes:["Sorcerer","Warlock","Wizard"]},{name:"Hold Person",level:2,classes:["Bard","Cleric","Druid","Sorcerer","Warlock","Wizard"]},{name:"Invisibility",level:2,classes:["Bard","Sorcerer","Warlock","Wizard"]},{name:"Lesser Restoration",level:2,classes:["Bard","Cleric","Druid","Paladin","Ranger"]},{name:"Misty Step",level:2,classes:["Sorcerer","Warlock","Wizard"]},{name:"Scorching Ray",level:2,classes:["Sorcerer","Wizard"]},{name:"Shatter",level:2,classes:["Bard","Sorcerer","Wizard"]},{name:"Spiritual Weapon",level:2,classes:["Cleric"]},{name:"Suggestion",level:2,classes:["Bard","Sorcerer","Warlock","Wizard"]},
  {name:"Counterspell",level:3,classes:["Sorcerer","Warlock","Wizard"]},{name:"Dispel Magic",level:3,classes:["Bard","Cleric","Druid","Paladin","Sorcerer","Warlock","Wizard"]},{name:"Fireball",level:3,classes:["Sorcerer","Wizard"]},{name:"Fly",level:3,classes:["Sorcerer","Warlock","Wizard"]},{name:"Haste",level:3,classes:["Sorcerer","Wizard"]},{name:"Revivify",level:3,classes:["Cleric","Paladin"]},{name:"Spirit Guardians",level:3,classes:["Cleric"]}
];
const DND_CANTRIPS_KNOWN = {
  Bard:[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4], Cleric:[3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5], Druid:[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4], Sorcerer:[4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6], Warlock:[2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4], Wizard:[3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5]
};
const DND_SPELLS_KNOWN = {
  Bard:[4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22], Sorcerer:[2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15], Warlock:[2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15], Ranger:[0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11]
};
const DND_ACTION_DETAILS = {
  Attack:"Make a weapon or unarmed attack.", "Opportunity Attack":"Use your reaction when a creature leaves your reach.", Rage:"Enter a rage and use one rage charge.", "Reckless Attack":"Gain advantage on Strength-based melee attacks this turn; attacks against you gain advantage until your next turn.", "Bardic Inspiration":"Give an inspiration die to another creature.", "Song of Rest":"Improve healing during a short rest.", "Channel Divinity":"Use one of your class or subclass Channel Divinity options.", "Wild Shape":"Transform using one Wild Shape use.", "Second Wind":"Use a bonus action to regain hit points.", "Action Surge":"Take one additional action on your turn.", "Extra Attack":"Attack more than once when you take the Attack action.", "Martial Arts":"Use your monk martial arts features.", Ki:"Spend ki on monk features.", "Deflect Missiles":"Use your reaction to reduce ranged weapon damage.", "Lay on Hands":"Spend points from your healing pool.", "Divine Smite":"Spend a spell slot after a melee hit to deal extra radiant damage.", "Favored Enemy":"Use your ranger favored-enemy benefits.", "Sneak Attack":"Deal extra damage once per turn when its conditions are met.", "Cunning Action":"Dash, Disengage, or Hide as a bonus action.", "Uncanny Dodge":"Use your reaction to halve damage from an attack you can see.", "Font of Magic":"Manage sorcery points.", Metamagic:"Apply a learned Metamagic option to a spell.", "Pact Magic":"Cast using your warlock spell slots.", "Eldritch Invocations":"Use your learned invocations.", "Arcane Recovery":"Recover spell slots after a short rest.", Spellcasting:"Cast a cantrip or spell from your character sheet."
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

function dndHitDicePools(builder = {}) {
  const pools = {};
  (builder.classes || []).forEach((c) => {
    const die = DND_CLASS_HD[c?.name];
    if (die) pools[die] = (pools[die] || 0) + Number(c?.level || 0);
  });
  return pools;
}
function dndHitDiceRemaining(builder = {}) {
  const pools = dndHitDicePools(builder);
  const tracker = builder.resourceTracker || {};
  return Object.fromEntries(Object.entries(pools).map(([die,total]) => {
    const key = `hitdice-d${die}`;
    const raw = Number(tracker[key]);
    const current = Number.isFinite(raw) ? Math.max(0, Math.min(total, raw)) : total;
    return [die, current];
  }));
}
function dndHitDiceRemainingSummary(builder = {}) {
  const pools = dndHitDicePools(builder);
  const remaining = dndHitDiceRemaining(builder);
  return Object.keys(pools).sort((a,b)=>Number(a)-Number(b)).map((die)=>`${remaining[die]}/${pools[die]}d${die}`).join(" · ") || "";
}
function dndCalculatedMaxHp(builder = {}) {
  const abilities = dndAbilities(builder, {});
  const levels = Math.max(1, (builder.classes || []).reduce((sum,c)=>sum+Number(c?.level||0),0));
  const rolled = (builder.classes || []).reduce((sum,c)=> sum + (Array.isArray(c?.hpLog) ? c.hpLog.reduce((a,b)=>a+Number(b||0),0) : 0), 0);
  return Math.max(levels, rolled + dndMod(abilities.Constitution) * levels);
}
function dndArmorClassFromBuilder(builder = {}) {
  const hasOverride = builder.acOverride !== "" && builder.acOverride !== null && builder.acOverride !== undefined && Number.isFinite(Number(builder.acOverride));
  if (hasOverride) return Number(builder.acOverride);
  const armor = DND_ARMORS[builder.armor] || DND_ARMORS.None;
  const abilities = dndAbilities(builder, {});
  const dex = dndMod(abilities.Dexterity);
  const dexPart = armor.dex === "full" ? dex : armor.dex === "cap" ? Math.min(dex, armor.maxDex) : 0;
  return armor.base + dexPart + Number(DND_SHIELDS[builder.shield] || 0) + Number(builder.armorMagic || 0) + Number(builder.shieldMagic || 0);
}
function dndAverageHpGain(className) {
  const die = Number(DND_CLASS_HD[className] || 8);
  return Math.floor(die / 2) + 1;
}
function dndSpellCapacity(builder = {}) {
  const abilities = dndAbilities(builder, {});
  let cantrips = 0;
  let spells = 0;
  let prepared = 0;
  const labels = [];
  (builder.classes || []).forEach((c)=>{
    const name = c?.name; const level = Math.max(1, Number(c?.level || 1));
    const cantripTable = DND_CANTRIPS_KNOWN[name];
    if (cantripTable) cantrips += Number(cantripTable[Math.min(20,level)-1] || 0);
    const knownTable = DND_SPELLS_KNOWN[name];
    if (knownTable) spells += Number(knownTable[Math.min(20,level)-1] || 0);
    if (name === "Cleric" || name === "Druid") prepared += Math.max(1, level + dndMod(abilities[name === "Cleric" ? "Wisdom" : "Wisdom"]));
    if (name === "Paladin") prepared += Math.max(1, Math.floor(level/2) + dndMod(abilities.Charisma));
    if (name === "Wizard") {
      spells += Math.max(6, 6 + Math.max(0, level - 1) * 2);
      prepared += Math.max(1, level + dndMod(abilities.Intelligence));
    }
  });
  if (cantrips) labels.push(`Cantrips ${cantrips}`);
  if (spells) labels.push(`Spells ${spells}`);
  if (prepared) labels.push(`Prepared ${prepared}`);
  return { cantrips, spells, prepared, labels };
}
function dndMaxSpellLevel(builder = {}) {
  const slots = dndSpellSlots(builder);
  let level = 0;
  slots.forEach((count, i)=>{ if (Number(count)>0) level=i+1; });
  return level;
}
function dndClassNames(builder = {}) { return (builder.classes || []).map((c)=>c?.name).filter(Boolean); }
function dndClassMaxSpellLevel(className, classLevel) {
  const level = Math.max(0, Number(classLevel || 0));
  const casting = DND_CLASS_CASTING[className];
  if (!casting || !level) return 0;
  if (casting === "full") return Math.min(9, Math.ceil(level / 2));
  if (casting === "half") return level < 2 ? 0 : Math.min(5, Math.floor((level + 3) / 4));
  if (casting === "pact") return Math.min(5, Math.ceil(level / 2));
  return 0;
}
function dndAvailableSpells(builder = {}, kind = "spell") {
  const classLevels = new Map((builder.classes || []).filter((c)=>c?.name).map((c)=>[c.name, Number(c.level || 0)]));
  const selected = new Set((builder.spells || []).map((s)=>String(s?.name||"")));
  return DND_SPELLS.filter((s)=> {
    const eligibleClass = s.classes.some((className)=> {
      if (!classLevels.has(className)) return false;
      if (s.level === 0) return true;
      return s.level <= dndClassMaxSpellLevel(className, classLevels.get(className));
    });
    if (!eligibleClass || selected.has(s.name)) return false;
    if (kind === "cantrip") return s.level === 0;
    return s.level > 0;
  });
}
function dndTrackedResourceForAction(builder = {}, actionName = "") {
  const tracker = builder.resourceTracker || {};
  const first = (builder.classes || []).find((c)=>{
    const actions = DND_CLASS_ACTIONS[c?.name] || [];
    return actions.some(([,name])=>name===actionName);
  });
  if (!first) return null;
  const className = first.name; const level = Number(first.level || 1); const abilities = dndAbilities(builder, {});
  let max = null;
  if (actionName === "Rage") max = level >= 20 ? 99 : level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
  else if (actionName === "Bardic Inspiration") max = Math.max(1, dndMod(abilities.Charisma));
  else if (actionName === "Channel Divinity") max = className === "Cleric" ? (level >= 18 ? 3 : level >= 6 ? 2 : 1) : 1;
  else if (actionName === "Wild Shape") max = 2;
  else if (actionName === "Second Wind") max = 1;
  else if (actionName === "Action Surge") max = level >= 17 ? 2 : 1;
  else if (actionName === "Ki") max = level;
  else if (actionName === "Lay on Hands") max = level * 5;
  else if (actionName === "Font of Magic") max = level;
  else if (actionName === "Arcane Recovery") max = 1;
  if (max === null) return null;
  const key = `player-action-${className.toLowerCase()}-${actionName.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
  const raw = Number(tracker[key]);
  const current = Number.isFinite(raw) ? Math.max(0, Math.min(max, raw)) : max;
  return { key, current, max };
}
function dndEnsureResourceDefaults(builder = {}) {
  builder.resourceTracker = { ...(builder.resourceTracker || {}) };
  const pools = dndHitDicePools(builder);
  Object.entries(pools).forEach(([die,total])=>{
    const key=`hitdice-d${die}`;
    if (!Number.isFinite(Number(builder.resourceTracker[key]))) builder.resourceTracker[key]=total;
    else builder.resourceTracker[key]=Math.max(0,Math.min(total,Number(builder.resourceTracker[key])));
  });
  dndActionRows(builder).forEach((row)=>{
    const res=dndTrackedResourceForAction(builder,row.name);
    if (res && !Number.isFinite(Number(builder.resourceTracker[res.key]))) builder.resourceTracker[res.key]=res.max;
  });
  const slots=dndSpellSlots(builder);
  slots.forEach((max,i)=>{
    if (!max) return;
    const key=`spellslot-${i+1}`;
    if (!Number.isFinite(Number(builder.resourceTracker[key]))) builder.resourceTracker[key]=max;
    else builder.resourceTracker[key]=Math.max(0,Math.min(max,Number(builder.resourceTracker[key])));
  });
  return builder;
}

function dndMaxHpFromBuilder(builder = {}, sheet = {}) {
  const saved = Number(sheet.baseHp);
  if (Number.isFinite(saved) && saved > 0) return saved;
  return dndCalculatedMaxHp(builder);
}
function dndSkillChoiceRules(builder = {}) {
  const classes = Array.isArray(builder.classes) ? builder.classes.filter((c)=>c?.name) : [];
  const first = classes[0]?.name;
  const firstRule = DND_CLASS_SKILL_CHOICES[first] || { count:0, options:[] };
  const options = new Set(firstRule.options || []);
  let count = Number(firstRule.count || 0);
  classes.slice(1).forEach((c)=> {
    const bonus = Number(DND_MULTICLASS_SKILL_CHOICES[c?.name] || 0);
    if (!bonus) return;
    count += bonus;
    (DND_CLASS_SKILL_CHOICES[c.name]?.options || []).forEach((skill)=>options.add(skill));
  });
  return { count, options:[...options] };
}
function dndAutomaticProficiencies(builder = {}) {
  const classes = Array.isArray(builder.classes) ? builder.classes.filter((c)=>c?.name) : [];
  const result = { armor:[], weapons:[], tools:[], languages:[], saves:[] };
  const addMany = (key, values=[]) => values.forEach((value)=>{ if(value && !result[key].includes(value)) result[key].push(value); });
  classes.forEach((c,index)=> {
    const table = index===0 ? DND_CLASS_PROFICIENCIES[c.name] : DND_MULTICLASS_PROFICIENCIES[c.name];
    if (!table) return;
    addMany("armor", table.armor); addMany("weapons", table.weapons); addMany("tools", table.tools);
  });
  addMany("saves", DND_CLASS_SAVES[classes[0]?.name] || []);
  if (builder.species === "Elf") addMany("languages", ["Common","Elvish"]);
  else if (builder.species) addMany("languages", ["Common"]);
  return result;
}
function dndArmorEquipmentSummary(builder = {}) {
  const armorKey = builder.armor || "None";
  const armor = DND_ARMORS[armorKey] || DND_ARMORS.None;
  const armorName = armor.label || armorKey || "No armor";
  const armorMagic = Number(builder.armorMagic || 0);
  const shieldName = builder.shield && builder.shield !== "None" ? builder.shield : "No shield";
  const shieldMagic = Number(builder.shieldMagic || 0);
  const parts = [`${armorName}${armorMagic ? ` +${armorMagic}` : ""}`, `${shieldName}${shieldMagic ? ` +${shieldMagic}` : ""}`];
  if (builder.acOverride !== "" && builder.acOverride !== null && builder.acOverride !== undefined && Number.isFinite(Number(builder.acOverride))) parts.push("Manual AC");
  return parts.join(" · ");
}
function dndAutomaticFeatureSections(builder = {}) {
  const sections = [];
  const speciesItems = [...new Set(DND_SPECIES_FEATURES[builder.species] || [])];
  if (builder.species && speciesItems.length) sections.push({ title: `${builder.species} Features`, items: speciesItems });
  (builder.classes || []).forEach((c) => {
    const level = Math.max(0, Number(c?.level || 0));
    const table = DND_CLASS_FEATURES[c?.name] || {};
    const items = [];
    Object.entries(table).forEach(([featureLevel, names]) => {
      if (Number(featureLevel) <= level) (names || []).forEach((name) => { if (name && !items.includes(name)) items.push(name); });
    });
    if (c?.subclass) items.unshift(`Subclass: ${c.subclass}`);
    if (c?.name && items.length) sections.push({ title: `${c.name} ${level}`, items });
  });
  return sections;
}
function dndAdditionalProficiencySummary(builder = {}) {
  const profs = builder.proficiencies || {};
  const rows = [
    ["Armor", profs.armor], ["Weapons", profs.weapons], ["Tools", profs.tools], ["Languages", profs.languages]
  ].filter(([,value]) => String(value || "").trim());
  return rows;
}

function dndSkillSources(builder = {}) {
  const source = Object.fromEntries(Object.keys(DND_SKILL_DATA).map((skill)=>[skill,[]]));
  const add = (skill, label) => { if (source[skill] && !source[skill].includes(label)) source[skill].push(label); };
  (DND_BACKGROUND_SKILLS[builder.background] || []).forEach((skill)=>add(skill, `Background: ${builder.background || "Background"}`));
  (DND_SPECIES_SKILLS[builder.species] || []).forEach((skill)=>add(skill, `Species: ${builder.species || "Species"}`));
  (builder.extraSkillProficiencies || []).forEach((skill)=>add(skill, "Class choice"));
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
  let pactLevel = 0;
  (builder.classes || []).forEach((c)=> {
    const kind=DND_CLASS_CASTING[c?.name];
    if(kind==="full") caster+=Number(c?.level||0);
    else if(kind==="half") caster+=Math.floor(Number(c?.level||0)/2);
    else if(kind==="pact") pactLevel=Math.max(pactLevel,Number(c?.level||0));
  });
  const slots = caster > 0 ? [...(DND_SPELL_SLOTS_FULL[Math.max(1,Math.min(20,caster))] || [0,0,0,0,0,0,0,0,0])] : [0,0,0,0,0,0,0,0,0];
  if (pactLevel > 0) {
    const pactSlotLevel = pactLevel <= 2 ? 1 : pactLevel <= 4 ? 2 : pactLevel <= 6 ? 3 : pactLevel <= 8 ? 4 : 5;
    const pactCount = pactLevel === 1 ? 1 : pactLevel <= 10 ? 2 : pactLevel <= 16 ? 3 : 4;
    slots[pactSlotLevel - 1] = Number(slots[pactSlotLevel - 1] || 0) + pactCount;
  }
  return slots;
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
  target.innerHTML = rows.slice(0, limit).map((row)=>`<button type="button" class="dnd-action-row" data-dnd-action="${escapeHtml(row.name)}"><span class="dnd-action-symbol">✦</span><div><small>${escapeHtml(row.type)}</small><strong>${escapeHtml(row.name)}</strong></div><span class="dnd-row-chevron">›</span></button>`).join("");
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
  const fixed = new Set([...(DND_BACKGROUND_SKILLS[builder.background]||[]), ...(DND_SPECIES_SKILLS[builder.species]||[])]);
  const rule=dndSkillChoiceRules(builder); const chosen=(builder.extraSkillProficiencies||[]).filter((skill)=>!fixed.has(skill));
  const summary=document.getElementById("dnd-skill-proficiency-summary");
  if(summary) summary.innerHTML=`<span>Class choices</span><strong>${chosen.length} / ${rule.count}</strong><span>Automatic</span><strong>${fixed.size}</strong>`;
  target.innerHTML = DND_ABILITY_ORDER.map((ability)=> {
    const skills = Object.keys(DND_SKILL_DATA).filter((s)=>DND_SKILL_DATA[s]===ability);
    const skillHtml = skills.length ? skills.map((skill)=> { const skillSources=sources[skill]||[]; const proficient=skillSources.length>0; const value=dndMod(abilities[ability])+(proficient?prof:0); const title=skillSources.join(" · "); return `<div class="dnd-skill-card${proficient?" is-proficient":""}" title="${escapeHtml(title)}"><span>${escapeHtml(skill)}</span><strong>${dndSigned(value)}</strong></div>`; }).join("") : `<div class="dnd-skill-empty">—</div>`;
    return `<section class="dnd-skill-group"><div class="dnd-skill-ability"><span>${escapeHtml(ability)}</span><strong>${abilities[ability]}</strong><small>Mod ${dndSigned(dndMod(abilities[ability]))}</small></div><div class="dnd-skill-boxes">${skillHtml}</div></section>`;
  }).join("");
}
function renderDndWeapons(builder, sheet) {
  const target=document.getElementById("dnd-weapons-list"); const summary=document.getElementById("dnd-weapons-summary"); if(!target) return;
  const abilities=dndAbilities(builder,sheet); const prof=Number(sheet.prof ?? sheet.proficiencyBonus ?? dndProfBonus(builder)); const weapons=Array.isArray(builder.weapons)?builder.weapons:[];
  if(summary) summary.innerHTML=`<div><span>Attack Bonus</span><strong>${weapons.length ? dndSigned(dndWeaponAttackMod(DND_WEAPON_META[weapons[0]?.name]||{},abilities,prof,weapons[0]?.magic)) : "—"}</strong></div><div><span>Proficiency</span><strong>${dndSigned(prof)}</strong></div>`;
  target.innerHTML = weapons.length ? weapons.map((weapon,index)=> {
    const meta=DND_WEAPON_META[weapon?.name]||{ability:"Strength",damage:"—",type:"Weapon",properties:[]}; const attack=dndWeaponAttackMod(meta,abilities,prof,weapon?.magic);
    const icon=DND_WEAPON_ICON[weapon?.name] || "longsword.png";
    return `<article class="dnd-weapon-card"><div class="dnd-weapon-card-head"><div class="dnd-weapon-mark"><img src="../icons/gear/${escapeHtml(icon)}" alt="" onerror="this.hidden=true"></div><div class="dnd-weapon-main"><h3>${escapeHtml(meta.label||weapon?.name||"Weapon")}${Number(weapon?.magic||0)?` +${Number(weapon.magic)}`:""}</h3><div class="dnd-weapon-tags">${(meta.properties||[]).map((p)=>`<span>${escapeHtml(p)}</span>`).join("")}</div></div><div class="dnd-weapon-actions"><button type="button" class="dnd-card-edit" data-dnd-edit-weapon="${index}">Edit</button><button type="button" class="dnd-card-remove" data-dnd-remove-weapon="${index}">Remove</button></div></div><div class="dnd-weapon-stats"><div class="dnd-weapon-stat"><span>Attack</span><strong>${dndSigned(attack)}</strong></div><div class="dnd-weapon-stat"><span>Damage</span><strong>${escapeHtml(dndWeaponDamage(meta,abilities,weapon?.magic))}</strong></div><div class="dnd-weapon-stat"><span>Type</span><strong>${escapeHtml(meta.type||"—")}</strong>${meta.range?`<small>${escapeHtml(meta.range)}</small>`:""}</div></div></article>`;
  }).join("") : `<div class="dnd-empty-card">No weapons</div>`;
}
function renderDndSpells(builder) {
  const slotsTarget=document.getElementById("dnd-spell-slots"); const listTarget=document.getElementById("dnd-spells-list"); const capacityTarget=document.getElementById("dnd-spell-capacity"); if(!slotsTarget||!listTarget)return;
  dndEnsureResourceDefaults(builder);
  const slots=dndSpellSlots(builder); const active=slots.map((n,i)=>({level:i+1,count:n})).filter((x)=>x.count>0);
  slotsTarget.innerHTML = active.length ? active.map((x)=>{ const key=`spellslot-${x.level}`; const current=Number(builder.resourceTracker?.[key] ?? x.count); return `<div class="dnd-slot-card"><span>Level ${x.level}</span><div class="dnd-slot-diamonds">${Array.from({length:x.count},(_,i)=>`<b class="${i<current?"is-filled":""}">◆</b>`).join("")}</div><strong>${current} / ${x.count} uses</strong><div class="dnd-slot-actions"><button type="button" data-dnd-slot-use="${x.level}">Use</button><button type="button" data-dnd-slot-restore="${x.level}">Restore</button></div></div>`; }).join("") : `<div class="dnd-empty-card">No spell slots</div>`;
  const spells=Array.isArray(builder.spells)?builder.spells:[]; const grouped={}; spells.forEach((spell)=>{ const lvl=Number(spell?.level||0); (grouped[lvl] ||= []).push(spell); });
  const cap=dndSpellCapacity(builder); const cantripCount=(grouped[0]||[]).length; const spellCount=spells.filter((spell)=>Number(spell?.level||0)>0).length;
  if(capacityTarget) capacityTarget.innerHTML=`<div><span>Cantrips Known</span><strong>${cantripCount}${cap.cantrips?` / ${cap.cantrips}`:""}</strong></div><div><span>Leveled Spells</span><strong>${spellCount}${cap.spells?` / ${cap.spells}`:""}</strong></div>${cap.prepared?`<div><span>Prepared Capacity</span><strong>${Math.min(spellCount,cap.prepared)} / ${cap.prepared}</strong></div>`:""}`;
  const levels=new Set([0]); Object.keys(grouped).map(Number).forEach((lvl)=>levels.add(lvl)); active.forEach((slot)=>levels.add(slot.level));
  const ordered=[...levels].sort((a,b)=>a-b);
  listTarget.innerHTML = ordered.map((lvl)=>{
    const items=grouped[lvl]||[]; const label=lvl===0?"Cantrips":`Level ${lvl} Spells`; const maxSlots=lvl===0?0:Number(slots[lvl-1]||0); const currentSlots=lvl===0?0:Number(builder.resourceTracker?.[`spellslot-${lvl}`]??maxSlots);
    const usage=lvl===0?`${items.length} known`:`${items.length} known · Slots ${currentSlots} / ${maxSlots}`;
    const cards=items.length?items.map((spell)=>{ const index=spells.indexOf(spell); const meta=DND_SPELL_META[spell?.name]||{school:"Spell",time:"—",range:"—",tags:[]}; return `<article class="dnd-spell-card"><h4>${escapeHtml(spell?.name||"Spell")}</h4><small>${escapeHtml(meta.school)}</small><div class="dnd-spell-meta"><span>${escapeHtml(meta.time)}</span><span>${escapeHtml(meta.range)}</span></div><div class="dnd-spell-tags">${(meta.tags||[]).map((tag)=>`<span>${escapeHtml(tag)}</span>`).join("")}<span>${lvl===0?"Cantrip":`Level ${lvl}`}</span></div><button type="button" class="dnd-card-remove" data-dnd-remove-spell="${index}">Remove</button></article>`; }).join(""):`<div class="dnd-empty-inline">No spells added at this level.</div>`;
    return `<section class="dnd-spell-group"><div class="dnd-spell-group-title"><h3>${label}</h3><span>${usage}</span></div><div class="dnd-spell-card-grid">${cards}</div></section>`;
  }).join("");
}
function renderDndProfile(builder, sheet) {
  const target=document.getElementById("dnd-profile-content"); if(!target)return;
  const classes=Array.isArray(builder.classes)?builder.classes:[]; const classText=classes.map((c)=>`${c?.name||"Class"} ${c?.level||1}${c?.subclass?` (${c.subclass})`:""}`).join(" / ")||sheet.classSummary||"—";
  const money=builder.money||{}; const auto=dndAutomaticProficiencies(builder); const automaticFeatures=dndAutomaticFeatureSections(builder); const extraProfs=dndAdditionalProficiencySummary(builder);
  const speciesOptions=DND_SPECIES.map((name)=>`<option ${builder.species===name?"selected":""}>${name}</option>`).join("");
  const backgroundOptions=DND_BACKGROUNDS.map((name)=>`<option ${builder.background===name?"selected":""}>${name}</option>`).join("");
  const granted=(key)=>auto[key]?.length?auto[key].join(", "):"None";
  const featureHtml=automaticFeatures.length?automaticFeatures.map((section)=>`<article class="dnd-auto-feature-section"><h4>${escapeHtml(section.title)}</h4><div>${section.items.map((item)=>`<span>${escapeHtml(item)}</span>`).join("")}</div></article>`).join(""):`<div class="dnd-empty-inline">No automatic features yet.</div>`;
  const extraProfHtml=extraProfs.length?extraProfs.map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join(""):`<div class="dnd-empty-inline">No additional proficiencies.</div>`;
  target.innerHTML=`
    <div class="dnd-profile-edit-grid">
      <label>Name<input id="dnd-profile-name" type="text" value="${escapeHtml(builder.name||sheet.name||"")}"></label>
      <label>Class<div class="dnd-inline-profile"><input value="${escapeHtml(classText)}" readonly><button id="dnd-profile-level-up" type="button">Level / Multiclass</button></div></label>
      <label>Race<select id="dnd-profile-species">${speciesOptions}</select></label>
      <label>Background<select id="dnd-profile-background">${backgroundOptions}</select></label>
      <label>Alignment<input id="dnd-profile-alignment" type="text" value="${escapeHtml(builder.alignment||"")}"></label>
      <label>Experience<input id="dnd-profile-experience" type="number" min="0" value="${Number(builder.experience||0)}"></label>
    </div>
    <section class="dnd-auto-features-card"><div class="dnd-panel-heading"><h3>Class &amp; Race Features</h3></div><div class="dnd-auto-features-grid">${featureHtml}</div></section>
    <label class="dnd-profile-field-wide">Additional Features<textarea id="dnd-profile-features">${escapeHtml(builder.features||"")}</textarea></label>
    <section class="dnd-proficiency-card"><div class="dnd-panel-heading"><h3>Proficiencies</h3><div class="dnd-heading-actions"><button id="dnd-profile-manage-skills" class="dnd-compact-manage-button" type="button">Skills</button><button id="dnd-profile-manage-proficiencies" class="dnd-compact-manage-button" type="button">Manage</button></div></div>
      <div class="dnd-auto-proficiency-grid">
        <div><span>Armor</span><strong>${escapeHtml(granted("armor"))}</strong></div>
        <div><span>Weapons</span><strong>${escapeHtml(granted("weapons"))}</strong></div>
        <div><span>Saving Throws</span><strong>${escapeHtml(granted("saves"))}</strong></div>
        <div><span>Languages</span><strong>${escapeHtml(granted("languages"))}</strong></div>
      </div>
      <div class="dnd-additional-proficiency-summary">${extraProfHtml}</div>
    </section>
    <label class="dnd-profile-field-wide">Equipment<textarea id="dnd-profile-equipment">${escapeHtml(builder.equipment||"")}</textarea></label>
    <section class="dnd-money-edit"><h3>Money</h3><div>${["pp","gp","ep","sp","cp"].map((key)=>`<label>${key.toUpperCase()}<input id="dnd-profile-money-${key}" type="number" min="0" value="${Number(money[key]||0)}"></label>`).join("")}</div></section>
    <div class="dnd-profile-edit-grid dnd-profile-edit-grid--2"><label>Personal Traits<textarea id="dnd-profile-traits">${escapeHtml(builder.personalTraits||"")}</textarea></label><label>Ideals<textarea id="dnd-profile-ideals">${escapeHtml(builder.ideals||"")}</textarea></label><label>Bonds<textarea id="dnd-profile-bonds">${escapeHtml(builder.bonds||"")}</textarea></label><label>Flaws<textarea id="dnd-profile-flaws">${escapeHtml(builder.flaws||"")}</textarea></label></div>
    <label class="dnd-profile-field-wide">Notes<textarea id="dnd-profile-notes">${escapeHtml(builder.notes||"")}</textarea></label>
    <div class="dnd-profile-autosave-row"><span id="dnd-profile-autosave-status">Changes save automatically.</span></div>`;
}
function updateDndHpView(builder = currentDndBuilderData || {}, sheet = getCurrentSheetCache() || {}) {
  const current=Number(sheet.currentHp ?? sheet.hp ?? document.getElementById("player-hp")?.value ?? 0); const max=dndMaxHpFromBuilder(builder,sheet);
  const currentEl=document.getElementById("dnd-current-hp-display"), maxEl=document.getElementById("dnd-max-hp-display"), fill=document.getElementById("dnd-hp-fill");
  if(currentEl) currentEl.textContent=Number.isFinite(current)?String(current):"—"; if(maxEl) maxEl.textContent=max>0?String(max):"—";
  if(fill){ const pct=max>0?Math.max(0,Math.min(100,(current/max)*100)):0; fill.style.width=`${pct}%`; fill.parentElement?.setAttribute("aria-valuenow",String(Math.max(0,current||0))); fill.parentElement?.setAttribute("aria-valuemax",String(max||0)); }
  const temp=document.getElementById("dnd-temp-hp-display"); if(temp){ const extra=Number.isFinite(current)&&max>0?Math.max(0,current-max):0; temp.hidden=extra<=0; temp.textContent=extra>0?`Temp +${extra}`:""; }
}
function renderDndDashboard(builder = currentDndBuilderData || {}, sheet = getCurrentSheetCache() || {}) {
  if(mode!=="dnd" || !document.getElementById("dnd-sheet-app")) return;
  currentDndBuilderData=builder||{}; const abilities=dndAbilities(builder,sheet); const level=dndTotalLevel(builder); const classes=(builder.classes||[]); const classNames=classes.map((c)=>c?.name).filter(Boolean).join(" / ")||"D&D"; const subclass=classes.map((c)=>c?.subclass).filter(Boolean).join(" / ");
  const title=document.getElementById("dnd-character-title"); if(title) title.textContent=builder.name||sheet.name||sheet.playerName||"Character";
  const subtitle=document.getElementById("dnd-character-subtitle"); if(subtitle) subtitle.textContent=[`Level ${level}`,builder.species,classNames,subclass].filter(Boolean).join("  •  ");
  updateDndHpView(builder,sheet);
  const init=Number(sheet.initiativeBonus ?? dndMod(abilities.Dexterity)); const prof=Number(sheet.prof ?? sheet.proficiencyBonus ?? dndProfBonus(builder));
  const setText=(id,value)=>{ const el=document.getElementById(id); if(el) el.textContent=value; };
  setText("dnd-view-initiative",dndSigned(init)); setText("dnd-view-speed",`${DND_SPECIES_SPEED[builder.species] ?? 30} ft`); setText("dnd-view-hit-dice",dndHitDiceSummary(builder)); setText("dnd-view-hit-dice-remaining",dndHitDiceRemainingSummary(builder)); setText("dnd-view-ac",String(sheet.ac ?? dndArmorClassFromBuilder(builder) ?? "—")); setText("dnd-view-ac-equipment",dndArmorEquipmentSummary(builder)); setText("dnd-view-prof",dndSigned(prof));
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
  tabs.forEach((tab)=>{ const active=tab.dataset.dndTab===key; tab.classList.toggle("is-active",active); tab.setAttribute("aria-selected",String(active)); if(active){ const bar=tab.parentElement; if(bar){ const left=Math.max(0,tab.offsetLeft-(bar.clientWidth-tab.offsetWidth)/2); bar.scrollTo({left,behavior:smooth?"smooth":"auto"}); } } }); dots.forEach((dot,i)=>dot.classList.toggle("is-active",i===index));
  syncDndViewportHeight();
  if (smooth) setTimeout(syncDndViewportHeight, 360);
}

let currentDndActionName = null;
let currentDndSpellPickerKind = "spell";
let currentDndWeaponEditIndex = null;
let dndCreationPrompted = false;
let dndProfileAutoSaveTimer = null;
let dndSetupAutoSaveTimer = null;
let dndProficiencyAutoSaveTimer = null;
let dndDeferredLiveRender = false;

function dndEditingFieldHasFocus() {
  const active = document.activeElement;
  if (!active || !active.matches?.("input, textarea, select")) return false;
  return !!active.closest?.("#dnd-profile-content, #dnd-character-setup-modal, #dnd-proficiency-modal");
}
function dndRenderOrDefer(builder = currentDndBuilderData || {}, sheet = getCurrentSheetCache() || {}) {
  if (dndEditingFieldHasFocus()) { dndDeferredLiveRender = true; return; }
  dndDeferredLiveRender = false;
  renderDndDashboard(builder, sheet);
}
function flushDndDeferredLiveRender() {
  if (!dndDeferredLiveRender || dndEditingFieldHasFocus()) return;
  dndDeferredLiveRender = false;
  renderDndDashboard(currentDndBuilderData || {}, getCurrentSheetCache() || {});
}

function dndClone(value) { return JSON.parse(JSON.stringify(value ?? {})); }
function dndOpenModal(id) {
  const modal=document.getElementById(id); if(!modal) return;
  modal.classList.add("is-open"); modal.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>modal.querySelector("input,select,textarea,button")?.focus());
}
function dndCloseModal(id) {
  const modal=document.getElementById(id); if(!modal) return;
  modal.classList.remove("is-open"); modal.setAttribute("aria-hidden","true");
}
function dndDefaultBuilder() {
  return {
    name:user.displayName||"", species:"Human", background:"Soldier", alignment:"", experience:0,
    abilityMode:"manual", abilities:{Strength:10,Dexterity:10,Constitution:10,Intelligence:10,Wisdom:10,Charisma:10},
    classes:[{name:"Fighter",level:1,hpLog:[10],subclass:"",featureChoices:{},asiChoices:{}}],
    backgroundBoostChoice:{mode:"+2/+1",first:"Strength",second:"Constitution",third:"Wisdom"},
    armor:"Leather", armorMagic:0, shield:"None", shieldMagic:0, weapons:[], feats:[], spells:[], spellAbilityOverride:"",
    resourceTracker:{}, extraSkillProficiencies:[], features:"", equipment:"", personalTraits:"", ideals:"", bonds:"", flaws:"", notes:"",
    proficiencies:{armor:"",weapons:"",tools:"",languages:""}, money:{pp:0,gp:0,ep:0,sp:0,cp:0}
  };
}
function dndNormalizeBuilder(builder = {}) {
  const base=dndDefaultBuilder();
  const out={...base,...dndClone(builder)};
  out.abilities={...base.abilities,...(builder.abilities||{})};
  out.proficiencies={...base.proficiencies,...(builder.proficiencies||{})};
  out.money={...base.money,...(builder.money||{})};
  out.resourceTracker={...(builder.resourceTracker||{})};
  out.classes=Array.isArray(builder.classes)&&builder.classes.length?dndClone(builder.classes):base.classes;
  out.weapons=Array.isArray(builder.weapons)?dndClone(builder.weapons):[];
  out.spells=Array.isArray(builder.spells)?dndClone(builder.spells):[];
  out.feats=Array.isArray(builder.feats)?dndClone(builder.feats):[];
  out.extraSkillProficiencies=Array.isArray(builder.extraSkillProficiencies)?dndClone(builder.extraSkillProficiencies):[];
  const skillRule=dndSkillChoiceRules(out); const fixedSkills=new Set([...(DND_BACKGROUND_SKILLS[out.background]||[]),...(DND_SPECIES_SKILLS[out.species]||[])]);
  out.extraSkillProficiencies=out.extraSkillProficiencies.filter((skill)=>!fixedSkills.has(skill)&&skillRule.options.includes(skill)).slice(0,skillRule.count);
  return dndEnsureResourceDefaults(out);
}
async function saveDndBuilderAndPlayer(builder, message="Saved.", options={}) {
  const next=dndNormalizeBuilder(builder);
  next.updatedAt=Date.now();
  const existing=(getCurrentSheetCache()||{});
  const maxHp=dndCalculatedMaxHp(next);
  let currentHp=Number(existing.currentHp ?? existing.hp);
  if(!Number.isFinite(currentHp)) currentHp=maxHp;
  currentHp=Math.max(0,currentHp);
  const ac=dndArmorClassFromBuilder(next);
  const abilities=dndAbilities(next,existing);
  const prof=dndProfBonus(next);
  const init=dndMod(abilities.Dexterity);
  const playerPayload={
    ...existing, uid:user.uid, userEmail:user.email||"", userName:user.displayName||"", mode:"dnd", name:next.name||existing.name||user.displayName||"",
    ac, baseHp:maxHp, currentHp, hp:currentHp, proficiencyBonus:prof, prof, initiativeBonus:init, speed:DND_SPECIES_SPEED[next.species]??30, hitDice:dndHitDiceSummary(next),
    strength:abilities.Strength,dexterity:abilities.Dexterity,constitution:abilities.Constitution,intelligence:abilities.Intelligence,wisdom:abilities.Wisdom,charisma:abilities.Charisma,
    str:abilities.Strength,dex:abilities.Dexterity,con:abilities.Constitution,int:abilities.Intelligence,wis:abilities.Wisdom,cha:abilities.Charisma,
    classSummary:(next.classes||[]).map((c)=>`${c.name} ${c.level}`).join(" / "), builderUpdatedAt:Date.now(), updatedAt:Date.now()
  };
  await set(ref(db,dndBuilderSheetPath()),next);
  await set(ref(db,playerSheetPath()),playerPayload);
  const entrySnap=await get(ref(db,playerEntryPath()));
  if(entrySnap.exists()) await update(ref(db,playerEntryPath()),{ac,name:playerPayload.name,playerName:playerPayload.name,updatedAt:Date.now()});
  currentDndBuilderData=next; setCurrentSheetCache(playerPayload); setSharedValues({...playerPayload,initiative:document.getElementById("player-initiative")?.value}); setDndValues(playerPayload);
  if(options.render!==false) renderDndDashboard(next,playerPayload);
  else {
    const title=document.getElementById("dnd-character-title"); if(title) title.textContent=next.name||playerPayload.name||"Character";
    updateDndHpView(next,playerPayload);
  }
  statusEl.textContent=message;
  return {builder:next,sheet:playerPayload};
}
function dndPopulateSelect(el, values, selected, labeler=(x)=>x) {
  if(!el) return;
  el.innerHTML=values.map((value)=>`<option value="${escapeHtml(value)}" ${String(selected)===String(value)?"selected":""}>${escapeHtml(labeler(value))}</option>`).join("");
}
function dndRefreshSetupSubclass() {
  const className=document.getElementById("dnd-setup-class")?.value; const sel=document.getElementById("dnd-setup-subclass"); if(!sel)return;
  const info=DND_SUBCLASSES[className]; const existing=(currentDndBuilderData?.classes||[]).find((c)=>c?.name===className); const current=existing?.subclass||""; const level=Number(existing?.level||1);
  const available=!!info && level>=Number(info.chooseAt||1); const options=available?["",...(info?.options||[])]:[""]; sel.disabled=!available; sel.innerHTML=options.map((x)=>`<option value="${escapeHtml(x)}" ${x===current?"selected":""}>${escapeHtml(x||"None")}</option>`).join("");
}
function openDndCharacterSetup() {
  const builder=dndNormalizeBuilder(currentDndBuilderData&&Object.keys(currentDndBuilderData).length?currentDndBuilderData:dndDefaultBuilder());
  const first=builder.classes?.[0]||{name:"Fighter",level:1};
  document.getElementById("dnd-character-setup-title").textContent=currentDndBuilderData&&Object.keys(currentDndBuilderData).length?"Edit Character":"Create Character";
  document.getElementById("dnd-setup-name").value=builder.name||"";
  dndPopulateSelect(document.getElementById("dnd-setup-species"),DND_SPECIES,builder.species);
  dndPopulateSelect(document.getElementById("dnd-setup-background"),DND_BACKGROUNDS,builder.background);
  dndPopulateSelect(document.getElementById("dnd-setup-class"),DND_CLASSES,first.name);
  dndPopulateSelect(document.getElementById("dnd-setup-armor"),Object.keys(DND_ARMORS),builder.armor,(k)=>DND_ARMORS[k].label||k);
  dndPopulateSelect(document.getElementById("dnd-setup-shield"),Object.keys(DND_SHIELDS),builder.shield);
  document.getElementById("dnd-setup-alignment").value=builder.alignment||"";
  const attr=document.getElementById("dnd-setup-attributes");
  attr.innerHTML=DND_ABILITY_ORDER.map((name)=>`<label>${DND_ABILITY_SHORT[name]}<input type="number" min="1" max="30" data-dnd-setup-ability="${name}" value="${Number(builder.abilities?.[name]??10)}"></label>`).join("");
  dndRefreshSetupSubclass(); dndOpenModal("dnd-character-setup-modal");
}
function collectDndCharacterSetup() {
  let builder=dndNormalizeBuilder(currentDndBuilderData&&Object.keys(currentDndBuilderData).length?currentDndBuilderData:dndDefaultBuilder());
  const className=document.getElementById("dnd-setup-class")?.value||builder.classes?.[0]?.name||"Fighter";
  const currentFirst=builder.classes?.[0]||null; const level=Math.max(1,Number(currentFirst?.level||1));
  let hpLog=Array.isArray(currentFirst?.hpLog)?[...currentFirst.hpLog]:[];
  if(!currentFirst || currentFirst.name!==className || !hpLog.length) hpLog=[Number(DND_CLASS_HD[className]||8),...Array.from({length:Math.max(0,level-1)},()=>dndAverageHpGain(className))];
  const nextFirst={...(currentFirst||{}),name:className,level,hpLog,subclass:document.getElementById("dnd-setup-subclass")?.value||"",featureChoices:currentFirst?.featureChoices||{},asiChoices:currentFirst?.asiChoices||{}};
  builder.classes=[nextFirst,...(builder.classes||[]).slice(1)];
  builder.name=document.getElementById("dnd-setup-name")?.value.trim()||user.displayName||"Character";
  builder.species=document.getElementById("dnd-setup-species")?.value||builder.species; builder.background=document.getElementById("dnd-setup-background")?.value||builder.background; builder.alignment=document.getElementById("dnd-setup-alignment")?.value.trim()||"";
  builder.armor=document.getElementById("dnd-setup-armor")?.value||builder.armor; builder.shield=document.getElementById("dnd-setup-shield")?.value||builder.shield; delete builder.acOverride;
  document.querySelectorAll("[data-dnd-setup-ability]").forEach((input)=>{builder.abilities[input.dataset.dndSetupAbility]=Math.max(1,Math.min(30,Number(input.value||10)));});
  builder.feats=Array.isArray(builder.feats)?builder.feats:[]; const originFeat=DND_BACKGROUND_FEAT[builder.background]; if(originFeat && !builder.feats.includes(originFeat)) builder.feats.push(originFeat);
  return dndEnsureResourceDefaults(builder);
}
async function saveDndCharacterSetup(options={}) {
  const status=document.getElementById("dnd-setup-autosave-status"); if(status) status.textContent="Saving…";
  try {
    const builder=collectDndCharacterSetup();
    await saveDndBuilderAndPlayer(builder,"Character auto-saved.",{render:options.render!==false});
    if(status) status.textContent="Saved";
    if(options.closeAfter) dndCloseModal("dnd-character-setup-modal");
  } catch(error) {
    console.error(error); if(status) status.textContent=error.message||"Save failed";
  }
}
function scheduleDndSetupAutoSave(render=false) {
  clearTimeout(dndSetupAutoSaveTimer);
  const status=document.getElementById("dnd-setup-autosave-status"); if(status) status.textContent="Saving…";
  dndSetupAutoSaveTimer=setTimeout(()=>saveDndCharacterSetup({render}),800);
}
function dndRefreshLevelUpModal() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const className=document.getElementById("dnd-level-class")?.value||builder.classes?.[0]?.name||"Fighter";
  const existing=(builder.classes||[]).find((c)=>c?.name===className); const nextLevel=(existing?Number(existing.level||0):0)+1; const hd=DND_CLASS_HD[className]||8;
  const hp=document.getElementById("dnd-level-hp-gain"); if(hp && !hp.dataset.touched) hp.value=dndAverageHpGain(className);
  const subInfo=DND_SUBCLASSES[className]; const subWrap=document.getElementById("dnd-level-subclass-wrap"); const subSel=document.getElementById("dnd-level-subclass");
  const needsSubclass=!!subInfo && nextLevel>=subInfo.chooseAt && !(existing?.subclass);
  if(subWrap) subWrap.hidden=!needsSubclass; if(subSel) subSel.innerHTML=["",...(subInfo?.options||[])].map((x)=>`<option value="${escapeHtml(x)}">${escapeHtml(x||"Choose")}</option>`).join("");
  const isAsi=(DND_CLASS_ASI_LEVELS[className]||[]).includes(nextLevel); ["dnd-level-asi-one-wrap","dnd-level-asi-two-wrap","dnd-level-feat-wrap"].forEach((id)=>{const el=document.getElementById(id); if(el) el.hidden=!isAsi;});
  const attrs=["",...DND_ABILITY_ORDER]; ["dnd-level-asi-one","dnd-level-asi-two"].forEach((id)=>dndPopulateSelect(document.getElementById(id),attrs,""));
  const features=DND_CLASS_FEATURES[className]?.[nextLevel]||[]; const box=document.getElementById("dnd-level-features"); if(box) box.innerHTML=`<strong>Level ${nextLevel}</strong>${features.length?`<div>${features.map((f)=>`<span>${escapeHtml(f)}</span>`).join("")}</div>`:""}<small>d${hd}</small>`;
}
function openDndLevelUp(multiclassOnly=false) {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const sel=document.getElementById("dnd-level-class");
  const owned=new Set((builder.classes||[]).map((c)=>c?.name).filter(Boolean));
  const choices=multiclassOnly?DND_CLASSES.filter((name)=>!owned.has(name)):DND_CLASSES;
  const available=choices.length?choices:DND_CLASSES;
  const selected=multiclassOnly?available[0]:(builder.classes?.[0]?.name||"Fighter");
  dndPopulateSelect(sel,available,selected);
  const title=document.getElementById("dnd-level-up-title"); if(title) title.textContent=multiclassOnly?"Add Multiclass":"Level Up / Multiclass";
  if(sel) sel.dataset.multiclassOnly=multiclassOnly?"1":"";
  document.getElementById("dnd-level-hp-gain").dataset.touched=""; document.getElementById("dnd-level-feat").value=""; dndRefreshLevelUpModal(); dndOpenModal("dnd-level-up-modal");
}
async function confirmDndLevelUp() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const className=document.getElementById("dnd-level-class").value; let cls=(builder.classes||[]).find((c)=>c?.name===className);
  if (dndTotalLevel(builder) >= 20) { statusEl.textContent="Total character level is already 20."; return; }
  const previousLevel=cls?Number(cls.level||0):0; const nextLevel=previousLevel+1; if(nextLevel>20){statusEl.textContent="That class is already level 20.";return;}
  const hpGain=Math.max(1,Number(document.getElementById("dnd-level-hp-gain").value||dndAverageHpGain(className))); const die=DND_CLASS_HD[className]||8;
  const tracker=builder.resourceTracker||(builder.resourceTracker={}); const hdKey=`hitdice-d${die}`; const previousHd=Number(tracker[hdKey]);
  if(!cls){cls={name:className,level:1,hpLog:[hpGain],subclass:"",featureChoices:{},asiChoices:{}}; builder.classes.push(cls);} else {cls.level=nextLevel; cls.hpLog=Array.isArray(cls.hpLog)?cls.hpLog:[]; cls.hpLog.push(hpGain);}
  const subclass=document.getElementById("dnd-level-subclass")?.value; if(subclass) cls.subclass=subclass;
  const feat=document.getElementById("dnd-level-feat")?.value.trim();
  if(feat){builder.feats=Array.isArray(builder.feats)?builder.feats:[]; if(!builder.feats.includes(feat))builder.feats.push(feat);} else {
    [document.getElementById("dnd-level-asi-one")?.value,document.getElementById("dnd-level-asi-two")?.value].filter(Boolean).forEach((a)=>{builder.abilities[a]=Math.min(30,Number(builder.abilities[a]||10)+1);});
  }
  const newTotal=dndHitDicePools(builder)[die]||1; tracker[hdKey]=Number.isFinite(previousHd)?Math.min(newTotal,previousHd+1):newTotal;
  await saveDndBuilderAndPlayer(builder,`${className} level ${nextLevel} saved.`); dndCloseModal("dnd-level-up-modal");
}
function openDndHitDice() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const pools=dndHitDicePools(builder); const remaining=dndHitDiceRemaining(builder); const list=document.getElementById("dnd-hit-dice-pools");
  list.innerHTML=Object.keys(pools).sort((a,b)=>Number(a)-Number(b)).map((die)=>`<div><span>d${die}</span><strong>${remaining[die]} / ${pools[die]}</strong></div>`).join("")||"—";
  const select=document.getElementById("dnd-hit-die-select"); select.innerHTML=Object.keys(pools).filter((die)=>remaining[die]>0).sort((a,b)=>Number(a)-Number(b)).map((die)=>`<option value="${die}">d${die} (${remaining[die]})</option>`).join("");
  document.getElementById("dnd-hit-dice-amount").value=1; document.getElementById("dnd-hit-dice-result").textContent=""; dndOpenModal("dnd-hit-dice-modal");
}
async function spendDndHitDice() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const die=Number(document.getElementById("dnd-hit-die-select").value); const amount=Math.max(1,Number(document.getElementById("dnd-hit-dice-amount").value||1)); const remaining=dndHitDiceRemaining(builder)[die]||0;
  if(!die||amount>remaining){document.getElementById("dnd-hit-dice-result").textContent="Not enough Hit Dice.";return;}
  builder.resourceTracker=builder.resourceTracker||{}; builder.resourceTracker[`hitdice-d${die}`]=remaining-amount;
  await saveDndBuilderAndPlayer(builder,`Marked ${amount}d${die} used.`);
  openDndHitDice();
  const left=dndHitDiceRemaining(builder)[die]||0;
  document.getElementById("dnd-hit-dice-result").textContent=`Marked ${amount}d${die} used. ${left} remaining.`;
}
async function restoreDndHitDice() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const pools=dndHitDicePools(builder); builder.resourceTracker=builder.resourceTracker||{}; Object.entries(pools).forEach(([die,total])=>{builder.resourceTracker[`hitdice-d${die}`]=total;}); await saveDndBuilderAndPlayer(builder,"Hit Dice restored."); openDndHitDice();
}
function refreshDndAcPreview() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{});
  builder.armor=document.getElementById("dnd-ac-armor-select")?.value||builder.armor;
  builder.armorMagic=Number(document.getElementById("dnd-ac-armor-magic")?.value||0);
  builder.shield=document.getElementById("dnd-ac-shield-select")?.value||builder.shield;
  builder.shieldMagic=Number(document.getElementById("dnd-ac-shield-magic")?.value||0);
  delete builder.acOverride;
  const calc=dndArmorClassFromBuilder(builder); const preview=document.getElementById("dnd-ac-calculated-preview");
  if(preview) preview.textContent=`Calculated from equipment: AC ${calc} · ${dndArmorEquipmentSummary(builder)}`;
}
function openDndAcEditor() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{});
  dndPopulateSelect(document.getElementById("dnd-ac-armor-select"),Object.keys(DND_ARMORS),builder.armor,(key)=>DND_ARMORS[key].label||key);
  dndPopulateSelect(document.getElementById("dnd-ac-shield-select"),Object.keys(DND_SHIELDS),builder.shield);
  document.getElementById("dnd-ac-armor-magic").value=String(Number(builder.armorMagic||0));
  document.getElementById("dnd-ac-shield-magic").value=String(Number(builder.shieldMagic||0));
  const hasOverride=builder.acOverride !== "" && builder.acOverride !== null && builder.acOverride !== undefined && Number.isFinite(Number(builder.acOverride));
  document.getElementById("dnd-ac-edit-input").value=hasOverride?String(Number(builder.acOverride)):"";
  refreshDndAcPreview(); dndOpenModal("dnd-ac-modal");
}
async function saveDndAc() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{});
  builder.armor=document.getElementById("dnd-ac-armor-select")?.value||builder.armor; builder.armorMagic=Number(document.getElementById("dnd-ac-armor-magic")?.value||0);
  builder.shield=document.getElementById("dnd-ac-shield-select")?.value||builder.shield; builder.shieldMagic=Number(document.getElementById("dnd-ac-shield-magic")?.value||0);
  const raw=document.getElementById("dnd-ac-edit-input")?.value?.trim(); if(raw){const value=Number(raw); if(!Number.isFinite(value)||value<0)return; builder.acOverride=value;} else delete builder.acOverride;
  await saveDndBuilderAndPlayer(builder,"Armor Class saved."); dndCloseModal("dnd-ac-modal");
}
function openDndActionInfo(name) {
  currentDndActionName=name; const row=dndActionRows(currentDndBuilderData||{}).find((r)=>r.name===name)||{name,type:"Action"}; document.getElementById("dnd-action-info-title").textContent=name; document.getElementById("dnd-action-info-type").textContent=row.type||"Action"; document.getElementById("dnd-action-info-body").textContent=DND_ACTION_DETAILS[name]||"Class feature.";
  renderDndActionResource(); dndOpenModal("dnd-action-info-modal");
}
function renderDndActionResource() {
  const box=document.getElementById("dnd-action-resource-controls"); const res=dndTrackedResourceForAction(currentDndBuilderData||{},currentDndActionName); if(!box)return;
  if(!res){box.hidden=true;return;} box.hidden=false; const current=Number(currentDndBuilderData?.resourceTracker?.[res.key]??res.current); document.getElementById("dnd-action-resource-value").textContent=`${current} / ${res.max}`; document.getElementById("dnd-action-resource-use").disabled=current<=0; document.getElementById("dnd-action-resource-restore").disabled=current>=res.max;
}
async function changeDndActionResource(delta) { const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const res=dndTrackedResourceForAction(builder,currentDndActionName); if(!res)return; const current=Number(builder.resourceTracker?.[res.key]??res.current); builder.resourceTracker[res.key]=Math.max(0,Math.min(res.max,current+delta)); await saveDndBuilderAndPlayer(builder,`${currentDndActionName} updated.`); renderDndActionResource(); }
function openDndWeaponPicker(index=null) {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const editing=Number.isInteger(index) && !!builder.weapons?.[index]; currentDndWeaponEditIndex=editing?index:null;
  const weapon=editing?builder.weapons[index]:{name:Object.keys(DND_WEAPON_META)[0],magic:0};
  const select=document.getElementById("dnd-weapon-select"); dndPopulateSelect(select,Object.keys(DND_WEAPON_META),weapon.name,(k)=>DND_WEAPON_META[k].label||k);
  document.getElementById("dnd-weapon-magic").value=String(Number(weapon.magic||0));
  document.getElementById("dnd-weapon-modal-title").textContent=editing?"Edit Weapon":"Add Weapon"; document.getElementById("dnd-save-weapon-button").textContent=editing?"Save Weapon":"Add Weapon";
  dndOpenModal("dnd-weapon-modal");
}
async function saveDndWeapon() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); builder.weapons=Array.isArray(builder.weapons)?builder.weapons:[];
  const weapon={name:document.getElementById("dnd-weapon-select").value,magic:Number(document.getElementById("dnd-weapon-magic").value||0)};
  const editing=Number.isInteger(currentDndWeaponEditIndex) && !!builder.weapons[currentDndWeaponEditIndex];
  if(editing) builder.weapons[currentDndWeaponEditIndex]=weapon; else builder.weapons.push(weapon);
  currentDndWeaponEditIndex=null; await saveDndBuilderAndPlayer(builder,editing?"Weapon updated.":"Weapon added."); dndCloseModal("dnd-weapon-modal");
}
async function removeDndWeapon(index) { const builder=dndNormalizeBuilder(currentDndBuilderData||{}); if(!Array.isArray(builder.weapons)||!builder.weapons[index])return; builder.weapons.splice(index,1); await saveDndBuilderAndPlayer(builder,"Weapon removed."); }
function openDndSpellPicker(kind) {
  currentDndSpellPickerKind=kind; const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const choices=dndAvailableSpells(builder,kind); const select=document.getElementById("dnd-spell-select"); select.innerHTML=choices.map((spell)=>`<option value="${escapeHtml(spell.name)}">${escapeHtml(spell.name)}${spell.level?` — Level ${spell.level}`:""}</option>`).join("");
  const cap=dndSpellCapacity(builder); const current=(builder.spells||[]).filter((s)=>kind==="cantrip"?Number(s.level||0)===0:Number(s.level||0)>0).length; const max=kind==="cantrip"?cap.cantrips:(cap.spells||cap.prepared||0); document.getElementById("dnd-spell-modal-title").textContent=kind==="cantrip"?"Add Cantrip":"Add Spell"; document.getElementById("dnd-spell-picker-count").textContent=max?`${current} / ${max}`:`${current}`; document.getElementById("dnd-save-spell-button").disabled=!choices.length || (max>0&&current>=max); dndOpenModal("dnd-spell-modal");
}
async function addDndSpell() { const name=document.getElementById("dnd-spell-select").value; const spell=DND_SPELLS.find((s)=>s.name===name); if(!spell)return; const builder=dndNormalizeBuilder(currentDndBuilderData||{}); builder.spells=Array.isArray(builder.spells)?builder.spells:[]; if(!builder.spells.some((s)=>s?.name===name))builder.spells.push({name:spell.name,level:spell.level}); await saveDndBuilderAndPlayer(builder,`${spell.name} added.`); dndCloseModal("dnd-spell-modal"); }
async function removeDndSpell(index) { const builder=dndNormalizeBuilder(currentDndBuilderData||{}); if(!Array.isArray(builder.spells)||!builder.spells[index])return; builder.spells.splice(index,1); await saveDndBuilderAndPlayer(builder,"Spell removed."); }
async function changeDndSpellSlot(level,delta) { const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const slots=dndSpellSlots(builder); const max=Number(slots[level-1]||0); const key=`spellslot-${level}`; const current=Number(builder.resourceTracker?.[key]??max); builder.resourceTracker[key]=Math.max(0,Math.min(max,current+delta)); await saveDndBuilderAndPlayer(builder,"Spell slots updated."); }
function applyDndProfileFields(builder) {
  const val=(id)=>document.getElementById(id)?.value;
  if(val("dnd-profile-name")!==undefined) builder.name=(val("dnd-profile-name")||"").trim()||builder.name;
  if(val("dnd-profile-species")!==undefined) builder.species=val("dnd-profile-species")||builder.species;
  if(val("dnd-profile-background")!==undefined) {
    builder.background=val("dnd-profile-background")||builder.background;
    builder.feats=Array.isArray(builder.feats)?builder.feats:[];
    const originFeat=DND_BACKGROUND_FEAT[builder.background];
    if(originFeat && !builder.feats.includes(originFeat)) builder.feats.push(originFeat);
  }
  if(val("dnd-profile-alignment")!==undefined) builder.alignment=(val("dnd-profile-alignment")||"").trim();
  if(val("dnd-profile-experience")!==undefined) builder.experience=Math.max(0,Number(val("dnd-profile-experience")||0));
  if(val("dnd-profile-features")!==undefined) builder.features=val("dnd-profile-features")||"";
  if(val("dnd-profile-equipment")!==undefined) builder.equipment=val("dnd-profile-equipment")||"";
  if(val("dnd-profile-traits")!==undefined) builder.personalTraits=val("dnd-profile-traits")||"";
  if(val("dnd-profile-ideals")!==undefined) builder.ideals=val("dnd-profile-ideals")||"";
  if(val("dnd-profile-bonds")!==undefined) builder.bonds=val("dnd-profile-bonds")||"";
  if(val("dnd-profile-flaws")!==undefined) builder.flaws=val("dnd-profile-flaws")||"";
  if(val("dnd-profile-notes")!==undefined) builder.notes=val("dnd-profile-notes")||"";
  builder.proficiencies={
    ...(builder.proficiencies||{}),
    armor:val("dnd-profile-prof-armor")??builder.proficiencies?.armor??"",
    weapons:val("dnd-profile-prof-weapons")??builder.proficiencies?.weapons??"",
    tools:val("dnd-profile-prof-tools")??builder.proficiencies?.tools??"",
    languages:val("dnd-profile-prof-languages")??builder.proficiencies?.languages??""
  };
  builder.money={...(builder.money||{})};
  ["pp","gp","ep","sp","cp"].forEach((key)=>{ const value=val(`dnd-profile-money-${key}`); if(value!==undefined) builder.money[key]=Math.max(0,Number(value||0)); });
  return builder;
}
async function saveDndProfile(options={}) {
  const status=document.getElementById("dnd-profile-autosave-status"); if(status) status.textContent="Saving…";
  try {
    const builder=applyDndProfileFields(dndNormalizeBuilder(currentDndBuilderData||{}));
    const renderNow=options.render===true && !dndEditingFieldHasFocus();
    if(options.render===true && !renderNow) dndDeferredLiveRender=true;
    await saveDndBuilderAndPlayer(builder,"Profile auto-saved.",{render:renderNow});
    if(status) status.textContent="Saved";
  } catch(error) {
    console.error(error); if(status) status.textContent=error.message||"Save failed";
  }
}
function scheduleDndProfileAutoSave(render=false) {
  clearTimeout(dndProfileAutoSaveTimer);
  const status=document.getElementById("dnd-profile-autosave-status"); if(status) status.textContent="Saving…";
  dndProfileAutoSaveTimer=setTimeout(()=>saveDndProfile({render}),800);
}
function maybePromptDndCreation(exists) { if(mode!=="dnd"||exists||dndCreationPrompted)return; dndCreationPrompted=true; setTimeout(openDndCharacterSetup,250); }
function openDndSkillProficiencyModal() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const rule=dndSkillChoiceRules(builder);
  const fixed=new Set([...(DND_BACKGROUND_SKILLS[builder.background]||[]),...(DND_SPECIES_SKILLS[builder.species]||[])]);
  const chosen=new Set((builder.extraSkillProficiencies||[]).filter(Boolean));
  const available=new Set([...rule.options,...chosen,...fixed]);
  const help=document.getElementById("dnd-skill-proficiency-help");
  if(help) help.textContent=`Choose up to ${rule.count} class skill proficienc${rule.count===1?"y":"ies"}. Background and species proficiencies are automatic.`;
  const target=document.getElementById("dnd-skill-proficiency-options"); if(!target)return;
  target.innerHTML=DND_ABILITY_ORDER.map((ability)=>{
    const skills=Object.keys(DND_SKILL_DATA).filter((skill)=>DND_SKILL_DATA[skill]===ability && available.has(skill));
    if(!skills.length)return"";
    return `<section class="dnd-skill-choice-group"><h4>${escapeHtml(ability)}</h4>${skills.map((skill)=>{
      const automatic=fixed.has(skill); const checked=automatic||chosen.has(skill); const eligible=rule.options.includes(skill)||chosen.has(skill);
      const source=automatic?((DND_BACKGROUND_SKILLS[builder.background]||[]).includes(skill)?`Background: ${builder.background}`:`Species: ${builder.species}`):"Class choice";
      return `<label class="dnd-skill-choice${automatic?" is-automatic":""}"><input type="checkbox" data-dnd-skill-choice="${escapeHtml(skill)}" ${checked?"checked":""} ${(automatic||!eligible)?"disabled":""}><span><strong>${escapeHtml(skill)}</strong><small>${escapeHtml(source)}</small></span></label>`;
    }).join("")}</section>`;
  }).join("");
  const status=document.getElementById("dnd-skill-proficiency-status"); if(status) status.textContent=`${chosen.size} / ${rule.count} class choices`;
  dndOpenModal("dnd-skill-proficiency-modal");
}
async function saveDndSkillProficiencies(changedInput=null) {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const rule=dndSkillChoiceRules(builder);
  const checked=[...document.querySelectorAll("[data-dnd-skill-choice]:checked:not(:disabled)")].map((el)=>el.dataset.dndSkillChoice);
  const status=document.getElementById("dnd-skill-proficiency-status");
  if(checked.length>rule.count){ if(changedInput) changedInput.checked=false; if(status) status.textContent=`Choose up to ${rule.count}.`; return; }
  builder.extraSkillProficiencies=checked.sort((a,b)=>a.localeCompare(b)); if(status) status.textContent="Saving…";
  await saveDndBuilderAndPlayer(builder,"Skill proficiencies auto-saved.");
  if(status) status.textContent=`${checked.length} / ${rule.count} class choices · Saved`;
}

function openDndProficiencyModal() {
  const builder=dndNormalizeBuilder(currentDndBuilderData||{}); const auto=dndAutomaticProficiencies(builder); const profs=builder.proficiencies||{};
  const target=document.getElementById("dnd-proficiency-auto");
  if(target) target.innerHTML=[
    ["Armor",auto.armor],["Weapons",auto.weapons],["Tools",auto.tools],["Languages",auto.languages],["Saving Throws",auto.saves]
  ].map(([label,values])=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml((values||[]).join(", ")||"None")}</strong></div>`).join("");
  const set=(id,value)=>{const el=document.getElementById(id); if(el) el.value=value||"";};
  set("dnd-proficiency-extra-armor",profs.armor); set("dnd-proficiency-extra-weapons",profs.weapons); set("dnd-proficiency-extra-tools",profs.tools); set("dnd-proficiency-extra-languages",profs.languages);
  const status=document.getElementById("dnd-proficiency-autosave-status"); if(status) status.textContent="Changes save automatically.";
  dndOpenModal("dnd-proficiency-modal");
}
function collectDndProficiencyExtras(builder=dndNormalizeBuilder(currentDndBuilderData||{})) {
  const value=(id)=>document.getElementById(id)?.value ?? "";
  builder.proficiencies={...(builder.proficiencies||{}),armor:value("dnd-proficiency-extra-armor"),weapons:value("dnd-proficiency-extra-weapons"),tools:value("dnd-proficiency-extra-tools"),languages:value("dnd-proficiency-extra-languages")};
  return builder;
}
async function saveDndProficiencyExtras() {
  const status=document.getElementById("dnd-proficiency-autosave-status"); if(status) status.textContent="Saving…";
  try {
    const builder=collectDndProficiencyExtras();
    await saveDndBuilderAndPlayer(builder,"Proficiencies auto-saved.",{render:false});
    if(status) status.textContent="Saved";
  } catch(error) {
    console.error(error); if(status) status.textContent=error.message||"Save failed";
  }
}
function scheduleDndProficiencyAutoSave() {
  clearTimeout(dndProficiencyAutoSaveTimer);
  const status=document.getElementById("dnd-proficiency-autosave-status"); if(status) status.textContent="Saving…";
  dndProficiencyAutoSaveTimer=setTimeout(saveDndProficiencyExtras,800);
}

function setupDndUnifiedControls() {
  document.querySelectorAll("[data-dnd-close]").forEach((button)=>button.addEventListener("click",()=>dndCloseModal(button.dataset.dndClose)));
  document.querySelectorAll(".dnd-sheet-modal").forEach((modal)=>modal.addEventListener("click",(event)=>{if(event.target===modal)dndCloseModal(modal.id);}));
  document.getElementById("dnd-character-menu-button")?.addEventListener("click",()=>dndOpenModal("dnd-character-menu-modal"));
  document.getElementById("dnd-menu-edit-character")?.addEventListener("click",()=>{dndCloseModal("dnd-character-menu-modal");openDndCharacterSetup();});
  document.getElementById("dnd-menu-level-up")?.addEventListener("click",()=>{dndCloseModal("dnd-character-menu-modal");openDndLevelUp(false);});
  document.getElementById("dnd-menu-multiclass")?.addEventListener("click",()=>{dndCloseModal("dnd-character-menu-modal");openDndLevelUp(true);});
  document.getElementById("dnd-edit-character-button")?.addEventListener("click",openDndCharacterSetup);
  document.getElementById("dnd-level-up-button")?.addEventListener("click",()=>openDndLevelUp(false));
  document.getElementById("dnd-multiclass-button")?.addEventListener("click",()=>openDndLevelUp(true));

  const setupModal=document.getElementById("dnd-character-setup-modal");
  setupModal?.addEventListener("input",(event)=>{ if(event.target.matches("input,textarea")) scheduleDndSetupAutoSave(false); });
  setupModal?.addEventListener("change",(event)=>{
    if(event.target.id==="dnd-setup-class") dndRefreshSetupSubclass();
    if(event.target.matches("select,input")) scheduleDndSetupAutoSave(true);
  });
  document.getElementById("dnd-setup-done")?.addEventListener("click",async()=>{ clearTimeout(dndSetupAutoSaveTimer); await saveDndCharacterSetup({render:true,closeAfter:true}); });

  document.getElementById("dnd-level-class")?.addEventListener("change",()=>{const hp=document.getElementById("dnd-level-hp-gain"); if(hp)hp.dataset.touched="";dndRefreshLevelUpModal();});
  document.getElementById("dnd-level-hp-gain")?.addEventListener("input",(event)=>{event.target.dataset.touched="1";});
  document.getElementById("dnd-confirm-level-up")?.addEventListener("click",confirmDndLevelUp);
  document.getElementById("dnd-hit-dice-button")?.addEventListener("click",openDndHitDice);
  document.getElementById("dnd-spend-hit-dice")?.addEventListener("click",spendDndHitDice);
  document.getElementById("dnd-restore-hit-dice")?.addEventListener("click",restoreDndHitDice);
  document.getElementById("dnd-ac-button")?.addEventListener("click",openDndAcEditor);
  document.getElementById("dnd-save-ac-button")?.addEventListener("click",saveDndAc);
  ["dnd-ac-armor-select","dnd-ac-armor-magic","dnd-ac-shield-select","dnd-ac-shield-magic"].forEach((id)=>document.getElementById(id)?.addEventListener("change",refreshDndAcPreview));
  document.getElementById("dnd-add-weapon-button")?.addEventListener("click",()=>openDndWeaponPicker());
  document.getElementById("dnd-save-weapon-button")?.addEventListener("click",saveDndWeapon);
  document.getElementById("dnd-add-cantrip-button")?.addEventListener("click",()=>openDndSpellPicker("cantrip"));
  document.getElementById("dnd-add-spell-button")?.addEventListener("click",()=>openDndSpellPicker("spell"));
  document.getElementById("dnd-save-spell-button")?.addEventListener("click",addDndSpell);
  document.getElementById("dnd-manage-skill-proficiencies")?.addEventListener("click",openDndSkillProficiencyModal);
  document.getElementById("dnd-skill-proficiency-done")?.addEventListener("click",()=>dndCloseModal("dnd-skill-proficiency-modal"));
  document.getElementById("dnd-proficiency-modal")?.addEventListener("input",(event)=>{if(event.target.matches("textarea,input")) scheduleDndProficiencyAutoSave();});
  document.getElementById("dnd-proficiency-done")?.addEventListener("click",async()=>{clearTimeout(dndProficiencyAutoSaveTimer); await saveDndProficiencyExtras(); dndCloseModal("dnd-proficiency-modal"); flushDndDeferredLiveRender();});
  document.getElementById("dnd-proficiency-manage-skills")?.addEventListener("click",()=>{dndCloseModal("dnd-proficiency-modal"); openDndSkillProficiencyModal();});
  document.getElementById("dnd-skill-proficiency-options")?.addEventListener("change",async(event)=>{ const input=event.target.closest("[data-dnd-skill-choice]"); if(input) await saveDndSkillProficiencies(input); });
  document.getElementById("dnd-action-resource-use")?.addEventListener("click",()=>changeDndActionResource(-1));
  document.getElementById("dnd-action-resource-restore")?.addEventListener("click",()=>changeDndActionResource(1));

  const app=document.getElementById("dnd-sheet-app");
  app?.addEventListener("input",(event)=>{
    if(event.target.closest("#dnd-profile-content") && event.target.matches("input,textarea")) scheduleDndProfileAutoSave(false);
  });
  app?.addEventListener("change",(event)=>{
    if(event.target.closest("#dnd-profile-content") && event.target.matches("select")) scheduleDndProfileAutoSave(true);
  });
  app?.addEventListener("click",async(event)=>{
    const action=event.target.closest("[data-dnd-action]"); if(action){openDndActionInfo(action.dataset.dndAction);return;}
    const editWeapon=event.target.closest("[data-dnd-edit-weapon]"); if(editWeapon){openDndWeaponPicker(Number(editWeapon.dataset.dndEditWeapon));return;}
    const removeWeapon=event.target.closest("[data-dnd-remove-weapon]"); if(removeWeapon){await removeDndWeapon(Number(removeWeapon.dataset.dndRemoveWeapon));return;}
    const removeSpell=event.target.closest("[data-dnd-remove-spell]"); if(removeSpell){await removeDndSpell(Number(removeSpell.dataset.dndRemoveSpell));return;}
    const useSlot=event.target.closest("[data-dnd-slot-use]"); if(useSlot){await changeDndSpellSlot(Number(useSlot.dataset.dndSlotUse),-1);return;}
    const restoreSlot=event.target.closest("[data-dnd-slot-restore]"); if(restoreSlot){await changeDndSpellSlot(Number(restoreSlot.dataset.dndSlotRestore),1);return;}
    if(event.target.id==="dnd-profile-level-up"){openDndLevelUp(false);return;}
    if(event.target.id==="dnd-profile-manage-skills"){openDndSkillProficiencyModal();return;}
    if(event.target.id==="dnd-profile-manage-proficiencies"){openDndProficiencyModal();return;}
  });
  document.addEventListener("focusout",()=>setTimeout(flushDndDeferredLiveRender,80));

  const lobbyHref=`lobby.html?code=${encodeURIComponent(code)}`;
  ["return-to-lobby-link","dnd-return-lobby","dnd-menu-return-lobby"].forEach((id)=>{const link=document.getElementById(id); if(link) link.href=lobbyHref;});
  const legacy=document.getElementById("dnd-legacy-builder-link"); if(legacy) legacy.href=`dnd_character_builder_firebase.html?code=${encodeURIComponent(code)}`;
}

function setupDndSheetCarousel() {
  const app=document.getElementById("dnd-sheet-app"), track=document.getElementById("dnd-sheet-track"); if(!app||!track)return; app.hidden=false;
  const effects=document.getElementById("player-effects-panel"), trackers=document.getElementById("player-trackers-panel"), notes=document.getElementById("player-shared-notes-panel");
  if(effects) document.getElementById("dnd-effects-mount")?.appendChild(effects); if(trackers) document.getElementById("dnd-trackers-mount")?.appendChild(trackers); if(notes) document.getElementById("dnd-notes-mount")?.appendChild(notes);
  app.querySelectorAll("[data-dnd-tab]").forEach((tab)=>tab.addEventListener("click",()=>goToDndPage(tab.dataset.dndTab)));
  app.querySelectorAll("[data-dnd-go]").forEach((button)=>button.addEventListener("click",()=>goToDndPage(button.dataset.dndGo)));
  document.getElementById("dnd-sheet-prev")?.addEventListener("click",()=>goToDndPage(currentDndPageIndex-1)); document.getElementById("dnd-sheet-next")?.addEventListener("click",()=>goToDndPage(currentDndPageIndex+1));
  let startX=null; track.addEventListener("pointerdown",(e)=>{ if(e.pointerType==="mouse" && window.innerWidth>720)return; startX=e.clientX; }); track.addEventListener("pointerup",(e)=>{ if(startX===null)return; const delta=e.clientX-startX; startX=null; if(Math.abs(delta)<45)return; goToDndPage(currentDndPageIndex+(delta<0?1:-1)); });
  document.getElementById("dnd-initiative-input")?.addEventListener("input",(e)=>{ const hidden=document.getElementById("player-initiative"); if(hidden) hidden.value=e.target.value; });
  document.getElementById("dnd-save-initiative-button")?.addEventListener("click",saveInitiativeToGame);
  window.addEventListener("resize", syncDndViewportHeight, { passive:true });
  if (window.ResizeObserver) { const observer=new ResizeObserver(()=>syncDndViewportHeight()); track.querySelectorAll("[data-dnd-page]").forEach((page)=>observer.observe(page)); }
  setupDndUnifiedControls();
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
      dndRenderOrDefer(currentDndBuilderData || {}, data);
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
      currentDndBuilderData = snapshot.exists() ? dndNormalizeBuilder(snapshot.val() || {}) : {};
      dndRenderOrDefer(currentDndBuilderData, getCurrentSheetCache() || {});
      maybePromptDndCreation(snapshot.exists());
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
  const tempToggle = document.getElementById("dnd-temp-hp-toggle");
  const allowTemp = !!tempToggle?.checked;
  const nextHp = allowTemp ? Math.max(0, currentHp + healAmount) : Math.min(maxHp, currentHp + healAmount);

  document.getElementById("player-hp").value = nextHp;
  if (input) input.value = "";
  if (tempToggle) tempToggle.checked = false;
  setDndResult(allowTemp && nextHp > maxHp ? `HP ${nextHp} · Temp +${nextHp - maxHp}` : `HP ${nextHp}`);
  updateDndHpView(builderData || {}, { ...sheet, currentHp: nextHp, hp: nextHp, baseHp: maxHp });
  scheduleAutoSave(allowTemp ? "Temporary HP applied." : "D&D healing applied.");
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
  const input = document.getElementById("ol-damage-input");
  const healAmount = parseNumber(input?.value, NaN);
  if (Number.isNaN(healAmount) || healAmount < 0) {
    setOlResult("Enter a valid amount.");
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
    if (input) input.value = "";
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