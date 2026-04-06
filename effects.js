/**
 * D&D 5e effects list using PNG filenames for icons.
 *
 * Assumes your PNG files are named like:
 * blinded.png
 * charmed.png
 * concentrating.png
 *
 * And stored in:
 * /icons/
 */

const dndEffects = [
  {
    id: "blinded",
    name: "Blinded",
    type: "condition",
    official: true,
    icon: "icons/blinded.png",
    iconKey: "blinded",
    description:
      "A blinded creature can't see and automatically fails checks that require sight. Attack rolls against it have advantage, and its own attack rolls have disadvantage.",
  },
  {
    id: "charmed",
    name: "Charmed",
    type: "condition",
    official: true,
    icon: "icons/charmed.png",
    iconKey: "charmed",
    description:
      "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on social checks involving the creature.",
  },
  {
    id: "deafened",
    name: "Deafened",
    type: "condition",
    official: true,
    icon: "icons/deafened.png",
    iconKey: "deafened",
    description: "A deafened creature can't hear.",
  },
  {
    id: "exhaustion",
    name: "Exhaustion",
    type: "condition",
    official: true,
    icon: "icons/exhaustion.png",
    iconKey: "exhaustion",
    description:
      "Exhaustion is tracked in levels. Higher levels impose worsening penalties, and extreme exhaustion can be fatal.",
  },
  {
    id: "frightened",
    name: "Frightened",
    type: "condition",
    official: true,
    icon: "icons/frightened.png",
    iconKey: "frightened",
    description:
      "A frightened creature has disadvantage on checks and attack rolls while the source of its fear is in line of sight, and it can't willingly move closer to that source.",
  },
  {
    id: "grappled",
    name: "Grappled",
    type: "condition",
    official: true,
    icon: "icons/grappled.png",
    iconKey: "grappled",
    description:
      "A grappled creature's speed becomes 0, and it can't benefit from bonuses to speed until the grapple ends.",
  },
  {
    id: "incapacitated",
    name: "Incapacitated",
    type: "condition",
    official: true,
    icon: "icons/incapacitated.png",
    iconKey: "incapacitated",
    description:
      "An incapacitated creature can't take actions or reactions.",
  },
  {
    id: "invisible",
    name: "Invisible",
    type: "condition",
    official: true,
    icon: "icons/invisible.png",
    iconKey: "invisible",
    description:
      "An invisible creature can't be seen without special senses or magic. For attack purposes, it is treated as heavily obscured; its attacks have advantage, and attacks against it have disadvantage.",
  },
  {
    id: "paralyzed",
    name: "Paralyzed",
    type: "condition",
    official: true,
    icon: "icons/paralyzed.png",
    iconKey: "paralyzed",
    description:
      "A paralyzed creature is incapacitated and can't move or speak. It automatically fails Strength and Dexterity saves, attacks against it have advantage, and nearby hits can become critical hits.",
  },
  {
    id: "petrified",
    name: "Petrified",
    type: "condition",
    official: true,
    icon: "icons/petrified.png",
    iconKey: "petrified",
    description:
      "A petrified creature is transformed into a solid inanimate substance, along with nonmagical worn or carried gear. It is incapacitated, unaware, can't move or speak, and gains strong defensive protections.",
  },
  {
    id: "poisoned",
    name: "Poisoned",
    type: "condition",
    official: true,
    icon: "icons/poisoned.png",
    iconKey: "poisoned",
    description:
      "A poisoned creature has disadvantage on attack rolls and ability checks.",
  },
  {
    id: "prone",
    name: "Prone",
    type: "condition",
    official: true,
    icon: "icons/prone.png",
    iconKey: "prone",
    description:
      "A prone creature's only movement option is to crawl unless it stands up. It has disadvantage on attack rolls, nearby attacks against it have advantage, and distant attacks against it have disadvantage.",
  },
  {
    id: "restrained",
    name: "Restrained",
    type: "condition",
    official: true,
    icon: "icons/restrained.png",
    iconKey: "restrained",
    description:
      "A restrained creature's speed becomes 0, attacks against it have advantage, its own attacks have disadvantage, and it has disadvantage on Dexterity saves.",
  },
  {
    id: "stunned",
    name: "Stunned",
    type: "condition",
    official: true,
    icon: "icons/stunned.png",
    iconKey: "stunned",
    description:
      "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails Strength and Dexterity saves, and attacks against it have advantage.",
  },
  {
    id: "unconscious",
    name: "Unconscious",
    type: "condition",
    official: true,
    icon: "icons/unconscious.png",
    iconKey: "unconscious",
    description:
      "An unconscious creature is incapacitated, can't move or speak, is unaware of its surroundings, drops what it is holding, falls prone, automatically fails Strength and Dexterity saves, and attacks against it have advantage.",
  },

  {
    id: "concentrating",
    name: "Concentrating",
    type: "status",
    official: true,
    icon: "icons/concentrating.png",
    iconKey: "concentrating",
    description:
      "The creature is maintaining a concentration spell. It can usually concentrate on only one spell at a time, and concentration can be broken by damage or other disruptions.",
  },
  {
    id: "surprised",
    name: "Surprised",
    type: "status",
    official: true,
    icon: "icons/surprised.png",
    iconKey: "surprised",
    description:
      "At the start of combat, a surprised creature can't move or take an action on its first turn and can't take a reaction until that turn ends.",
  },
  {
    id: "hidden",
    name: "Hidden",
    type: "status",
    official: true,
    icon: "icons/hidden.png",
    iconKey: "hidden",
    description:
      "The creature is successfully hidden from another creature or creatures, usually through the Hide action and a successful Dexterity (Stealth) check.",
  },
  {
    id: "unseen",
    name: "Unseen",
    type: "status",
    official: true,
    icon: "icons/unseen.png",
    iconKey: "unseen",
    description:
      "The creature or target can't currently be seen, whether from invisibility, darkness, obstruction, or another effect. This often changes attack-roll interactions.",
  },
  {
    id: "dying",
    name: "Dying / 0 HP",
    type: "status",
    official: true,
    icon: "icons/dying.png",
    iconKey: "dying",
    description:
      "The creature is at 0 hit points and typically falls unconscious. It may begin making death saving throws unless another rule says otherwise.",
  },
  {
    id: "stable",
    name: "Stable",
    type: "status",
    official: true,
    icon: "icons/stable.png",
    iconKey: "stable",
    description:
      "A stable creature at 0 hit points is not making death saving throws, though it remains unconscious until it regains hit points or another rule changes its state.",
  },
];

const conditions = dndEffects.filter((effect) => effect.type === "condition");
const statuses = dndEffects.filter((effect) => effect.type === "status");

function getEffectById(id) {
  return dndEffects.find((effect) => effect.id === id) || null;
}

function getEffectByName(name) {
  return (
    dndEffects.find(
      (effect) => effect.name.toLowerCase() === String(name).toLowerCase()
    ) || null
  );
}

export { dndEffects, conditions, statuses, getEffectById, getEffectByName };

if (typeof module !== "undefined") {
  module.exports = {
    dndEffects,
    conditions,
    statuses,
    getEffectById,
    getEffectByName,
  };
}