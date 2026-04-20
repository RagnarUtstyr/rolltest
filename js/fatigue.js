// fatigue.js

const fatigueData = {
  name: "Fatigued",
  duration: "Special",
  invocationTime: "1 Major Action",
  powerLevel: 5,
  attackAttributes: "Entropy",
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

let fatiguePoints = 0;

function clampFatigue(value) {
  return Math.max(0, Math.min(6, value));
}

function setFatigue(points) {
  fatiguePoints = clampFatigue(points);
  renderFatigue();
}

function addFatigue(points = 1) {
  setFatigue(fatiguePoints + points);
}

function removeFatigue(points = 1) {
  setFatigue(fatiguePoints - points);
}

function renderFatigue() {
  const container = document.getElementById("fatigue-levels");
  const pointsDisplay = document.getElementById("fatigue-points");

  if (!container) return;

  container.innerHTML = "";

  if (pointsDisplay) {
    pointsDisplay.textContent = fatiguePoints;
  }

  if (fatiguePoints === 0) {
    container.innerHTML = `<p>No fatigue levels currently active.</p>`;
    return;
  }

  for (let i = 0; i < fatiguePoints; i++) {
    const levelBox = document.createElement("div");
    levelBox.className = "fatigue-level";

    levelBox.innerHTML = `
      <h3>Level ${i + 1}</h3>
      <p>${fatigueData.levels[i]}</p>
    `;

    container.appendChild(levelBox);
  }
}

// Optional: connect buttons automatically if they exist
document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("add-fatigue");
  const removeBtn = document.getElementById("remove-fatigue");
  const resetBtn = document.getElementById("reset-fatigue");
  const input = document.getElementById("fatigue-input");

  if (addBtn) {
    addBtn.addEventListener("click", () => addFatigue(1));
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => removeFatigue(1));
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => setFatigue(0));
  }

  if (input) {
    input.addEventListener("input", (e) => {
      const value = parseInt(e.target.value, 10);
      setFatigue(Number.isNaN(value) ? 0 : value);
    });
  }

  renderFatigue();
});

// Expose functions globally if you want to call them from HTML
window.setFatigue = setFatigue;
window.addFatigue = addFatigue;
window.removeFatigue = removeFatigue;