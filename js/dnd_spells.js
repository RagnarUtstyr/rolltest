/*
  D&D spell library adapter.

  This work includes material from the System Reference Document 5.2.1
  ("SRD 5.2.1") by Wizards of the Coast LLC, available at
  https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the
  Creative Commons Attribution 4.0 International License, available at
  https://creativecommons.org/licenses/by/4.0/legalcode.

  The application keeps spell-index metadata and, when supplied by the SRD
  source, components and rules text used by the in-sheet spell detail modal.
  The complete SRD spell index is loaded from a public SRD 5.2.1 JSON mirror
  and cached locally. A bundled fallback keeps the sheet usable if the mirror
  is unavailable.
*/

const CACHE_KEY = "rpg-dnd-srd-5.2.1-spell-index-v2";
const SOURCE_URLS = [
  "https://cdn.jsdelivr.net/gh/rschaeff/srd@master/spells.json",
  "https://raw.githubusercontent.com/rschaeff/srd/refs/heads/master/spells.json"
];

const CLASS_CASE = new Map(
  ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"]
    .map((name) => [name, name[0].toUpperCase() + name.slice(1)])
);

function titleCaseClass(value) {
  const key = String(value || "").trim().toLowerCase();
  return CLASS_CASE.get(key) || String(value || "").trim();
}

function normalizeSpell(raw = {}) {
  const level = Number(raw.level ?? 0);
  const classes = Array.isArray(raw.classes)
    ? raw.classes.map((entry) => titleCaseClass(typeof entry === "string" ? entry : (entry?.name || entry?.class || ""))).filter(Boolean)
    : [];
  const schoolRaw = typeof raw.school === "object" ? (raw.school?.name || raw.school?.index || "Spell") : (raw.school || "Spell");
  const school = String(schoolRaw).trim();
  const time = String(raw.casting_time ?? raw.castingTime ?? raw.actionType ?? raw.time ?? "—").trim();
  const range = String(raw.range ?? "—").trim();
  const duration = String(raw.duration ?? "").trim();
  const componentSource = raw.components ?? raw.component ?? "";
  const components = Array.isArray(componentSource)
    ? componentSource.map((entry) => typeof entry === "string" ? entry : (entry?.name || entry?.index || "")).filter(Boolean)
    : typeof componentSource === "object" && componentSource
      ? Object.entries(componentSource).filter(([,value]) => Boolean(value)).map(([key]) => key.toUpperCase())
      : String(componentSource || "").split(/[,/]/).map((item) => item.trim()).filter(Boolean);
  const material = String(raw.material ?? raw.materials ?? raw.material_component ?? "").trim();
  const descriptionSource = raw.desc ?? raw.description ?? raw.text ?? "";
  const higherSource = raw.higher_level ?? raw.higherLevel ?? raw.at_higher_levels ?? "";
  const description = Array.isArray(descriptionSource) ? descriptionSource.join("\n\n") : String(descriptionSource || "").trim();
  const higherLevel = Array.isArray(higherSource) ? higherSource.join("\n\n") : String(higherSource || "").trim();
  return {
    name: String(raw.name || "").trim(),
    level: Number.isFinite(level) ? Math.max(0, Math.min(9, level)) : 0,
    school: school ? school[0].toUpperCase() + school.slice(1) : "Spell",
    classes,
    time,
    range,
    ritual: Boolean(raw.ritual),
    concentration: Boolean(raw.concentration) || /^concentration/i.test(duration),
    duration,
    components,
    material,
    description,
    higherLevel
  };
}

function compactUnique(spells = []) {
  const byName = new Map();
  spells.forEach((raw) => {
    const spell = normalizeSpell(raw);
    if (!spell.name) return;
    const existing = byName.get(spell.name);
    if (!existing) {
      byName.set(spell.name, spell);
      return;
    }
    const classes = [...new Set([...(existing.classes || []), ...(spell.classes || [])])];
    byName.set(spell.name, { ...existing, ...spell, classes });
  });
  return [...byName.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// Offline fallback. The online SRD source replaces this with the complete
// SRD 5.2.1 spell index (339 spells) whenever it is reachable.
const FALLBACK = compactUnique([
  // Cantrips
  {name:"Acid Splash",level:0,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"60 feet"},
  {name:"Blade Ward",level:0,school:"Abjuration",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self"},
  {name:"Chill Touch",level:0,school:"Necromancy",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"120 feet"},
  {name:"Dancing Lights",level:0,school:"Illusion",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Eldritch Blast",level:0,school:"Evocation",classes:["Warlock"],time:"Action",range:"120 feet"},
  {name:"Fire Bolt",level:0,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"120 feet"},
  {name:"Guidance",level:0,school:"Divination",classes:["Cleric","Druid"],time:"Action",range:"Touch",concentration:true},
  {name:"Light",level:0,school:"Evocation",classes:["Bard","Cleric","Sorcerer","Wizard"],time:"Action",range:"Touch"},
  {name:"Mage Hand",level:0,school:"Conjuration",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet"},
  {name:"Minor Illusion",level:0,school:"Illusion",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet"},
  {name:"Poison Spray",level:0,school:"Necromancy",classes:["Druid","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet"},
  {name:"Prestidigitation",level:0,school:"Transmutation",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"10 feet"},
  {name:"Ray of Frost",level:0,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"60 feet"},
  {name:"Resistance",level:0,school:"Abjuration",classes:["Cleric","Druid"],time:"Action",range:"Touch",concentration:true},
  {name:"Sacred Flame",level:0,school:"Evocation",classes:["Cleric"],time:"Action",range:"60 feet"},
  {name:"Shillelagh",level:0,school:"Transmutation",classes:["Druid"],time:"Bonus Action",range:"Self"},
  {name:"Shocking Grasp",level:0,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"Touch"},
  {name:"Spare the Dying",level:0,school:"Necromancy",classes:["Cleric"],time:"Action",range:"Touch"},
  {name:"Thaumaturgy",level:0,school:"Transmutation",classes:["Cleric"],time:"Action",range:"30 feet"},
  {name:"True Strike",level:0,school:"Divination",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self"},

  // Level 1
  {name:"Alarm",level:1,school:"Abjuration",classes:["Ranger","Wizard"],time:"1 minute",range:"30 feet",ritual:true},
  {name:"Animal Friendship",level:1,school:"Enchantment",classes:["Bard","Druid","Ranger"],time:"Action",range:"30 feet"},
  {name:"Bane",level:1,school:"Enchantment",classes:["Bard","Cleric"],time:"Action",range:"30 feet",concentration:true},
  {name:"Bless",level:1,school:"Enchantment",classes:["Cleric","Paladin"],time:"Action",range:"30 feet",concentration:true},
  {name:"Burning Hands",level:1,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Charm Person",level:1,school:"Enchantment",classes:["Bard","Druid","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet"},
  {name:"Command",level:1,school:"Enchantment",classes:["Bard","Cleric","Paladin"],time:"Action",range:"60 feet"},
  {name:"Comprehend Languages",level:1,school:"Divination",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self",ritual:true},
  {name:"Cure Wounds",level:1,school:"Abjuration",classes:["Bard","Cleric","Druid","Paladin","Ranger"],time:"Action",range:"Touch"},
  {name:"Detect Magic",level:1,school:"Divination",classes:["Bard","Cleric","Druid","Paladin","Ranger","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self",ritual:true,concentration:true},
  {name:"Disguise Self",level:1,school:"Illusion",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self"},
  {name:"Divine Favor",level:1,school:"Transmutation",classes:["Paladin"],time:"Bonus Action",range:"Self"},
  {name:"Divine Smite",level:1,school:"Evocation",classes:["Paladin"],time:"Bonus Action",range:"Self"},
  {name:"Faerie Fire",level:1,school:"Evocation",classes:["Bard","Druid"],time:"Action",range:"60 feet",concentration:true},
  {name:"Feather Fall",level:1,school:"Transmutation",classes:["Bard","Sorcerer","Wizard"],time:"Reaction",range:"60 feet"},
  {name:"Find Familiar",level:1,school:"Conjuration",classes:["Wizard"],time:"1 hour",range:"10 feet",ritual:true},
  {name:"Fog Cloud",level:1,school:"Conjuration",classes:["Druid","Ranger","Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Goodberry",level:1,school:"Conjuration",classes:["Druid","Ranger"],time:"Action",range:"Self"},
  {name:"Guiding Bolt",level:1,school:"Evocation",classes:["Cleric"],time:"Action",range:"120 feet"},
  {name:"Healing Word",level:1,school:"Abjuration",classes:["Bard","Cleric","Druid"],time:"Bonus Action",range:"60 feet"},
  {name:"Heroism",level:1,school:"Enchantment",classes:["Bard","Paladin"],time:"Action",range:"Touch",concentration:true},
  {name:"Hex",level:1,school:"Enchantment",classes:["Warlock"],time:"Bonus Action",range:"90 feet",concentration:true},
  {name:"Identify",level:1,school:"Divination",classes:["Bard","Wizard"],time:"1 minute",range:"Touch",ritual:true},
  {name:"Illusory Script",level:1,school:"Illusion",classes:["Bard","Warlock","Wizard"],time:"1 minute",range:"Touch",ritual:true},
  {name:"Inflict Wounds",level:1,school:"Necromancy",classes:["Cleric"],time:"Action",range:"Touch"},
  {name:"Jump",level:1,school:"Transmutation",classes:["Druid","Ranger","Sorcerer","Wizard"],time:"Bonus Action",range:"Touch"},
  {name:"Longstrider",level:1,school:"Transmutation",classes:["Bard","Druid","Ranger","Wizard"],time:"Action",range:"Touch"},
  {name:"Mage Armor",level:1,school:"Abjuration",classes:["Sorcerer","Wizard"],time:"Action",range:"Touch"},
  {name:"Magic Missile",level:1,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"120 feet"},
  {name:"Protection from Evil and Good",level:1,school:"Abjuration",classes:["Cleric","Druid","Paladin","Warlock","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Ray of Sickness",level:1,school:"Necromancy",classes:["Sorcerer","Wizard"],time:"Action",range:"60 feet"},
  {name:"Sanctuary",level:1,school:"Abjuration",classes:["Cleric"],time:"Bonus Action",range:"30 feet"},
  {name:"Shield",level:1,school:"Abjuration",classes:["Sorcerer","Wizard"],time:"Reaction",range:"Self"},
  {name:"Sleep",level:1,school:"Enchantment",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Thunderwave",level:1,school:"Evocation",classes:["Bard","Druid","Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Witch Bolt",level:1,school:"Evocation",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},

  // Level 2
  {name:"Acid Arrow",level:2,school:"Evocation",classes:["Wizard"],time:"Action",range:"90 feet"},
  {name:"Aid",level:2,school:"Abjuration",classes:["Bard","Cleric","Druid","Paladin","Ranger"],time:"Action",range:"30 feet"},
  {name:"Alter Self",level:2,school:"Transmutation",classes:["Sorcerer","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Animal Messenger",level:2,school:"Enchantment",classes:["Bard","Druid","Ranger"],time:"Action",range:"30 feet",ritual:true},
  {name:"Arcane Lock",level:2,school:"Abjuration",classes:["Wizard"],time:"Action",range:"Touch"},
  {name:"Blindness/Deafness",level:2,school:"Transmutation",classes:["Bard","Cleric","Sorcerer","Wizard"],time:"Action",range:"120 feet"},
  {name:"Blur",level:2,school:"Illusion",classes:["Sorcerer","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Darkness",level:2,school:"Evocation",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Darkvision",level:2,school:"Transmutation",classes:["Druid","Ranger","Sorcerer","Wizard"],time:"Action",range:"Touch"},
  {name:"Enhance Ability",level:2,school:"Transmutation",classes:["Bard","Cleric","Druid","Ranger","Sorcerer","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Enlarge/Reduce",level:2,school:"Transmutation",classes:["Bard","Druid","Sorcerer","Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"Find Steed",level:2,school:"Conjuration",classes:["Paladin"],time:"10 minutes",range:"30 feet"},
  {name:"Hold Person",level:2,school:"Enchantment",classes:["Bard","Cleric","Druid","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Invisibility",level:2,school:"Illusion",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Knock",level:2,school:"Transmutation",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"60 feet"},
  {name:"Lesser Restoration",level:2,school:"Abjuration",classes:["Bard","Cleric","Druid","Paladin","Ranger"],time:"Bonus Action",range:"Touch"},
  {name:"Levitate",level:2,school:"Transmutation",classes:["Sorcerer","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Locate Animals or Plants",level:2,school:"Divination",classes:["Bard","Druid","Ranger"],time:"Action",range:"Self",ritual:true},
  {name:"Locate Object",level:2,school:"Divination",classes:["Bard","Cleric","Druid","Paladin","Ranger","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Magic Weapon",level:2,school:"Transmutation",classes:["Paladin","Ranger","Sorcerer","Wizard"],time:"Bonus Action",range:"Touch"},
  {name:"Misty Step",level:2,school:"Conjuration",classes:["Sorcerer","Warlock","Wizard"],time:"Bonus Action",range:"Self"},
  {name:"Pass without Trace",level:2,school:"Abjuration",classes:["Druid","Ranger"],time:"Action",range:"Self",concentration:true},
  {name:"Prayer of Healing",level:2,school:"Abjuration",classes:["Cleric","Paladin"],time:"10 minutes",range:"30 feet"},
  {name:"Protection from Poison",level:2,school:"Abjuration",classes:["Cleric","Druid","Paladin","Ranger"],time:"Action",range:"Touch"},
  {name:"Ray of Enfeeblement",level:2,school:"Necromancy",classes:["Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Scorching Ray",level:2,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"120 feet"},
  {name:"See Invisibility",level:2,school:"Divination",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Shatter",level:2,school:"Evocation",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet"},
  {name:"Silence",level:2,school:"Illusion",classes:["Bard","Cleric","Ranger"],time:"Action",range:"120 feet",ritual:true,concentration:true},
  {name:"Spider Climb",level:2,school:"Transmutation",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Spiritual Weapon",level:2,school:"Evocation",classes:["Cleric"],time:"Bonus Action",range:"60 feet",concentration:true},
  {name:"Suggestion",level:2,school:"Enchantment",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet",concentration:true},

  // Level 3
  {name:"Animate Dead",level:3,school:"Necromancy",classes:["Cleric","Wizard"],time:"1 minute",range:"10 feet"},
  {name:"Bestow Curse",level:3,school:"Necromancy",classes:["Bard","Cleric","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Clairvoyance",level:3,school:"Divination",classes:["Bard","Cleric","Sorcerer","Wizard"],time:"10 minutes",range:"1 mile",concentration:true},
  {name:"Counterspell",level:3,school:"Abjuration",classes:["Sorcerer","Warlock","Wizard"],time:"Reaction",range:"60 feet"},
  {name:"Daylight",level:3,school:"Evocation",classes:["Cleric","Druid","Paladin","Ranger","Sorcerer"],time:"Action",range:"60 feet"},
  {name:"Dispel Magic",level:3,school:"Abjuration",classes:["Bard","Cleric","Druid","Paladin","Sorcerer","Warlock","Wizard"],time:"Action",range:"120 feet"},
  {name:"Fear",level:3,school:"Illusion",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Fireball",level:3,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"150 feet"},
  {name:"Fly",level:3,school:"Transmutation",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Haste",level:3,school:"Transmutation",classes:["Sorcerer","Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"Hypnotic Pattern",level:3,school:"Illusion",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Lightning Bolt",level:3,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Major Image",level:3,school:"Illusion",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Protection from Energy",level:3,school:"Abjuration",classes:["Cleric","Druid","Ranger","Sorcerer","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Remove Curse",level:3,school:"Abjuration",classes:["Cleric","Paladin","Warlock","Wizard"],time:"Action",range:"Touch"},
  {name:"Revivify",level:3,school:"Necromancy",classes:["Cleric","Druid","Paladin","Ranger"],time:"Action",range:"Touch"},
  {name:"Sending",level:3,school:"Divination",classes:["Bard","Cleric","Wizard"],time:"Action",range:"Unlimited"},
  {name:"Spirit Guardians",level:3,school:"Conjuration",classes:["Cleric"],time:"Action",range:"Self",concentration:true},
  {name:"Tiny Hut",level:3,school:"Evocation",classes:["Bard","Wizard"],time:"1 minute",range:"Self",ritual:true},
  {name:"Tongues",level:3,school:"Divination",classes:["Bard","Cleric","Sorcerer","Warlock","Wizard"],time:"Action",range:"Touch"},
  {name:"Vampiric Touch",level:3,school:"Necromancy",classes:["Warlock","Wizard"],time:"Action",range:"Self",concentration:true},

  // Level 4
  {name:"Arcane Eye",level:4,school:"Divination",classes:["Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"Banishment",level:4,school:"Abjuration",classes:["Cleric","Paladin","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"Black Tentacles",level:4,school:"Conjuration",classes:["Wizard"],time:"Action",range:"90 feet",concentration:true},
  {name:"Blight",level:4,school:"Necromancy",classes:["Druid","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet"},
  {name:"Charm Monster",level:4,school:"Enchantment",classes:["Bard","Druid","Sorcerer","Warlock","Wizard"],time:"Action",range:"30 feet"},
  {name:"Confusion",level:4,school:"Enchantment",classes:["Bard","Druid","Sorcerer","Wizard"],time:"Action",range:"90 feet",concentration:true},
  {name:"Conjure Minor Elementals",level:4,school:"Conjuration",classes:["Druid","Wizard"],time:"Action",range:"90 feet",concentration:true},
  {name:"Control Water",level:4,school:"Transmutation",classes:["Cleric","Druid","Wizard"],time:"Action",range:"300 feet",concentration:true},
  {name:"Death Ward",level:4,school:"Abjuration",classes:["Cleric","Paladin"],time:"Action",range:"Touch"},
  {name:"Dimension Door",level:4,school:"Conjuration",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"500 feet"},
  {name:"Divination",level:4,school:"Divination",classes:["Cleric","Druid","Wizard"],time:"Action",range:"Self",ritual:true},
  {name:"Dominate Beast",level:4,school:"Enchantment",classes:["Druid","Sorcerer"],time:"Action",range:"60 feet",concentration:true},
  {name:"Fabricate",level:4,school:"Transmutation",classes:["Wizard"],time:"10 minutes",range:"120 feet"},
  {name:"Fire Shield",level:4,school:"Evocation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Freedom of Movement",level:4,school:"Abjuration",classes:["Bard","Cleric","Druid","Ranger"],time:"Action",range:"Touch"},
  {name:"Greater Invisibility",level:4,school:"Illusion",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Hallucinatory Terrain",level:4,school:"Illusion",classes:["Bard","Druid","Warlock","Wizard"],time:"10 minutes",range:"300 feet"},
  {name:"Ice Storm",level:4,school:"Evocation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"300 feet"},
  {name:"Locate Creature",level:4,school:"Divination",classes:["Bard","Cleric","Druid","Paladin","Ranger","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Phantasmal Killer",level:4,school:"Illusion",classes:["Bard","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Polymorph",level:4,school:"Transmutation",classes:["Bard","Druid","Sorcerer","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Resilient Sphere",level:4,school:"Abjuration",classes:["Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"Stone Shape",level:4,school:"Transmutation",classes:["Cleric","Druid","Wizard"],time:"Action",range:"Touch"},
  {name:"Stoneskin",level:4,school:"Transmutation",classes:["Druid","Ranger","Sorcerer","Wizard"],time:"Action",range:"Touch",concentration:true},
  {name:"Wall of Fire",level:4,school:"Evocation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},

  // Level 5
  {name:"Animate Objects",level:5,school:"Transmutation",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Antilife Shell",level:5,school:"Abjuration",classes:["Druid"],time:"Action",range:"Self",concentration:true},
  {name:"Arcane Hand",level:5,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Awaken",level:5,school:"Transmutation",classes:["Bard","Druid"],time:"8 hours",range:"Touch"},
  {name:"Cloudkill",level:5,school:"Conjuration",classes:["Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Commune",level:5,school:"Divination",classes:["Cleric"],time:"1 minute",range:"Self",ritual:true},
  {name:"Commune with Nature",level:5,school:"Divination",classes:["Druid","Ranger"],time:"1 minute",range:"Self",ritual:true},
  {name:"Cone of Cold",level:5,school:"Evocation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Conjure Elemental",level:5,school:"Conjuration",classes:["Druid","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Contact Other Plane",level:5,school:"Divination",classes:["Warlock","Wizard"],time:"1 minute",range:"Self",ritual:true},
  {name:"Contagion",level:5,school:"Necromancy",classes:["Cleric","Druid"],time:"Action",range:"Touch"},
  {name:"Creation",level:5,school:"Illusion",classes:["Sorcerer","Wizard"],time:"1 minute",range:"30 feet"},
  {name:"Dispel Evil and Good",level:5,school:"Abjuration",classes:["Cleric","Paladin"],time:"Action",range:"Self",concentration:true},
  {name:"Dominate Person",level:5,school:"Enchantment",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Dream",level:5,school:"Illusion",classes:["Bard","Warlock","Wizard"],time:"1 minute",range:"Special"},
  {name:"Geas",level:5,school:"Enchantment",classes:["Bard","Cleric","Druid","Paladin","Wizard"],time:"1 minute",range:"60 feet"},
  {name:"Greater Restoration",level:5,school:"Abjuration",classes:["Bard","Cleric","Druid","Ranger"],time:"Action",range:"Touch"},
  {name:"Hold Monster",level:5,school:"Enchantment",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"90 feet",concentration:true},
  {name:"Legend Lore",level:5,school:"Divination",classes:["Bard","Cleric","Wizard"],time:"10 minutes",range:"Self"},
  {name:"Mass Cure Wounds",level:5,school:"Abjuration",classes:["Bard","Cleric","Druid"],time:"Action",range:"60 feet"},
  {name:"Mislead",level:5,school:"Illusion",classes:["Bard","Warlock","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Passwall",level:5,school:"Transmutation",classes:["Wizard"],time:"Action",range:"30 feet"},
  {name:"Planar Binding",level:5,school:"Abjuration",classes:["Bard","Cleric","Druid","Wizard"],time:"1 hour",range:"60 feet"},
  {name:"Raise Dead",level:5,school:"Necromancy",classes:["Bard","Cleric","Paladin"],time:"1 hour",range:"Touch"},
  {name:"Reincarnate",level:5,school:"Necromancy",classes:["Druid"],time:"1 hour",range:"Touch"},
  {name:"Scrying",level:5,school:"Divination",classes:["Bard","Cleric","Druid","Warlock","Wizard"],time:"10 minutes",range:"Self",concentration:true},
  {name:"Seeming",level:5,school:"Illusion",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"30 feet"},
  {name:"Telekinesis",level:5,school:"Transmutation",classes:["Sorcerer","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Teleportation Circle",level:5,school:"Conjuration",classes:["Bard","Sorcerer","Wizard"],time:"1 minute",range:"10 feet"},
  {name:"Tree Stride",level:5,school:"Conjuration",classes:["Druid","Ranger"],time:"Action",range:"Self",concentration:true},
  {name:"Wall of Force",level:5,school:"Evocation",classes:["Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Wall of Stone",level:5,school:"Evocation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},

  // Level 6
  {name:"Arcane Gate",level:6,school:"Conjuration",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"500 feet",concentration:true},
  {name:"Blade Barrier",level:6,school:"Evocation",classes:["Cleric"],time:"Action",range:"90 feet",concentration:true},
  {name:"Circle of Death",level:6,school:"Necromancy",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"150 feet"},
  {name:"Conjure Fey",level:6,school:"Conjuration",classes:["Druid","Warlock"],time:"Action",range:"60 feet",concentration:true},
  {name:"Create Undead",level:6,school:"Necromancy",classes:["Cleric","Warlock","Wizard"],time:"1 minute",range:"10 feet"},
  {name:"Disintegrate",level:6,school:"Transmutation",classes:["Sorcerer","Wizard"],time:"Action",range:"60 feet"},
  {name:"Eyebite",level:6,school:"Necromancy",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Find the Path",level:6,school:"Divination",classes:["Bard","Cleric","Druid"],time:"1 minute",range:"Self",concentration:true},
  {name:"Flesh to Stone",level:6,school:"Transmutation",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Globe of Invulnerability",level:6,school:"Abjuration",classes:["Sorcerer","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Harm",level:6,school:"Necromancy",classes:["Cleric"],time:"Action",range:"60 feet"},
  {name:"Heal",level:6,school:"Abjuration",classes:["Cleric","Druid"],time:"Action",range:"60 feet"},
  {name:"Heroes' Feast",level:6,school:"Conjuration",classes:["Cleric","Druid"],time:"10 minutes",range:"Self"},
  {name:"Irresistible Dance",level:6,school:"Enchantment",classes:["Bard","Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"Mass Suggestion",level:6,school:"Enchantment",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet"},
  {name:"Move Earth",level:6,school:"Transmutation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Planar Ally",level:6,school:"Conjuration",classes:["Cleric"],time:"10 minutes",range:"60 feet"},
  {name:"Programmed Illusion",level:6,school:"Illusion",classes:["Bard","Wizard"],time:"Action",range:"120 feet"},
  {name:"Sunbeam",level:6,school:"Evocation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"True Seeing",level:6,school:"Divination",classes:["Bard","Cleric","Sorcerer","Warlock","Wizard"],time:"Action",range:"Touch"},
  {name:"Wall of Ice",level:6,school:"Evocation",classes:["Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Wind Walk",level:6,school:"Transmutation",classes:["Druid"],time:"1 minute",range:"30 feet"},
  {name:"Word of Recall",level:6,school:"Conjuration",classes:["Cleric"],time:"Bonus Action",range:"5 feet"},

  // Level 7
  {name:"Arcane Sword",level:7,school:"Evocation",classes:["Bard","Wizard"],time:"Action",range:"90 feet",concentration:true},
  {name:"Delayed Blast Fireball",level:7,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"150 feet",concentration:true},
  {name:"Etherealness",level:7,school:"Conjuration",classes:["Bard","Cleric","Sorcerer","Warlock","Wizard"],time:"Action",range:"Self"},
  {name:"Finger of Death",level:7,school:"Necromancy",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet"},
  {name:"Fire Storm",level:7,school:"Evocation",classes:["Cleric","Druid","Sorcerer"],time:"Action",range:"150 feet"},
  {name:"Forcecage",level:7,school:"Evocation",classes:["Bard","Warlock","Wizard"],time:"Action",range:"100 feet"},
  {name:"Mirage Arcane",level:7,school:"Illusion",classes:["Bard","Druid","Wizard"],time:"10 minutes",range:"Sight"},
  {name:"Plane Shift",level:7,school:"Conjuration",classes:["Cleric","Druid","Sorcerer","Warlock","Wizard"],time:"Action",range:"Touch"},
  {name:"Prismatic Spray",level:7,school:"Evocation",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"Regenerate",level:7,school:"Transmutation",classes:["Bard","Cleric","Druid"],time:"1 minute",range:"Touch"},
  {name:"Resurrection",level:7,school:"Necromancy",classes:["Bard","Cleric"],time:"1 hour",range:"Touch"},
  {name:"Reverse Gravity",level:7,school:"Transmutation",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"100 feet",concentration:true},
  {name:"Simulacrum",level:7,school:"Illusion",classes:["Wizard"],time:"12 hours",range:"Touch"},
  {name:"Symbol",level:7,school:"Abjuration",classes:["Bard","Cleric","Druid","Wizard"],time:"1 minute",range:"Touch"},
  {name:"Teleport",level:7,school:"Conjuration",classes:["Bard","Sorcerer","Wizard"],time:"Action",range:"10 feet"},

  // Level 8
  {name:"Animal Shapes",level:8,school:"Transmutation",classes:["Druid"],time:"Action",range:"30 feet"},
  {name:"Antimagic Field",level:8,school:"Abjuration",classes:["Cleric","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Antipathy/Sympathy",level:8,school:"Enchantment",classes:["Bard","Druid","Wizard"],time:"1 hour",range:"60 feet"},
  {name:"Befuddlement",level:8,school:"Enchantment",classes:["Bard","Druid","Warlock","Wizard"],time:"Action",range:"150 feet"},
  {name:"Control Weather",level:8,school:"Transmutation",classes:["Cleric","Druid","Wizard"],time:"10 minutes",range:"Self",concentration:true},
  {name:"Demiplane",level:8,school:"Conjuration",classes:["Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet"},
  {name:"Dominate Monster",level:8,school:"Enchantment",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Earthquake",level:8,school:"Transmutation",classes:["Cleric","Druid","Sorcerer"],time:"Action",range:"500 feet",concentration:true},
  {name:"Glibness",level:8,school:"Enchantment",classes:["Bard","Warlock"],time:"Action",range:"Self"},
  {name:"Holy Aura",level:8,school:"Abjuration",classes:["Cleric"],time:"Action",range:"Self",concentration:true},
  {name:"Incendiary Cloud",level:8,school:"Conjuration",classes:["Druid","Sorcerer","Wizard"],time:"Action",range:"150 feet",concentration:true},
  {name:"Maze",level:8,school:"Conjuration",classes:["Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Mind Blank",level:8,school:"Abjuration",classes:["Bard","Wizard"],time:"Action",range:"Touch"},
  {name:"Power Word Stun",level:8,school:"Enchantment",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet"},
  {name:"Sunburst",level:8,school:"Evocation",classes:["Cleric","Druid","Sorcerer","Wizard"],time:"Action",range:"150 feet"},

  // Level 9
  {name:"Astral Projection",level:9,school:"Necromancy",classes:["Cleric","Warlock","Wizard"],time:"1 hour",range:"10 feet"},
  {name:"Foresight",level:9,school:"Divination",classes:["Bard","Druid","Warlock","Wizard"],time:"1 minute",range:"Touch"},
  {name:"Gate",level:9,school:"Conjuration",classes:["Cleric","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet",concentration:true},
  {name:"Imprisonment",level:9,school:"Abjuration",classes:["Warlock","Wizard"],time:"1 minute",range:"30 feet"},
  {name:"Mass Heal",level:9,school:"Abjuration",classes:["Cleric"],time:"Action",range:"60 feet"},
  {name:"Meteor Swarm",level:9,school:"Evocation",classes:["Sorcerer","Wizard"],time:"Action",range:"1 mile"},
  {name:"Power Word Heal",level:9,school:"Enchantment",classes:["Bard","Cleric"],time:"Action",range:"60 feet"},
  {name:"Power Word Kill",level:9,school:"Enchantment",classes:["Bard","Sorcerer","Warlock","Wizard"],time:"Action",range:"60 feet"},
  {name:"Prismatic Wall",level:9,school:"Abjuration",classes:["Bard","Wizard"],time:"Action",range:"60 feet"},
  {name:"Shapechange",level:9,school:"Transmutation",classes:["Druid","Wizard"],time:"Action",range:"Self",concentration:true},
  {name:"Time Stop",level:9,school:"Transmutation",classes:["Sorcerer","Wizard"],time:"Action",range:"Self"},
  {name:"True Polymorph",level:9,school:"Transmutation",classes:["Bard","Warlock","Wizard"],time:"Action",range:"30 feet",concentration:true},
  {name:"True Resurrection",level:9,school:"Necromancy",classes:["Cleric","Druid"],time:"1 hour",range:"Touch"},
  {name:"Weird",level:9,school:"Illusion",classes:["Warlock","Wizard"],time:"Action",range:"120 feet",concentration:true},
  {name:"Wish",level:9,school:"Conjuration",classes:["Sorcerer","Wizard"],time:"Action",range:"Self"}
]);

export let DND_SPELLS = [...FALLBACK];
let libraryState = {
  loaded: false,
  complete: false,
  count: DND_SPELLS.length,
  source: "bundled fallback",
  error: ""
};
let loadingPromise = null;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 250) return null;
    return compactUnique(parsed);
  } catch (_) {
    return null;
  }
}

function writeCache(spells) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(spells));
  } catch (_) {
    // Cache is optional (private browsing / storage quota may block it).
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "force-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadDndSpellLibrary() {
  if (libraryState.loaded && libraryState.complete) return DND_SPELLS;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const cached = readCache();
    if (cached?.length >= 250) {
      DND_SPELLS = cached;
      libraryState = { loaded: true, complete: true, count: cached.length, source: "local SRD cache", error: "" };
      return DND_SPELLS;
    }

    let lastError = "";
    for (const url of SOURCE_URLS) {
      try {
        const raw = await fetchJsonWithTimeout(url);
        const spells = compactUnique(raw);
        if (spells.length < 250) throw new Error(`Spell source returned only ${spells.length} entries`);
        DND_SPELLS = spells;
        writeCache(spells);
        libraryState = { loaded: true, complete: true, count: spells.length, source: "SRD 5.2.1", error: "" };
        return DND_SPELLS;
      } catch (error) {
        lastError = String(error?.message || error || "Spell source unavailable");
      }
    }

    libraryState = {
      loaded: true,
      complete: false,
      count: DND_SPELLS.length,
      source: "bundled fallback",
      error: lastError
    };
    return DND_SPELLS;
  })();

  return loadingPromise;
}

export function getDndSpellLibraryState() {
  return { ...libraryState };
}

export function findDndSpell(name) {
  const wanted = String(name || "").trim().toLowerCase();
  return DND_SPELLS.find((spell) => spell.name.toLowerCase() === wanted) || null;
}

export function getDndSpellsByLevel(level) {
  const wanted = Number(level);
  return DND_SPELLS.filter((spell) => spell.level === wanted);
}

export function getDndSpellsForClass(className, { minLevel = 0, maxLevel = 9 } = {}) {
  const wanted = titleCaseClass(className);
  return DND_SPELLS.filter((spell) =>
    spell.level >= Number(minLevel) &&
    spell.level <= Number(maxLevel) &&
    spell.classes.includes(wanted)
  );
}
