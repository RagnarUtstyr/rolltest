export const EFFECTS = [
  {
    name: "Blinded",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#BlindedCondition",
    icon: "../icons/effects/blinded.png",
    description:
      "A blinded creature can't see and automatically fails checks that require sight. Attack rolls against it have advantage, and its own attack rolls have disadvantage."
  },
  {
    name: "Charmed",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#CharmedCondition",
    icon: "../icons/effects/charmed.png",
    description:
      "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on social checks involving the creature."
  },
  {
    name: "Deafened",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#DeafenedCondition",
    icon: "../icons/effects/deafened.png",
    description: "A deafened creature can't hear."
  },
  {
    name: "Exhaustion",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#ExhaustionCondition",
    icon: "../icons/effects/exhaustion.png",
    description:
      "Exhaustion is tracked in levels. Higher levels impose worsening penalties, and extreme exhaustion can be fatal."
  },
  {
    name: "Frightened",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#FrightenedCondition",
    icon: "../icons/effects/frightened.png",
    description:
      "A frightened creature has disadvantage on checks and attack rolls while the source of its fear is in line of sight, and it can't willingly move closer to that source."
  },
  {
    name: "Grappled",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#GrappledCondition",
    icon: "../icons/effects/grappled.png",
    description:
      "A grappled creature's speed becomes 0, and it can't benefit from bonuses to speed until the grapple ends."
  },
  {
    name: "Incapacitated",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#IncapacitatedCondition",
    icon: "../icons/effects/incapacitated.png",
    description:
      "An incapacitated creature can't take actions or reactions."
  },
  {
    name: "Invisible",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#InvisibleCondition",
    icon: "../icons/effects/invisible.png",
    description:
      "An invisible creature can't be seen without special senses or magic. For attack purposes, it is treated as heavily obscured; its attacks have advantage, and attacks against it have disadvantage."
  },
  {
    name: "Paralyzed",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#ParalyzedCondition",
    icon: "../icons/effects/paralyzed.png",
    description:
      "A paralyzed creature is incapacitated and can't move or speak. It automatically fails Strength and Dexterity saves, attacks against it have advantage, and nearby hits can become critical hits."
  },
  {
    name: "Petrified",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#PetrifiedCondition",
    icon: "../icons/effects/petrified.png",
    description:
      "A petrified creature is transformed into a solid inanimate substance, along with nonmagical worn or carried gear. It is incapacitated, unaware, can't move or speak, and gains strong defensive protections."
  },
  {
    name: "Poisoned",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#PoisonedCondition",
    icon: "../icons/effects/poisoned.png",
    description:
      "A poisoned creature has disadvantage on attack rolls and ability checks."
  },
  {
    name: "Prone",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#ProneCondition",
    icon: "../icons/effects/prone.png",
    description:
      "A prone creature's only movement option is to crawl unless it stands up. It has disadvantage on attack rolls, nearby attacks against it have advantage, and distant attacks against it have disadvantage."
  },
  {
    name: "Restrained",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#RestrainedCondition",
    icon: "../icons/effects/restrained.png",
    description:
      "A restrained creature's speed becomes 0, attacks against it have advantage, its own attacks have disadvantage, and it has disadvantage on Dexterity saves."
  },
  {
    name: "Stunned",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#StunnedCondition",
    icon: "../icons/effects/stunned.png",
    description:
      "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails Strength and Dexterity saves, and attacks against it have advantage."
  },
  {
    name: "Unconscious",
    type: "condition",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#UnconsciousCondition",
    icon: "../icons/effects/unconscious.png",
    description:
      "An unconscious creature is incapacitated, can't move or speak, is unaware of its surroundings, drops what it is holding, falls prone, automatically fails Strength and Dexterity saves, and attacks against it have advantage."
  },
  {
    name: "Concentrating",
    type: "status",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/spells#Concentration",
    icon: "../icons/effects/concentrating.png",
    description:
      "The creature is maintaining a concentration spell. It can usually concentrate on only one spell at a time, and concentration can be broken by damage or other disruptions."
  },
  {
    name: "Surprised",
    type: "status",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/combat#Surprise",
    icon: "../icons/effects/surprised.png",
    description:
      "At the start of combat, a surprised creature can't move or take an action on its first turn and can't take a reaction until that turn ends."
  },
  {
    name: "Hidden",
    type: "status",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/playing-the-game#HideAction",
    icon: "../icons/effects/hidden.png",
    description:
      "The creature is successfully hidden from another creature or creatures, usually through the Hide action and a successful Dexterity (Stealth) check."
  },
  {
    name: "Unseen",
    type: "status",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/playing-the-game#UnseenAttackersandTargets",
    icon: "../icons/effects/unseen.png",
    description:
      "The creature or target can't currently be seen, whether from invisibility, darkness, obstruction, or another effect. This often changes attack-roll interactions."
  },
  {
    name: "Dying / 0 HP",
    type: "status",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#HitPoints",
    icon: "../icons/effects/dying.png",
    description:
      "The creature is at 0 hit points and typically falls unconscious. It may begin making death saving throws unless another rule says otherwise."
  },
  {
    name: "Stable",
    type: "status",
    url: "https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#HitPoints",
    icon: "../icons/effects/stable.png",
    description:
      "A stable creature at 0 hit points is not making death saving throws, though it remains unconscious until it regains hit points or another rule changes its state."
  }
];

export const CONDITIONS = EFFECTS.filter((effect) => effect.type === "condition");
export const STATUSES = EFFECTS.filter((effect) => effect.type === "status");

export function getEffectByName(name) {
  return (
    EFFECTS.find(
      (effect) => effect.name.toLowerCase() === String(name).toLowerCase()
    ) || null
  );
}