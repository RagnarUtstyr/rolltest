export const RULESET_SYSTEMS = {
  pathfinder2e: {
    key: 'pathfinder2e',
    name: 'Pathfinder 2E',
    shortName: 'PF2E',
    builderPath: 'pathfinder2e_character_builder.html',
    accent: '#29539b',
    description: 'Guided PF2E first-level character worksheet with ancestry, background, class, ability scores, skills, proficiencies, and derived modifiers.',
    rulesBasis: 'Open reference workflow based on Pathfinder 2e character creation and ability boost rules.',
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'className', label: 'Class', type: 'text', section: 'identity', placeholder: 'Fighter' },
      { id: 'ancestry', label: 'Ancestry', type: 'text', section: 'identity', placeholder: 'Human' },
      { id: 'background', label: 'Background', type: 'text', section: 'identity', placeholder: 'Guard' },
      { id: 'level', label: 'Level', type: 'number', section: 'identity', min: 1, max: 20, defaultValue: 1 },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat', help: 'Usually Perception modifier, but may vary.' },
      { id: 'maxHp', label: 'Max HP', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Current HP', type: 'number', section: 'combat' },
      { id: 'ac', label: 'AC', type: 'number', section: 'combat' },
      { id: 'perception', label: 'Perception', type: 'number', section: 'combat' },
      { id: 'str', label: 'STR', type: 'number', section: 'abilities' },
      { id: 'dex', label: 'DEX', type: 'number', section: 'abilities' },
      { id: 'con', label: 'CON', type: 'number', section: 'abilities' },
      { id: 'int', label: 'INT', type: 'number', section: 'abilities' },
      { id: 'wis', label: 'WIS', type: 'number', section: 'abilities' },
      { id: 'cha', label: 'CHA', type: 'number', section: 'abilities' },
      { id: 'keyAbility', label: 'Key Ability', type: 'text', section: 'choices', placeholder: 'Strength' },
      { id: 'trainedSkills', label: 'Trained Skills', type: 'textarea', section: 'choices', placeholder: 'Athletics, Intimidation, Medicine' },
      { id: 'feats', label: 'Feats / Features', type: 'textarea', section: 'choices' },
      { id: 'equipment', label: 'Equipment', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['className', 'ancestry', 'background', 'level'],
    derived(values) {
      const map = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      return map.map((id) => {
        const score = Number(values[id]);
        if (Number.isNaN(score)) return null;
        const mod = Math.floor((score - 10) / 2);
        return { label: `${id.toUpperCase()} mod`, value: mod >= 0 ? `+${mod}` : `${mod}` };
      }).filter(Boolean);
    }
  },
  coc7e: {
    key: 'coc7e',
    name: 'Call of Cthulhu 7E',
    shortName: 'CoC 7E',
    builderPath: 'coc7_character_builder.html',
    accent: '#70543d',
    description: 'Investigator worksheet for characteristics, occupation, key skills, weapons, and derived CoC 7e secondary attributes.',
    rulesBasis: 'Based on Chaosium investigator characteristic and secondary attribute guidance.',
    fields: [
      { id: 'characterName', label: 'Investigator Name', type: 'text', section: 'identity' },
      { id: 'occupation', label: 'Occupation', type: 'text', section: 'identity', placeholder: 'Journalist' },
      { id: 'age', label: 'Age', type: 'number', section: 'identity' },
      { id: 'residence', label: 'Residence', type: 'text', section: 'identity' },
      { id: 'era', label: 'Era / Campaign', type: 'text', section: 'identity', placeholder: '1920s' },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat', help: 'A practical tracker field for your site.' },
      { id: 'currentHp', label: 'Current HP', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max HP', type: 'number', section: 'combat' },
      { id: 'sanity', label: 'Sanity', type: 'number', section: 'combat' },
      { id: 'magicPoints', label: 'Magic Points', type: 'number', section: 'combat' },
      { id: 'luck', label: 'Luck', type: 'number', section: 'combat' },
      { id: 'str', label: 'STR', type: 'number', section: 'abilities' },
      { id: 'con', label: 'CON', type: 'number', section: 'abilities' },
      { id: 'siz', label: 'SIZ', type: 'number', section: 'abilities' },
      { id: 'dex', label: 'DEX', type: 'number', section: 'abilities' },
      { id: 'app', label: 'APP', type: 'number', section: 'abilities' },
      { id: 'int', label: 'INT', type: 'number', section: 'abilities' },
      { id: 'pow', label: 'POW', type: 'number', section: 'abilities' },
      { id: 'edu', label: 'EDU', type: 'number', section: 'abilities' },
      { id: 'occupationSkills', label: 'Occupation Skills', type: 'textarea', section: 'choices' },
      { id: 'personalInterestSkills', label: 'Personal Interest Skills', type: 'textarea', section: 'choices' },
      { id: 'weapons', label: 'Weapons / Combat Skills', type: 'textarea', section: 'choices' },
      { id: 'backstory', label: 'Backstory', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['occupation', 'era', 'age'],
    derived(values) {
      const stats = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu'];
      const derivedCards = [];
      for (const id of stats) {
        const score = Number(values[id]);
        if (Number.isNaN(score)) continue;
        derivedCards.push({ label: `${id.toUpperCase()} half`, value: Math.floor(score / 2) });
        derivedCards.push({ label: `${id.toUpperCase()} fifth`, value: Math.floor(score / 5) });
      }
      const con = Number(values.con);
      const siz = Number(values.siz);
      const pow = Number(values.pow);
      if (!Number.isNaN(con) && !Number.isNaN(siz)) {
        derivedCards.unshift({ label: 'HP guideline', value: Math.floor((con + siz) / 10) });
      }
      if (!Number.isNaN(pow)) {
        derivedCards.unshift({ label: 'MP guideline', value: Math.floor(pow / 5) });
        derivedCards.unshift({ label: 'Starting SAN', value: pow });
      }
      return derivedCards;
    }
  },
  savageworlds: {
    key: 'savageworlds',
    name: 'Savage Worlds Adventure Edition',
    shortName: 'SWADE',
    builderPath: 'savageworlds_character_builder.html',
    accent: '#8d4a2d',
    description: 'Trait and derived-stat worksheet for SWADE-style characters, with clear spots for Hindrances, Edges, skills, pace, toughness, and parry.',
    rulesBasis: 'Uses public SWADE trait structure; detailed edge/hindrance legality remains GM/manual.' ,
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'archetype', label: 'Archetype / Role', type: 'text', section: 'identity' },
      { id: 'species', label: 'Ancestry / Species', type: 'text', section: 'identity' },
      { id: 'rank', label: 'Rank', type: 'text', section: 'identity', defaultValue: 'Novice' },
      { id: 'initiative', label: 'Initiative / Card Notes', type: 'text', section: 'combat', placeholder: 'Usually tracked by cards' },
      { id: 'currentHp', label: 'Current Wounds', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max Wounds', type: 'number', section: 'combat', defaultValue: 3 },
      { id: 'pace', label: 'Pace', type: 'number', section: 'combat' },
      { id: 'parry', label: 'Parry', type: 'number', section: 'combat' },
      { id: 'toughness', label: 'Toughness', type: 'number', section: 'combat' },
      { id: 'agility', label: 'Agility Die', type: 'text', section: 'abilities', placeholder: 'd8' },
      { id: 'smarts', label: 'Smarts Die', type: 'text', section: 'abilities', placeholder: 'd6' },
      { id: 'spirit', label: 'Spirit Die', type: 'text', section: 'abilities', placeholder: 'd6' },
      { id: 'strength', label: 'Strength Die', type: 'text', section: 'abilities', placeholder: 'd6' },
      { id: 'vigor', label: 'Vigor Die', type: 'text', section: 'abilities', placeholder: 'd8' },
      { id: 'skills', label: 'Skills', type: 'textarea', section: 'choices' },
      { id: 'edges', label: 'Edges', type: 'textarea', section: 'choices' },
      { id: 'hindrances', label: 'Hindrances', type: 'textarea', section: 'choices' },
      { id: 'gear', label: 'Gear / Powers', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['archetype', 'species', 'rank']
  },
  vampire5e: {
    key: 'vampire5e',
    name: 'Vampire: The Masquerade 5E',
    shortName: 'V5',
    builderPath: 'vampire5_character_builder.html',
    accent: '#7a1020',
    description: 'Chronicle-friendly V5 worksheet with attributes, hunger, health, willpower, clan, predator type, disciplines, and convictions.',
    rulesBasis: 'Built as a guided V5 sheet rather than a full legality engine.',
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'clan', label: 'Clan', type: 'text', section: 'identity' },
      { id: 'predatorType', label: 'Predator Type', type: 'text', section: 'identity' },
      { id: 'generation', label: 'Generation / Blood Potency Notes', type: 'text', section: 'identity' },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Health', type: 'number', section: 'combat' },
      { id: 'willpower', label: 'Willpower', type: 'number', section: 'combat' },
      { id: 'hunger', label: 'Hunger', type: 'number', section: 'combat', min: 0, max: 5 },
      { id: 'strength', label: 'Strength', type: 'number', section: 'abilities' },
      { id: 'dexterity', label: 'Dexterity', type: 'number', section: 'abilities' },
      { id: 'stamina', label: 'Stamina', type: 'number', section: 'abilities' },
      { id: 'charisma', label: 'Charisma', type: 'number', section: 'abilities' },
      { id: 'manipulation', label: 'Manipulation', type: 'number', section: 'abilities' },
      { id: 'composure', label: 'Composure', type: 'number', section: 'abilities' },
      { id: 'intelligence', label: 'Intelligence', type: 'number', section: 'abilities' },
      { id: 'wits', label: 'Wits', type: 'number', section: 'abilities' },
      { id: 'resolve', label: 'Resolve', type: 'number', section: 'abilities' },
      { id: 'skills', label: 'Skills', type: 'textarea', section: 'choices' },
      { id: 'disciplines', label: 'Disciplines', type: 'textarea', section: 'choices' },
      { id: 'convictions', label: 'Convictions / Touchstones', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Chronicle Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['clan', 'predatorType', 'generation']
  },
  cyberpunkred: {
    key: 'cyberpunkred',
    name: 'Cyberpunk RED',
    shortName: 'CP:R',
    builderPath: 'cyberpunkred_character_builder.html',
    accent: '#c3212c',
    description: 'Easy Mode-compatible cyberpunk sheet with role, key stats, skills, armor, HP, humanity, and gear notes.',
    rulesBasis: 'Built around the public Character Tools / Easy Mode field structure, with manual validation for book-only options.',
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'role', label: 'Role', type: 'text', section: 'identity', placeholder: 'Solo' },
      { id: 'lifepath', label: 'Lifepath Summary', type: 'textarea', section: 'identity' },
      { id: 'reputation', label: 'Reputation', type: 'number', section: 'identity' },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Current HP', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max HP', type: 'number', section: 'combat' },
      { id: 'armorSp', label: 'Armor SP', type: 'number', section: 'combat' },
      { id: 'humanity', label: 'Humanity', type: 'number', section: 'combat' },
      { id: 'int', label: 'INT', type: 'number', section: 'abilities' },
      { id: 'ref', label: 'REF', type: 'number', section: 'abilities' },
      { id: 'dex', label: 'DEX', type: 'number', section: 'abilities' },
      { id: 'tech', label: 'TECH', type: 'number', section: 'abilities' },
      { id: 'cool', label: 'COOL', type: 'number', section: 'abilities' },
      { id: 'will', label: 'WILL', type: 'number', section: 'abilities' },
      { id: 'luck', label: 'LUCK', type: 'number', section: 'abilities' },
      { id: 'move', label: 'MOVE', type: 'number', section: 'abilities' },
      { id: 'body', label: 'BODY', type: 'number', section: 'abilities' },
      { id: 'emp', label: 'EMP', type: 'number', section: 'abilities' },
      { id: 'skills', label: 'Key Skills', type: 'textarea', section: 'choices' },
      { id: 'cyberware', label: 'Cyberware', type: 'textarea', section: 'choices' },
      { id: 'gear', label: 'Weapons / Gear', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['role', 'reputation']
  },
  lancer: {
    key: 'lancer',
    name: 'Lancer',
    shortName: 'Lancer',
    builderPath: 'lancer_character_builder.html',
    accent: '#5c77d6',
    description: 'Pilot + mech worksheet for Lancer with pilot callsign, triggers, mech skills, licenses, frame, HP, heat, and structure notes.',
    rulesBasis: 'Companion worksheet aligned to the common pilot/mech sheet structure; full license validation is manual.',
    fields: [
      { id: 'characterName', label: 'Pilot Name / Callsign', type: 'text', section: 'identity' },
      { id: 'licenseLevel', label: 'License Level', type: 'number', section: 'identity', min: 0, max: 12, defaultValue: 0 },
      { id: 'background', label: 'Background', type: 'text', section: 'identity' },
      { id: 'frame', label: 'Current Frame', type: 'text', section: 'identity', placeholder: 'EVEREST' },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Mech HP', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max HP', type: 'number', section: 'combat' },
      { id: 'evasion', label: 'Evasion', type: 'number', section: 'combat' },
      { id: 'edefense', label: 'E-Defense', type: 'number', section: 'combat' },
      { id: 'heatCap', label: 'Heat Cap', type: 'number', section: 'combat' },
      { id: 'structure', label: 'Structure', type: 'number', section: 'combat' },
      { id: 'stress', label: 'Stress', type: 'number', section: 'combat' },
      { id: 'hull', label: 'Hull', type: 'number', section: 'abilities' },
      { id: 'agility', label: 'Agility', type: 'number', section: 'abilities' },
      { id: 'systems', label: 'Systems', type: 'number', section: 'abilities' },
      { id: 'engineering', label: 'Engineering', type: 'number', section: 'abilities' },
      { id: 'triggers', label: 'Triggers', type: 'textarea', section: 'choices' },
      { id: 'talents', label: 'Talents', type: 'textarea', section: 'choices' },
      { id: 'licenses', label: 'Licenses / Systems', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Mission Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['licenseLevel', 'frame', 'background']
  },
  shadowdark: {
    key: 'shadowdark',
    name: 'Shadowdark RPG',
    shortName: 'Shadowdark',
    builderPath: 'shadowdark_character_builder.html',
    accent: '#80693f',
    description: 'Quickstart-friendly Shadowdark builder for class, ancestry, core six abilities, HP, AC, gear, talents, and torch-tracked notes.',
    rulesBasis: 'Grounded in the free Shadowdark quickstart character creation flow.',
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'className', label: 'Class', type: 'text', section: 'identity', placeholder: 'Fighter' },
      { id: 'ancestry', label: 'Ancestry', type: 'text', section: 'identity', placeholder: 'Human' },
      { id: 'level', label: 'Level', type: 'number', section: 'identity', min: 1, max: 10, defaultValue: 1 },
      { id: 'alignment', label: 'Alignment', type: 'text', section: 'identity' },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Current HP', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max HP', type: 'number', section: 'combat' },
      { id: 'ac', label: 'AC', type: 'number', section: 'combat' },
      { id: 'str', label: 'STR', type: 'number', section: 'abilities' },
      { id: 'dex', label: 'DEX', type: 'number', section: 'abilities' },
      { id: 'con', label: 'CON', type: 'number', section: 'abilities' },
      { id: 'int', label: 'INT', type: 'number', section: 'abilities' },
      { id: 'wis', label: 'WIS', type: 'number', section: 'abilities' },
      { id: 'cha', label: 'CHA', type: 'number', section: 'abilities' },
      { id: 'talents', label: 'Talents / Spells', type: 'textarea', section: 'choices' },
      { id: 'gear', label: 'Gear', type: 'textarea', section: 'choices' },
      { id: 'torchTime', label: 'Torch / Light Notes', type: 'text', section: 'choices' },
      { id: 'notes', label: 'Adventure Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['className', 'ancestry', 'alignment', 'level'],
    derived(values) {
      const map = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      return map.map((id) => {
        const score = Number(values[id]);
        if (Number.isNaN(score)) return null;
        const mod = Math.floor((score - 10) / 2);
        return { label: `${id.toUpperCase()} mod`, value: mod >= 0 ? `+${mod}` : `${mod}` };
      }).filter(Boolean);
    }
  },
  wfrp4e: {
    key: 'wfrp4e',
    name: 'Warhammer Fantasy Roleplay 4E',
    shortName: 'WFRP 4E',
    builderPath: 'wfrp4_character_builder.html',
    accent: '#8a7c34',
    description: 'Old World worksheet for species, career, characteristics, wounds, advantage notes, skills, talents, and trappings.',
    rulesBasis: 'Structured from the common WFRP4e character sheet profile layout; detailed advances remain manual.',
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'species', label: 'Species', type: 'text', section: 'identity' },
      { id: 'career', label: 'Career', type: 'text', section: 'identity' },
      { id: 'status', label: 'Status', type: 'text', section: 'identity' },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Current Wounds', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max Wounds', type: 'number', section: 'combat' },
      { id: 'move', label: 'Move', type: 'number', section: 'combat' },
      { id: 'weaponSkill', label: 'Weapon Skill', type: 'number', section: 'abilities' },
      { id: 'ballisticSkill', label: 'Ballistic Skill', type: 'number', section: 'abilities' },
      { id: 'strength', label: 'Strength', type: 'number', section: 'abilities' },
      { id: 'toughness', label: 'Toughness', type: 'number', section: 'abilities' },
      { id: 'initiativeStat', label: 'Initiative Stat', type: 'number', section: 'abilities' },
      { id: 'agility', label: 'Agility', type: 'number', section: 'abilities' },
      { id: 'dexterity', label: 'Dexterity', type: 'number', section: 'abilities' },
      { id: 'intelligence', label: 'Intelligence', type: 'number', section: 'abilities' },
      { id: 'willpower', label: 'Willpower', type: 'number', section: 'abilities' },
      { id: 'fellowship', label: 'Fellowship', type: 'number', section: 'abilities' },
      { id: 'skills', label: 'Skills', type: 'textarea', section: 'choices' },
      { id: 'talents', label: 'Talents', type: 'textarea', section: 'choices' },
      { id: 'trappings', label: 'Trappings', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Campaign Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['species', 'career', 'status']
  },
  starfinder: {
    key: 'starfinder',
    name: 'Starfinder',
    shortName: 'Starfinder',
    builderPath: 'starfinder_character_builder.html',
    accent: '#2d7d8f',
    description: 'Starfinder worksheet for species, class, theme/background, stamina/HP, AC, six abilities, proficiencies, feats, and gear.',
    rulesBasis: 'A current Starfinder-compatible scaffold using Paizo’s official character-creation guidance and a flexible sheet format.',
    fields: [
      { id: 'characterName', label: 'Character Name', type: 'text', section: 'identity' },
      { id: 'species', label: 'Species / Ancestry', type: 'text', section: 'identity' },
      { id: 'className', label: 'Class', type: 'text', section: 'identity' },
      { id: 'theme', label: 'Theme / Background', type: 'text', section: 'identity' },
      { id: 'level', label: 'Level', type: 'number', section: 'identity', defaultValue: 1 },
      { id: 'initiative', label: 'Initiative', type: 'number', section: 'combat' },
      { id: 'stamina', label: 'Stamina', type: 'number', section: 'combat' },
      { id: 'currentHp', label: 'Current HP', type: 'number', section: 'combat' },
      { id: 'maxHp', label: 'Max HP', type: 'number', section: 'combat' },
      { id: 'eac', label: 'EAC', type: 'number', section: 'combat' },
      { id: 'kac', label: 'KAC', type: 'number', section: 'combat' },
      { id: 'str', label: 'STR', type: 'number', section: 'abilities' },
      { id: 'dex', label: 'DEX', type: 'number', section: 'abilities' },
      { id: 'con', label: 'CON', type: 'number', section: 'abilities' },
      { id: 'int', label: 'INT', type: 'number', section: 'abilities' },
      { id: 'wis', label: 'WIS', type: 'number', section: 'abilities' },
      { id: 'cha', label: 'CHA', type: 'number', section: 'abilities' },
      { id: 'skills', label: 'Skills / Proficiencies', type: 'textarea', section: 'choices' },
      { id: 'feats', label: 'Feats / Features', type: 'textarea', section: 'choices' },
      { id: 'gear', label: 'Weapons / Armor / Gear', type: 'textarea', section: 'choices' },
      { id: 'notes', label: 'Notes', type: 'textarea', section: 'notes' }
    ],
    summaryFields: ['species', 'className', 'theme', 'level']
  }
};

export function getRulesetSystem(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  return RULESET_SYSTEMS[normalized] || null;
}

export const EXTRA_RULESET_KEYS = Object.keys(RULESET_SYSTEMS);
