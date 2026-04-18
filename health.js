import { BANES } from "./banes.js";
import { ref, update, onValue, remove, set } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function __normalizeTextBlock(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function __normalizeAttributes(attributes) {
  if (!attributes || typeof attributes !== "object") return [];
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && !Number.isNaN(Number(value)))
    .map(([name, value]) => [name, Number(value)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

let __currentCustomBuild = null;

function openStatModal({
  name,
  grd,
  res,
  tgh,
  url,
  initiative,
  countdownRemaining,
  countdownActive,
  countdownEnded,
  customBuild
}) {
  const modal = document.getElementById("stat-modal");
  if (!modal) return;

  document.getElementById("stat-modal-title").textContent = name ?? "";
  document.getElementById("stat-init").textContent = (initiative ?? "N/A");
  document.getElementById("stat-grd").textContent = (grd ?? "N/A");
  document.getElementById("stat-res").textContent = (res ?? "N/A");
  document.getElementById("stat-tgh").textContent = (tgh ?? "N/A");

  __currentCustomBuild = customBuild ?? null;

  const customBuildBtn = document.getElementById("stat-custom-build");
  if (customBuildBtn) {
    customBuildBtn.style.display = customBuild ? "" : "none";
  }

  const link = document.getElementById("stat-url");
  if (url) {
    link.style.display = "";
    link.href = url;
  } else {
    link.style.display = "none";
    link.removeAttribute("href");
  }

  const remainingEl = document.getElementById("stat-countdown-remaining");
  const inputEl = document.getElementById("stat-countdown-amount");
  if (remainingEl) {
    if (countdownEnded) remainingEl.textContent = "ENDED (0)";
    else if (countdownActive) remainingEl.textContent = `${countdownRemaining ?? "—"}`;
    else if (countdownRemaining === 0) remainingEl.textContent = "0";
    else remainingEl.textContent = "—";
  }
  if (inputEl) inputEl.value = "";

  modal.setAttribute("aria-hidden", "false");
}

function closeStatModal() {
  const modal = document.getElementById("stat-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
}

function openHpModal(currentHp) {
  const modal = document.getElementById("hp-modal");
  if (!modal) return;

  const input = document.getElementById("hp-set-amount");
  if (input) {
    input.value = (currentHp ?? currentHp === 0) ? currentHp : "";
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  modal.setAttribute("aria-hidden", "false");
}

function closeHpModal() {
  const modal = document.getElementById("hp-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
}

function openCustomBuildModal(name, customBuild) {
  const modal = document.getElementById("custom-build-modal");
  if (!modal || !customBuild) return;

  document.getElementById("custom-build-title").textContent = `${name ?? "Custom NPC"} - Custom Build`;

  const overviewEl = document.getElementById("custom-build-overview");
  const attributesEl = document.getElementById("custom-build-attributes");
  const favoredEl = document.getElementById("custom-build-favored-actions");
  const specialEl = document.getElementById("custom-build-special-actions");
  const featsEl = document.getElementById("custom-build-feats");
  const weaponsEl = document.getElementById("custom-build-weapons");

  const overviewRows = [
    ["Level", customBuild.level ?? "—"],
    ["Size", customBuild.size ?? "—"],
    ["HP", customBuild.hp ?? "—"],
    ["Speed", customBuild.speed ?? "—"],
    ["GRD", customBuild.grd ?? "—"],
    ["TGH", customBuild.tgh ?? "—"],
    ["RES", customBuild.res ?? "—"],
    ["Created By", customBuild.createdByName ?? "—"]
  ];

  if (overviewEl) {
    overviewEl.innerHTML = overviewRows.map(([label, value]) => `
      <div class="custom-build-detail-row">
        <span>${escapeHtml(label)}</span>
        <span>${escapeHtml(value)}</span>
      </div>
    `).join("");
  }

  const attrRows = __normalizeAttributes(customBuild.attributes);
  if (attributesEl) {
    attributesEl.innerHTML = attrRows.length
      ? attrRows.map(([label, value]) => `
          <div class="custom-build-detail-row">
            <span>${escapeHtml(label)}</span>
            <span>${escapeHtml(value)}</span>
          </div>
        `).join("")
      : `<div class="custom-build-detail-row"><span>No attributes set</span><span>—</span></div>`;
  }

  if (favoredEl) favoredEl.textContent = __normalizeTextBlock(customBuild.favoredActions);
  if (specialEl) specialEl.textContent = __normalizeTextBlock(customBuild.specialActions);
  if (featsEl) featsEl.textContent = __normalizeTextBlock(customBuild.feats);
  if (weaponsEl) weaponsEl.textContent = __normalizeTextBlock(customBuild.weapons);

  modal.setAttribute("aria-hidden", "false");
}

function closeCustomBuildModal() {
  document.getElementById("custom-build-modal")?.setAttribute("aria-hidden", "true");
}

onReady(() => {
  const modal = document.getElementById("stat-modal");
  if (modal) {
    document.getElementById("stat-modal-close")?.addEventListener("click", closeStatModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeStatModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
        closeStatModal();
      }
    });
  }

  const hpModal = document.getElementById("hp-modal");
  if (hpModal) {
    document.getElementById("hp-modal-close")?.addEventListener("click", closeHpModal);
    hpModal.addEventListener("click", (e) => { if (e.target === hpModal) closeHpModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && hpModal.getAttribute("aria-hidden") === "false") {
        closeHpModal();
      }
    });
  }

  const banePickerModal = document.getElementById("bane-picker-modal");
  if (banePickerModal) {
    document.getElementById("bane-picker-close")?.addEventListener("click", closeBanePickerModal);
    banePickerModal.addEventListener("click", (e) => { if (e.target === banePickerModal) closeBanePickerModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && banePickerModal.getAttribute("aria-hidden") === "false") {
        closeBanePickerModal();
      }
    });
  }

  const banesModal = document.getElementById("banes-modal");
  if (banesModal) {
    document.getElementById("banes-modal-close")?.addEventListener("click", closeBanesModal);
    banesModal.addEventListener("click", (e) => { if (e.target === banesModal) closeBanesModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && banesModal.getAttribute("aria-hidden") === "false") {
        closeBanesModal();
      }
    });
  }

  const customBuildModal = document.getElementById("custom-build-modal");
  if (customBuildModal) {
    document.getElementById("custom-build-close")?.addEventListener("click", closeCustomBuildModal);
    customBuildModal.addEventListener("click", (e) => { if (e.target === customBuildModal) closeCustomBuildModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && customBuildModal.getAttribute("aria-hidden") === "false") {
        closeCustomBuildModal();
      }
    });
  }

  document.getElementById("stat-add-bane")?.addEventListener("click", openBanePickerModal);
  document.getElementById("stat-custom-build")?.addEventListener("click", () => {
    if (!__currentEntryId || !__currentCustomBuild) return;
    const title = document.getElementById("stat-modal-title")?.textContent || "Custom NPC";
    openCustomBuildModal(title, __currentCustomBuild);
  });
});

const __countdownById = new Map();
function __getCountdownState(id) {
  return __countdownById.get(id) || { remaining: null, active: false, ended: false };
}
function __setCountdownState(id, state) {
  __countdownById.set(id, {
    remaining: (typeof state.remaining === "number") ? state.remaining : null,
    active: !!state.active,
    ended: !!state.ended
  });
}

function __rowFor(id) {
  return document.querySelector(`.list-item[data-entry-id="${id}"]`);
}

function __sanitizeBaneKey(value) {
  return String(value ?? "").replace(/[.#$\[\]/]/g, "_");
}

function __normalizeBanes(banes) {
  if (!banes) return [];
  if (Array.isArray(banes)) return banes.filter(Boolean);
  return Object.values(banes).filter(Boolean);
}

function closeBanePickerModal() {
  document.getElementById("bane-picker-modal")?.setAttribute("aria-hidden", "true");
}

function closeBanesModal() {
  document.getElementById("banes-modal")?.setAttribute("aria-hidden", "true");
}

function openBanesModal(entryId, banes, titleText = "Banes") {
  const modal = document.getElementById("banes-modal");
  const list = document.getElementById("banes-modal-list");
  const title = document.getElementById("banes-modal-title");
  if (!modal || !list) return;

  list.innerHTML = "";
  if (title) title.textContent = titleText;

  __normalizeBanes(banes).forEach((bane) => {
    const row = document.createElement("div");
    row.className = "bane-picker-row";

    const leftButton = document.createElement("button");
    leftButton.type = "button";
    leftButton.className = "bane-picker-open";

    const left = document.createElement("div");
    left.className = "bane-picker-left";

    const icon = document.createElement("img");
    icon.className = "bane-icon";
    icon.src = bane.icon || "icons/banes/test.png";
    icon.alt = bane.name || "Bane";

    const name = document.createElement("span");
    name.textContent = bane.name || "Unknown";

    left.appendChild(icon);
    left.appendChild(name);
    leftButton.appendChild(left);
    leftButton.addEventListener("click", () => {
      if (bane.url) window.open(bane.url, "_blank", "noopener");
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.className = "remove-button";
    removeBtn.style.marginTop = "0";
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const key = __sanitizeBaneKey(bane.name);
      try {
        await remove(ref(db, `${getEntriesPath()}/${entryId}/banes/${key}`));
      } catch (err) {
        console.error("Error removing bane:", err);
      }
    });

    row.appendChild(leftButton);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function openBanePickerModal() {
  const modal = document.getElementById("bane-picker-modal");
  const list = document.getElementById("bane-picker-list");
  if (!modal || !list || !__currentEntryId) return;

  list.innerHTML = "";

  BANES.forEach((bane) => {
    const row = document.createElement("div");
    row.className = "bane-picker-row";

    const left = document.createElement("div");
    left.className = "bane-picker-left";

    const icon = document.createElement("img");
    icon.className = "bane-icon";
    icon.src = bane.icon || "icons/banes/test.png";
    icon.alt = bane.name || "Bane";

    const name = document.createElement("span");
    name.textContent = bane.name || "Unknown";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "Add";
    addBtn.className = "remove-button";
    addBtn.style.marginTop = "0";
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const entryRef = ref(db, `${getEntriesPath()}/${__currentEntryId}/banes`);
      const key = __sanitizeBaneKey(bane.name);
      try {
        await update(entryRef, {
          [key]: {
            name: bane.name,
            url: bane.url,
            icon: bane.icon || "icons/banes/test.png"
          }
        });
      } catch (err) {
        console.error("Error adding bane:", err);
      }
    });

    left.appendChild(icon);
    left.appendChild(name);
    row.appendChild(left);
    row.appendChild(addBtn);
    list.appendChild(row);
  });

  modal.setAttribute("aria-hidden", "false");
}

function __updateCountdownBadge(row, state) {
  if (!row) return;
  const nameCol = row.querySelector(".column.name");
  if (!nameCol) return;

  let badge = nameCol.querySelector(".countdown-badge");

  const hasSomething =
    (state.active && typeof state.remaining === "number" && state.remaining > 0) ||
    state.ended;

  if (!hasSomething) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "countdown-badge";
    nameCol.appendChild(badge);
  }

  if (state.ended) badge.textContent = "CD: ENDED";
  else badge.textContent = `CD: ${state.remaining}`;
}

function __applyRowCountdownClasses(entryId, state) {
  const row = __rowFor(entryId);
  if (!row) return;

  if (state.active && typeof state.remaining === "number" && state.remaining > 0) {
    row.classList.add("countdown-active");
  } else {
    row.classList.remove("countdown-active");
  }

  if (!state.ended) row.classList.remove("countdown-expired");

  __updateCountdownBadge(row, state);
}

function fetchRankings() {
  const reference = ref(db, getEntriesPath());
  onValue(reference, (snapshot) => {
    const data = snapshot.val();
    const rankingList = document.querySelector(".ranking-body");
    if (!rankingList) return;
    rankingList.innerHTML = "";

    __countdownById.clear();
    if (!data) return;

    const rankings = Object.entries(data).map(([id, entry]) => ({ id, ...entry }));
    rankings.sort((a, b) => (b.number ?? b.initiative ?? 0) - (a.number ?? a.initiative ?? 0));

    rankings.forEach(({
      id,
      name,
      playerName,
      grd,
      res,
      tgh,
      health,
      currentHp,
      url,
      number,
      initiative,
      countdownRemaining,
      countdownActive,
      countdownEnded,
      banes,
      customBuild
    }) => {
      const displayName = name ?? playerName ?? "Unknown";
      const displayInitiative = number ?? initiative ?? 0;
      const displayHealth = (health ?? currentHp);

      __setCountdownState(id, {
        remaining: (typeof countdownRemaining === "number") ? countdownRemaining : null,
        active: !!countdownActive,
        ended: !!countdownEnded
      });

      const listItem = document.createElement("li");
      listItem.className = "list-item";
      listItem.dataset.entryId = id;

      if (displayHealth === 0) listItem.classList.add("defeated");

      const nameCol = document.createElement("div");
      nameCol.className = "column name";
      nameCol.textContent = displayName;
      nameCol.style.cursor = "pointer";
      nameCol.title = customBuild ? "Show defenses and custom build" : "Show defenses (GRD / RES / TGH)";
      nameCol.addEventListener("click", () => {
        __currentEntryId = id;
        const s = __getCountdownState(id);
        openStatModal({
          name: displayName,
          grd,
          res,
          tgh,
          url,
          initiative: displayInitiative,
          countdownRemaining: s.remaining,
          countdownActive: s.active,
          countdownEnded: s.ended,
          customBuild
        });
      });

      const baneArray = __normalizeBanes(banes);

      const hpCol = document.createElement("div");
      hpCol.className = "column hp";
      hpCol.textContent = (displayHealth === null || displayHealth === undefined) ? "N/A" : `${displayHealth}`;
      hpCol.style.cursor = "pointer";
      hpCol.title = "Set HP";
      hpCol.addEventListener("click", () => {
        __currentEntryId = id;
        openHpModal(displayHealth);
      });

      const dmgCol = document.createElement("div");
      dmgCol.className = "column dmg";
      const dmgInput = document.createElement("input");
      dmgInput.type = "number";
      dmgInput.placeholder = "DMG";
      dmgInput.className = "damage-input";
      dmgInput.dataset.entryId = id;
      dmgInput.dataset.grd = grd ?? 0;
      dmgInput.dataset.res = res ?? 0;
      dmgInput.dataset.tgh = tgh ?? 0;

      if (displayHealth !== null && displayHealth !== undefined) {
        dmgInput.dataset.health = displayHealth;
      }

      dmgCol.appendChild(dmgInput);

      listItem.appendChild(nameCol);
      listItem.appendChild(hpCol);
      listItem.appendChild(dmgCol);

      if (baneArray.length > 0) {
        const baneWrap = document.createElement("div");
        baneWrap.className = "row-banes";

        baneArray.forEach((bane) => {
          const iconButton = document.createElement("button");
          iconButton.type = "button";
          iconButton.className = "bane-icon-button";
          iconButton.title = bane.name || "Bane";
          iconButton.setAttribute("aria-label", bane.name || "Bane");

          const icon = document.createElement("img");
          icon.className = "bane-row-icon";
          icon.src = bane.icon || "icons/banes/test.png";
          icon.alt = bane.name || "Bane";

          iconButton.appendChild(icon);
          iconButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (bane.url) window.open(bane.url, "_blank", "noopener");
          });

          baneWrap.appendChild(iconButton);
        });

        const banesButton = document.createElement("button");
        banesButton.type = "button";
        banesButton.textContent = "Banes";
        banesButton.className = "banes-button";
        banesButton.addEventListener("click", () => {
          __currentEntryId = id;
          openBanesModal(id, baneArray, `${displayName} - Banes`);
        });
        baneWrap.appendChild(banesButton);

        listItem.appendChild(baneWrap);
      }

      if (displayHealth === 0) {
        const removeButton = document.createElement("button");
        removeButton.textContent = "Remove";
        removeButton.className = "remove-button";
        removeButton.addEventListener("click", () => removeEntry(id, listItem));
        listItem.appendChild(removeButton);
      }

      rankingList.appendChild(listItem);

      __applyRowCountdownClasses(id, __getCountdownState(id));
    });
  });
}

function applyDamageToAll() {
  const inputs = document.querySelectorAll(".damage-input");
  const selectedStat = document.querySelector('input[name="globalStat"]:checked')?.value ?? "grd";

  inputs.forEach(input => {
    if (!("health" in input.dataset)) {
      input.value = "";
      return;
    }

    const id = input.dataset.entryId;
    const currentHealth = parseInt(input.dataset.health, 10);
    const rawDamage = parseInt(input.value, 10);
    const statValue = parseInt(input.dataset[selectedStat], 10);

    if (isNaN(rawDamage) || isNaN(currentHealth) || isNaN(statValue)) {
      input.value = "";
      return;
    }

    let effective = rawDamage - statValue;
    if (rawDamage >= statValue && effective < 3) effective = 3;

    const finalDamage = Math.max(effective, 0);
    if (finalDamage > 0) {
      const updated = Math.max(currentHealth - finalDamage, 0);
      updateHealth(id, updated, input);
    }

    input.value = "";
  });
}

function updateHealth(id, newHealth, inputEl) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);
  update(reference, { health: newHealth, currentHp: newHealth })
    .then(() => {
      const listItem = inputEl.closest(".list-item");
      const hpCol = listItem?.querySelector(".column.hp");
      if (hpCol) hpCol.textContent = `${newHealth}`;
      inputEl.dataset.health = newHealth;

      if (newHealth <= 0) {
        listItem?.classList.add("defeated");

        let removeButton = listItem?.querySelector(".remove-button");
        if (!removeButton && listItem) {
          removeButton = document.createElement("button");
          removeButton.textContent = "Remove";
          removeButton.className = "remove-button";
          removeButton.addEventListener("click", () => removeEntry(id, listItem));
          listItem.appendChild(removeButton);
        }
      } else {
        listItem?.classList.remove("defeated");
      }
    })
    .catch(err => console.error("Error updating health:", err));
}

function removeEntry(id, listItem) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);
  remove(reference)
    .then(() => {
      listItem?.remove();
      __countdownById.delete(id);
    })
    .catch(err => console.error("Error removing entry:", err));
}

function clearList() {
  const reference = ref(db, getEntriesPath());
  set(reference, null)
    .then(() => {
      window.resetRoundCounter?.();
      __countdownById.clear();
    })
    .catch(err => console.error("Error clearing list:", err));
}

let __currentEntryId = null;

onReady(() => {
  const delBtn = document.getElementById("stat-delete");
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      if (!__currentEntryId) return;
      if (!confirm("Delete this entry from the list?")) return;

      const row = __rowFor(__currentEntryId);
      removeEntry(__currentEntryId, row || undefined);

      document.getElementById("stat-modal")?.setAttribute("aria-hidden", "true");
      __currentEntryId = null;
      __currentCustomBuild = null;
    });
  }

  const healBtn = document.getElementById("stat-heal");
  const healAmtInput = document.getElementById("stat-heal-amount");

  if (healBtn && healAmtInput) {
    healBtn.addEventListener("click", () => {
      if (!__currentEntryId) return;
      const amount = parseInt(healAmtInput.value, 10);
      if (isNaN(amount) || amount === 0) return;

      const dmgInput = document.querySelector(`.damage-input[data-entry-id="${__currentEntryId}"]`);
      if (!dmgInput || !("health" in dmgInput.dataset)) {
        alert("This entry has no HP set yet.");
        return;
      }

      const current = parseInt(dmgInput.dataset.health, 10) || 0;
      const newHealth = Math.max(current + amount, 0);
      updateHealth(__currentEntryId, newHealth, dmgInput);

      healAmtInput.value = "";
    });
  }
});

onReady(() => {
  const setBtn = document.getElementById("hp-set-button");
  const hpInput = document.getElementById("hp-set-amount");

  if (setBtn && hpInput) {
    setBtn.addEventListener("click", () => {
      if (!__currentEntryId) return;

      const amount = parseInt(hpInput.value, 10);
      if (isNaN(amount) || amount < 0) return;

      const dmgInput = document.querySelector(`.damage-input[data-entry-id="${__currentEntryId}"]`);
      if (!dmgInput) return;

      updateHealth(__currentEntryId, amount, dmgInput);
      hpInput.value = "";
      closeHpModal();
    });

    hpInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setBtn.click();
      }
    });
  }
});

function setCountdown(id, turns) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);

  __setCountdownState(id, { remaining: turns, active: true, ended: false });
  __applyRowCountdownClasses(id, __getCountdownState(id));

  return update(reference, {
    countdownActive: true,
    countdownRemaining: turns,
    countdownEnded: false
  });
}

function clearCountdown(id) {
  const reference = ref(db, `${getEntriesPath()}/${id}`);

  __setCountdownState(id, { remaining: null, active: false, ended: false });
  __applyRowCountdownClasses(id, __getCountdownState(id));

  return update(reference, {
    countdownActive: null,
    countdownRemaining: null,
    countdownEnded: null
  });
}

onReady(() => {
  const setBtn = document.getElementById("stat-countdown-set");
  const clearBtn = document.getElementById("stat-countdown-clear");
  const amtInput = document.getElementById("stat-countdown-amount");

  if (setBtn && amtInput) {
    setBtn.addEventListener("click", async () => {
      if (!__currentEntryId) return;

      const turns = parseInt(amtInput.value, 10);
      if (isNaN(turns) || turns <= 0) return;

      try {
        await setCountdown(__currentEntryId, turns);
        amtInput.value = "";
      } catch (err) {
        console.error("Error setting countdown:", err);
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (!__currentEntryId) return;
      try {
        await clearCountdown(__currentEntryId);
      } catch (err) {
        console.error("Error clearing countdown:", err);
      }
    });
  }
});

async function __decrementCountdownIfNeeded(entryId) {
  const state = __getCountdownState(entryId);
  if (!state.active) return;
  if (typeof state.remaining !== "number") return;
  if (state.remaining <= 0) return;

  const nextRemaining = state.remaining - 1;
  const reference = ref(db, `${getEntriesPath()}/${entryId}`);

  if (nextRemaining <= 0) {
    __setCountdownState(entryId, { remaining: 0, active: false, ended: true });
    __applyRowCountdownClasses(entryId, __getCountdownState(entryId));

    await update(reference, {
      countdownRemaining: 0,
      countdownActive: false,
      countdownEnded: true
    });
    return;
  }

  __setCountdownState(entryId, { remaining: nextRemaining, active: true, ended: false });
  __applyRowCountdownClasses(entryId, __getCountdownState(entryId));

  await update(reference, {
    countdownRemaining: nextRemaining,
    countdownActive: true,
    countdownEnded: false
  });
}

async function __cleanupEndedCountdownIfNeeded(entryId) {
  if (!entryId) return;
  const state = __getCountdownState(entryId);
  if (!state.ended) return;
  try {
    await clearCountdown(entryId);
  } catch (err) {
    console.error("Error cleaning up ended countdown:", err);
  }
}

window.addEventListener("tracker:highlightChange", async (e) => {
  const previousId = e?.detail?.previousId ?? null;
  const currentId = e?.detail?.currentId ?? null;
  const reason = e?.detail?.reason ?? "sync";

  if ((reason === "next" || reason === "prev") && previousId && previousId !== currentId) {
    await __cleanupEndedCountdownIfNeeded(previousId);
    const prevRow = __rowFor(previousId);
    if (prevRow) prevRow.classList.remove("countdown-expired");
  }

  if (currentId && (reason === "next" || reason === "prev")) {
    try {
      await __decrementCountdownIfNeeded(currentId);
    } catch (err) {
      console.error("Error decrementing countdown:", err);
    }
  }

  if (currentId) {
    const currentState = __getCountdownState(currentId);
    const row = __rowFor(currentId);
    if (row) {
      if (currentState.ended) row.classList.add("countdown-expired");
      else row.classList.remove("countdown-expired");
    }
  }
});

onReady(async () => {
  await requireAuth();

  fetchRankings();

  document.getElementById("apply-damage-button")?.addEventListener("click", applyDamageToAll);

  document.getElementById("clear-list-button")?.addEventListener("click", () => {
    if (!confirm("Clear the entire list?")) return;
    clearList();
  });
});