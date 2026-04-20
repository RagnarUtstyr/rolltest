export const FATIGUE_DATA = {
  id: "fatigued",
  name: "Fatigued",
  duration: "Special",
  invocationTime: "1 Major Action",
  powerLevel: 5,
  attackAttributes: ["Entropy"],
  attack: "Entropy vs. Toughness",
  description:
    "You cause the target's body to wither and weaken, gradually losing its ability to function until the victim finally succumbs to death.",
  levels: [
    "The target has disadvantage 1 on all non-attack action rolls.",
    "The target is affected by the slowed bane, reducing its speed by half. This instance of the slowed bane cannot be resisted as normal. It persists until the fatigue is removed.",
    "The target has disadvantage 1 on all attack rolls.",
    "The target loses their attribute bonuses to their defense scores (Agility and Might for Guard, Fortitude and Will for Toughness, Will and Presence for Resolve). They retain any armor, extraordinary, or feat bonuses.",
    "The target loses consciousness and is helpless. Being forced into a state of rest, one level of fatigue will be removed automatically after 24 hours, unless circumstances prevent the target from resting peacefully.",
    "The target dies."
  ],
  special:
    "Each 24 hour period of rest with little or no exertion removes one level of fatigue. If the restoration boon is successfully invoked, only one level is removed unless the invoker has an attribute score of 7 or greater, in which case all levels are removed. A target may only benefit from one invocation of restoration to remove fatigue within a 24 hour period."
};

export function clampFatigueLevel(value) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(6, parsed));
}

export function getFatigueLevels(points = 0) {
  return FATIGUE_DATA.levels.slice(0, clampFatigueLevel(points));
}

export function hasFatigueSlowedLink(points = 0) {
  return clampFatigueLevel(points) >= 2;
}
