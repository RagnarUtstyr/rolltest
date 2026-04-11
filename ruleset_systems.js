
export const SYSTEMS = {
  dnd: {
    title: "D&D 5e",
    builderFile: "dnd_character_builder_firebase.html",
    theme: "dnd",
    overviewStats: [
      { key: "hp", label: "HP" },
      { key: "ac", label: "AC" },
      { key: "prof", label: "Prof" },
      { key: "initiative", label: "Init" },
      { key: "passivePerception", label: "Passive Per." },
      { key: "speed", label: "Speed" }
    ],
    resources: [
      { key: "tempHp", label: "Temp HP", type: "number" },
      { key: "hitDice", label: "Hit Dice", type: "text" },
      { key: "deathSuccesses", label: "Death Saves ✓", type: "number" },
      { key: "deathFailures", label: "Death Saves ✗", type: "number" },
      { key: "spellSaveDc", label: "Spell Save DC", type: "number" },
      { key: "spellAttack", label: "Spell Attack", type: "text" }
    ],
    combatSummary: ["Top attacks", "Slots / rage / ki / class resources", "Conditions & notes"]
  },
  openlegend: {
    title: "Open Legend",
    builderFile: "openlegend_character_builder.html",
    theme: "openlegend",
    overviewStats: [
      { key: "currentHp", label: "Current HP" },
      { key: "grd", label: "Guard" },
      { key: "res", label: "Resolve" },
      { key: "tgh", label: "Toughness" },
      { key: "initiative", label: "Init" },
      { key: "speed", label: "Speed" }
    ],
    resources: [
      { key: "boons", label: "Boons / edges", type: "text" },
      { key: "banesShort", label: "Active banes", type: "text" },
      { key: "attacks", label: "Primary attacks", type: "textarea" },
      { key: "notes", label: "Combat notes", type: "textarea" }
    ],
    combatSummary: ["Damage counter", "Banes / effects", "Primary attacks"]
  },
  pathfinder2e: {
    title: "Pathfinder 2e",
    builderFile: "pathfinder2e_character_builder.html",
    theme: "pathfinder2e",
    overviewStats: [
      { key: "hp", label: "HP" },
      { key: "ac", label: "AC" },
      { key: "perception", label: "Perception" },
      { key: "initiative", label: "Init" },
      { key: "fortitude", label: "Fort" },
      { key: "reflex", label: "Ref" },
      { key: "will", label: "Will" }
    ],
    resources: [
      { key: "speed", label: "Speed", type: "text" },
      { key: "classDc", label: "Class DC", type: "number" },
      { key: "spellDc", label: "Spell DC", type: "number" },
      { key: "heroPoints", label: "Hero Points", type: "number" },
      { key: "shield", label: "Shield / raised shield", type: "text" },
      { key: "attacks", label: "Top attacks", type: "textarea" },
      { key: "conditions", label: "Conditions", type: "textarea" }
    ],
    builderSections: [
      {
        title: "Identity & progression",
        fields: [
          ["name","Character name","text"],["level","Level","number"],["ancestry","Ancestry","text"],["heritage","Heritage","text"],
          ["background","Background","text"],["class","Class","text"],["keyAbility","Key ability","text"]
        ]
      },
      {
        title: "Core stats",
        fields: [
          ["hp","Max HP","number"],["currentHp","Current HP","number"],["ac","AC","number"],["perception","Perception","number"],
          ["fortitude","Fortitude","number"],["reflex","Reflex","number"],["will","Will","number"],["initiative","Initiative","number"],
          ["speed","Speed","text"],["classDc","Class DC","number"],["spellDc","Spell DC","number"],["heroPoints","Hero Points","number"]
        ]
      },
      {
        title: "Ability scores & proficiencies",
        fields: [
          ["str","STR","number"],["dex","DEX","number"],["con","CON","number"],["int","INT","number"],["wis","WIS","number"],["cha","CHA","number"],
          ["proficiencyNotes","Training / expert / master / legendary notes","textarea"]
        ]
      },
      {
        title: "Skills, feats, attacks, magic",
        fields: [
          ["skills","Skills summary","textarea"],["feats","Ancestry / class / skill feats","textarea"],["attacks","Top attacks","textarea"],
          ["spells","Spell prep / focus spells","textarea"],["gear","Armor, shield, worn items","textarea"],["notes","Session notes","textarea"]
        ]
      }
    ]
  },
  callofcthulhu7e: {
    title: "Call of Cthulhu 7e",
    builderFile: "callofcthulhu7e_character_builder.html",
    theme: "coc7e",
    overviewStats: [
      { key: "currentHp", label: "HP" },
      { key: "sanity", label: "SAN" },
      { key: "luck", label: "Luck" },
      { key: "magicPoints", label: "MP" },
      { key: "move", label: "Move" },
      { key: "build", label: "Build" }
    ],
    resources: [
      { key: "damageBonus", label: "Damage Bonus", type: "text" },
      { key: "dodge", label: "Dodge", type: "number" },
      { key: "majorWound", label: "Major wound?", type: "text" },
      { key: "weapons","Weapons","textarea" },
      { key: "skills","Key skills","textarea" },
      { key: "notes","Mythos / clues / notes","textarea" }
    ],
    builderSections: [
      {
        title: "Investigator identity",
        fields: [
          ["name","Investigator name","text"],["occupation","Occupation","text"],["age","Age","number"],["residence","Residence","text"],
          ["birthplace","Birthplace","text"],["era","Era / campaign","text"]
        ]
      },
      {
        title: "Characteristics & derived values",
        fields: [
          ["str","STR","number"],["con","CON","number"],["siz","SIZ","number"],["dex","DEX","number"],["app","APP","number"],["int","INT","number"],["pow","POW","number"],["edu","EDU","number"],
          ["currentHp","Current HP","number"],["hp","Max HP","number"],["magicPoints","Magic Points","number"],["sanity","Sanity","number"],["luck","Luck","number"],["move","Move","number"],["build","Build","text"],["damageBonus","Damage Bonus","text"]
        ]
      },
      {
        title: "Skills & equipment",
        fields: [
          ["dodge","Dodge","number"],["skills","Occupation / interest skills","textarea"],["weapons","Weapons / combat skills","textarea"],
          ["gear","Important gear","textarea"],["contacts","Contacts / allies","textarea"]
        ]
      },
      {
        title: "Investigator background",
        fields: [
          ["description","Description","textarea"],["ideology","Ideology / beliefs","textarea"],["people","Significant people","textarea"],
          ["places","Meaningful locations","textarea"],["possessions","Treasured possessions","textarea"],["traits","Traits / injuries / phobias","textarea"],["notes","Keeper notes","textarea"]
        ]
      }
    ]
  },
  savageworlds: {
    title: "Savage Worlds",
    builderFile: "savageworlds_character_builder.html",
    theme: "savageworlds",
    overviewStats: [
      { key: "wounds", label: "Wounds" },
      { key: "fatigue", label: "Fatigue" },
      { key: "parry", label: "Parry" },
      { key: "toughness", label: "Toughness" },
      { key: "pace", label: "Pace" },
      { key: "bennies", label: "Bennies" }
    ],
    resources: [
      { key: "conviction", label: "Conviction", type: "number" },
      { key: "attributes", label: "Attributes", type: "textarea" },
      { key: "skills", label: "Key skills", type: "textarea" },
      { key: "edges","Edges & hindrances","textarea" },
      { key: "attacks","Weapons / powers","textarea" }
    ]
  },
  vampire5e: {
    title: "Vampire 5e",
    builderFile: "vampire5e_character_builder.html",
    theme: "vampire5e",
    overviewStats: [
      { key: "health", label: "Health" },
      { key: "willpower", label: "Willpower" },
      { key: "hunger", label: "Hunger" },
      { key: "humanity", label: "Humanity" },
      { key: "bloodPotency", label: "Blood Potency" },
      { key: "initiative", label: "Init" }
    ],
    resources: [
      { key: "clan", label: "Clan", type: "text" },
      { key: "predatorType", label: "Predator type", type: "text" },
      { key: "disciplines", label: "Disciplines", type: "textarea" },
      { key: "dicePools", label: "Main dice pools", type: "textarea" },
      { key: "notes", label: "Compulsions / notes", type: "textarea" }
    ]
  },
  cyberpunkred: {
    title: "Cyberpunk RED",
    builderFile: "cyberpunkred_character_builder.html",
    theme: "cyberpunkred",
    overviewStats: [
      { key: "currentHp", label: "HP" },
      { key: "bodyArmorSp", label: "Body SP" },
      { key: "headArmorSp", label: "Head SP" },
      { key: "move", label: "MOVE" },
      { key: "humanity", label: "Humanity" },
      { key: "initiative", label: "Init" }
    ],
    resources: [
      { key: "role", label: "Role", type: "text" },
      { key: "roleAbility", label: "Role ability", type: "text" },
      { key: "reputation", label: "Rep", type: "number" },
      { key: "weapons", label: "Weapons / ammo", type: "textarea" },
      { key: "cyberware", label: "Cyberware", type: "textarea" },
      { key: "notes", label: "Critical injuries / notes", type: "textarea" }
    ],
    builderSections: [
      {
        title: "Edgerunner identity",
        fields: [
          ["name","Handle / name","text"],["role","Role","text"],["roleAbility","Role ability","text"],["reputation","Reputation","number"],["lifepath","Lifepath summary","textarea"]
        ]
      },
      {
        title: "Stats & derived combat values",
        fields: [
          ["int","INT","number"],["ref","REF","number"],["dex","DEX","number"],["tech","TECH","number"],["cool","COOL","number"],["will","WILL","number"],["luck","LUCK","number"],["move","MOVE","number"],["body","BODY","number"],["emp","EMP","number"],
          ["hp","Max HP","number"],["currentHp","Current HP","number"],["humanity","Humanity","number"],["initiative","Initiative","number"],["bodyArmorSp","Body armor SP","number"],["headArmorSp","Head armor SP","number"]
        ]
      },
      {
        title: "Skills, gear, and chrome",
        fields: [
          ["skills","Key skills","textarea"],["weapons","Weapons / ammo / attack notes","textarea"],["armor","Armor & penalties","textarea"],
          ["cyberware","Cyberware","textarea"],["gear","Gear / cash / lifestyle","textarea"]
        ]
      },
      {
        title: "Campaign notes",
        fields: [
          ["allies","Allies / enemies","textarea"],["fashion","Style / outfit","textarea"],["notes","Critical injuries / notes","textarea"]
        ]
      }
    ]
  },
  lancer: {
    title: "Lancer",
    builderFile: "lancer_character_builder.html",
    theme: "lancer",
    overviewStats: [
      { key: "mechHp", label: "Mech HP" },
      { key: "heat", label: "Heat" },
      { key: "armor", label: "Armor" },
      { key: "evasion", label: "Evasion" },
      { key: "eDefense", label: "E-Def" },
      { key: "repairs", label: "Repairs" },
      { key: "structure", label: "Structure" },
      { key: "stress", label: "Stress" }
    ],
    resources: [
      { key: "pilotHp", label: "Pilot HP", type: "number" },
      { key: "speed", label: "Speed", type: "number" },
      { key: "frame", label: "Frame", type: "text" },
      { key: "mounts", label: "Mounts / weapons", type: "textarea" },
      { key: "systems", label: "Systems / limited gear", type: "textarea" },
      { key: "notes", label: "Statuses / notes", type: "textarea" }
    ],
    builderSections: [
      {
        title: "Pilot & license",
        fields: [
          ["name","Pilot name","text"],["callsign","Callsign","text"],["licenseLevel","License level","number"],["background","Background","text"],["talents","Talents","textarea"],["triggers","Triggers / pilot skills","textarea"]
        ]
      },
      {
        title: "Pilot stats",
        fields: [
          ["pilotHp","Pilot HP","number"],["armorPilot","Pilot armor","number"],["grit","Grit","number"],["hull","HULL","number"],["agility","AGI","number"],["systemsStat","SYS","number"],["engineering","ENG","number"]
        ]
      },
      {
        title: "Mech stats",
        fields: [
          ["frame","Frame","text"],["mechHp","Mech HP","number"],["heat","Heat","number"],["heatCap","Heat Cap","number"],["armor","Armor","number"],["evasion","Evasion","number"],["eDefense","E-Defense","number"],["speed","Speed","number"],["repairs","Repairs","number"],["structure","Structure","number"],["stress","Stress","number"]
        ]
      },
      {
        title: "Weapons, systems, and combat notes",
        fields: [
          ["mounts","Mounts / weapons","textarea"],["systems","Systems / tech / limited gear","textarea"],["coreBonus","Core bonus / frame traits","textarea"],["notes","Combat notes","textarea"]
        ]
      }
    ]
  },
  shadowdark: {
    title: "Shadowdark",
    builderFile: "shadowdark_character_builder.html",
    theme: "shadowdark",
    overviewStats: [
      { key: "hp", label: "HP" },
      { key: "ac", label: "AC" },
      { key: "attackBonus", label: "Attack" },
      { key: "torch", label: "Torch" },
      { key: "slots", label: "Slots" },
      { key: "speed", label: "Speed" }
    ],
    resources: [
      { key: "class", label: "Class", type: "text" },
      { key: "level", label: "Level", type: "number" },
      { key: "weapon", label: "Main weapon", type: "text" },
      { key: "spells", label: "Spells", type: "textarea" },
      { key: "gear", label: "Gear / slots", type: "textarea" }
    ]
  },
  warhammer4e: {
    title: "Warhammer Fantasy Roleplay 4e",
    builderFile: "warhammer4e_character_builder.html",
    theme: "wfrp4e",
    overviewStats: [
      { key: "wounds", label: "Wounds" },
      { key: "movement", label: "Move" },
      { key: "advantage", label: "Advantage" },
      { key: "fortune", label: "Fortune" },
      { key: "resilience", label: "Resilience" },
      { key: "initiative", label: "Init" }
    ],
    resources: [
      { key: "career", label: "Career", type: "text" },
      { key: "characteristics", label: "Main characteristics", type: "textarea" },
      { key: "armor", label: "Armor / locations", type: "textarea" },
      { key: "skills", label: "Skills / talents", type: "textarea" },
      { key: "notes", label: "Criticals / corruption / notes", type: "textarea" }
    ]
  },
  starfinder: {
    title: "Starfinder",
    builderFile: "starfinder_character_builder.html",
    theme: "starfinder",
    overviewStats: [
      { key: "sp", label: "Stamina" },
      { key: "hp", label: "HP" },
      { key: "rp", label: "Resolve" },
      { key: "eac", label: "EAC" },
      { key: "kac", label: "KAC" },
      { key: "initiative", label: "Init" }
    ],
    resources: [
      { key: "speed", label: "Speed", type: "text" },
      { key: "class", label: "Class", type: "text" },
      { key: "weapons", label: "Weapons", type: "textarea" },
      { key: "abilities", label: "Spells / tech abilities", type: "textarea" },
      { key: "notes", label: "Conditions / gear", type: "textarea" }
    ]
  }
};

export function normalizeMode(mode) {
  const value = String(mode || "").toLowerCase();
  const aliases = {
    ol: "openlegend",
    open_legend: "openlegend",
    pf2e: "pathfinder2e",
    coc7e: "callofcthulhu7e",
    swade: "savageworlds",
    vtm5e: "vampire5e",
    worldofdarkness: "vampire5e",
    wfrp4e: "warhammer4e"
  };
  return aliases[value] || value;
}

export function getSystemConfig(mode) {
  const key = normalizeMode(mode);
  return SYSTEMS[key] || SYSTEMS.openlegend;
}
