export const OPENLEGEND_WEAPON_VS_OPTIONS = Object.freeze([
  "GRD",
  "RES",
  "TGH",
  "RES/TGH"
]);

export const OPENLEGEND_WEAPONS = Object.freeze([
  { key: "unarmed-strike", name: "Unarmed Strike", category: "Basic", defaultAttribute: "Agility", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Basic", "Melee"], notes: "Basic physical attack." },
  { key: "dagger", name: "Dagger", category: "Melee", defaultAttribute: "Agility", range: "Melee / Close", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Precise", "Thrown"], notes: "Can be used in melee or thrown at close range." },
  { key: "shortsword", name: "Shortsword", category: "Melee", defaultAttribute: "Agility", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Precise", "Light"], notes: "Fast one-handed melee weapon." },
  { key: "rapier", name: "Rapier", category: "Melee", defaultAttribute: "Agility", range: "Melee", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Precise", "Finesse"], notes: "Dueling blade with extra precision." },
  { key: "longsword", name: "Longsword", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Versatile"], notes: "Reliable one-handed martial weapon." },
  { key: "greatsword", name: "Greatsword", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Two-Handed", "Forceful"], notes: "Heavy two-handed blade." },
  { key: "battleaxe", name: "Battleaxe", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Versatile"], notes: "Standard martial axe." },
  { key: "greataxe", name: "Greataxe", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Two-Handed", "Forceful"], notes: "Heavy axe built for brute force." },
  { key: "mace", name: "Mace", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Blunt"], notes: "Simple crushing weapon." },
  { key: "warhammer", name: "Warhammer", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Forceful", "Blunt"], notes: "Armor-breaking melee weapon." },
  { key: "spear", name: "Spear", category: "Melee", defaultAttribute: "Might", range: "Melee / Close", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Reach", "Thrown"], notes: "Can be used in melee or thrown." },
  { key: "halberd", name: "Halberd", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Reach", "Two-Handed"], notes: "Polearm with superior reach." },
  { key: "whip", name: "Whip", category: "Melee", defaultAttribute: "Agility", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 1, bane: 0, tags: ["Reach", "Control"], notes: "Flexible melee weapon with control utility." },
  { key: "shield-bash", name: "Shield Bash", category: "Melee", defaultAttribute: "Might", range: "Melee", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Blunt", "Off-Hand"], notes: "Improvised shield strike." },
  { key: "shortbow", name: "Shortbow", category: "Ranged", defaultAttribute: "Agility", range: "Long", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "Two-Handed"], notes: "Standard ranged bow." },
  { key: "longbow", name: "Longbow", category: "Ranged", defaultAttribute: "Agility", range: "Long", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "Two-Handed"], notes: "Long-range bow with extra punch." },
  { key: "hand-crossbow", name: "Hand Crossbow", category: "Ranged", defaultAttribute: "Agility", range: "Short", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "One-Handed"], notes: "Compact ranged weapon." },
  { key: "crossbow", name: "Crossbow", category: "Ranged", defaultAttribute: "Agility", range: "Long", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "Slow"], notes: "Steady ranged weapon with heavier bolts." },
  { key: "sling", name: "Sling", category: "Ranged", defaultAttribute: "Agility", range: "Short", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile"], notes: "Simple ranged weapon." },
  { key: "throwing-axe", name: "Throwing Axe", category: "Ranged", defaultAttribute: "Agility", range: "Close", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Thrown", "Brutal"], notes: "Thrown weapon with solid stopping power." },
  { key: "revolver", name: "Revolver", category: "Firearm", defaultAttribute: "Agility", range: "Short", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "One-Handed"], notes: "Reliable sidearm." },
  { key: "pistol", name: "Pistol", category: "Firearm", defaultAttribute: "Agility", range: "Short", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "One-Handed"], notes: "Compact firearm." },
  { key: "shotgun", name: "Shotgun", category: "Firearm", defaultAttribute: "Agility", range: "Short", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "Area"], notes: "Spread fire at short range." },
  { key: "rifle", name: "Rifle", category: "Firearm", defaultAttribute: "Agility", range: "Long", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Projectile", "Two-Handed"], notes: "Long-range ballistic weapon." },
  { key: "sniper-rifle", name: "Sniper Rifle", category: "Firearm", defaultAttribute: "Agility", range: "Extreme", vs: "GRD", bonusDice: "+2", flatBonus: 0, boon: 1, bane: 0, tags: ["Projectile", "Precise", "Two-Handed"], notes: "Precision extreme-range firearm." },
  { key: "smg", name: "SMG", category: "Firearm", defaultAttribute: "Agility", range: "Short", vs: "GRD", bonusDice: "", flatBonus: 0, boon: 1, bane: 0, tags: ["Projectile", "Rapid"], notes: "Rapid-fire short-range weapon." },
  { key: "assault-rifle", name: "Assault Rifle", category: "Firearm", defaultAttribute: "Agility", range: "Long", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 1, bane: 0, tags: ["Projectile", "Rapid", "Two-Handed"], notes: "Versatile military rifle." },
  { key: "energy-pistol", name: "Energy Pistol", category: "Energy", defaultAttribute: "Energy", range: "Short", vs: "RES", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Non-Physical", "One-Handed"], notes: "Compact directed-energy weapon." },
  { key: "laser-rifle", name: "Laser Rifle", category: "Energy", defaultAttribute: "Energy", range: "Long", vs: "RES", bonusDice: "+1", flatBonus: 0, boon: 1, bane: 0, tags: ["Non-Physical", "Precise", "Two-Handed"], notes: "Accurate beam weapon." },
  { key: "plasma-rifle", name: "Plasma Rifle", category: "Energy", defaultAttribute: "Energy", range: "Long", vs: "RES/TGH", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 1, tags: ["Non-Physical", "Burning", "Two-Handed"], notes: "Superheated plasma weapon that can stress body or mind." },
  { key: "railgun", name: "Railgun", category: "Energy", defaultAttribute: "Energy", range: "Extreme", vs: "RES", bonusDice: "+2", flatBonus: 0, boon: 1, bane: 0, tags: ["Non-Physical", "Two-Handed", "Heavy"], notes: "High-powered futuristic long-range weapon." },
  { key: "wand-bolt", name: "Wand Bolt", category: "Arcane", defaultAttribute: "Creation", range: "Short", vs: "RES", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Arcane", "Implement"], notes: "Focused magical bolt from a wand or staff." },
  { key: "staff-burst", name: "Staff Burst", category: "Arcane", defaultAttribute: "Creation", range: "Long", vs: "RES", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Arcane", "Area", "Implement"], notes: "Burst of magical force from a staff." },
  { key: "mind-spike", name: "Mind Spike", category: "Psionic", defaultAttribute: "Presence", range: "Short", vs: "RES", bonusDice: "", flatBonus: 0, boon: 0, bane: 1, tags: ["Mental", "Psychic"], notes: "Psychic attack that directly pressures resolve." },
  { key: "soul-lash", name: "Soul Lash", category: "Psionic", defaultAttribute: "Presence", range: "Short", vs: "RES/TGH", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 0, tags: ["Mental", "Spirit"], notes: "Assault that can target the mind or life force." },
  { key: "flamethrower", name: "Flamethrower", category: "Special", defaultAttribute: "Agility", range: "Close", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 1, tags: ["Area", "Fire", "Heavy"], notes: "Cone or line of flame." },
  { key: "grenade", name: "Grenade", category: "Special", defaultAttribute: "Agility", range: "Close", vs: "GRD", bonusDice: "+1", flatBonus: 0, boon: 0, bane: 1, tags: ["Area", "Thrown", "Explosive"], notes: "Thrown explosive affecting an area." },
  { key: "smoke-bomb", name: "Smoke Bomb", category: "Special", defaultAttribute: "Agility", range: "Close", vs: "RES", bonusDice: "", flatBonus: 0, boon: 0, bane: 0, tags: ["Area", "Utility"], notes: "Primarily utility; set VS as needed for your table." },
  { key: "cannon", name: "Cannon", category: "Siege", defaultAttribute: "Agility", range: "Extreme", vs: "GRD", bonusDice: "+2", flatBonus: 0, boon: 0, bane: 1, tags: ["Heavy", "Area", "Siege"], notes: "Large mounted weapon." }
]);

const ATTRIBUTE_DICE_BY_SCORE = Object.freeze({
  0: "",
  1: "1D4",
  2: "1D6",
  3: "1D8",
  4: "1D10",
  5: "2D6",
  6: "2D8",
  7: "2D10",
  8: "3D8",
  9: "3D10",
  10: "4D8"
});

export function getOpenLegendAttributeDie(score) {
  const value = Math.max(0, Math.floor(Number(score) || 0));
  return ATTRIBUTE_DICE_BY_SCORE[value] || ATTRIBUTE_DICE_BY_SCORE[10];
}

export function findOpenLegendWeaponPreset(keyOrName) {
  const needle = String(keyOrName ?? "").trim().toLowerCase();
  if (!needle) return null;
  return OPENLEGEND_WEAPONS.find((weapon) => weapon.key === needle || weapon.name.toLowerCase() === needle) || null;
}

export function createOpenLegendWeapon(presetKey = "") {
  const preset = findOpenLegendWeaponPreset(presetKey);
  if (!preset) {
    return {
      presetKey: "",
      name: "",
      attribute: "Agility",
      vs: "GRD",
      range: "Melee",
      bonusDice: "",
      flatBonus: 0,
      boon: 0,
      bane: 0,
      tags: "",
      notes: ""
    };
  }

  return {
    presetKey: preset.key,
    name: preset.name,
    attribute: preset.defaultAttribute,
    vs: preset.vs,
    range: preset.range,
    bonusDice: preset.bonusDice || "",
    flatBonus: Number(preset.flatBonus || 0),
    boon: Number(preset.boon || 0),
    bane: Number(preset.bane || 0),
    tags: Array.isArray(preset.tags) ? preset.tags.join(", ") : String(preset.tags || ""),
    notes: preset.notes || ""
  };
}

export function composeOpenLegendWeaponDamage({ attributeDie = "", bonusDice = "", flatBonus = 0, customDamage = "" } = {}) {
  const manual = String(customDamage || "").trim();
  if (manual) return manual;

  const parts = [];
  const attr = String(attributeDie || "").trim();
  const bonus = String(bonusDice || "").trim();
  const flat = Number(flatBonus || 0);

  if (attr) parts.push(attr);
  if (bonus) {
    if (/^[+-]/.test(bonus)) parts.push(bonus);
    else parts.push(`+ ${bonus}`);
  }
  if (flat) {
    parts.push(`${flat > 0 ? "+" : "-"} ${Math.abs(flat)}`);
  }

  return parts.join(" ").trim() || "—";
}
