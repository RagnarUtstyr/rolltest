import { db } from "./firebase-config.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function getSavedListsPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/savedLists`;
}

async function getGameMode() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");

  const snap = await get(ref(db, `games/${code}`));
  if (!snap.exists()) return "dnd";

  const mode = String(snap.val()?.mode || "").toLowerCase();
  if (mode === "openlegend" || mode === "ol" || mode === "open_legend") {
    return "openlegend";
  }
  return "dnd";
}

async function getGroupPageForCurrentGame() {
  const mode = await getGameMode();
  return mode === "openlegend" ? "group.html" : "group_dnd.html";
}

function normalizeEntries(listLike) {
  if (!listLike) return [];
  if (Array.isArray(listLike)) return listLike.filter(Boolean);
  return Object.values(listLike).filter(Boolean);
}

async function fetchCurrentListFromFirebase() {
  const rankingsRef = ref(db, getEntriesPath());
  const snap = await get(rankingsRef);
  return snap.exists() ? snap.val() : null;
}

async function fetchSavedLists() {
  const savedRef = ref(db, getSavedListsPath());
  const snap = await get(savedRef);
  return snap.exists() ? snap.val() : {};
}

function renderSavedLists(saved) {
  const ul = document.getElementById("savedLists");
  if (!ul) return;

  ul.innerHTML = "";
  const names = Object.keys(saved);

  if (names.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No saved lists yet.";
    ul.appendChild(li);
    return;
  }

  names.sort().forEach((name) => {
    const li = document.createElement("li");
    li.className = "saved-list-item";
    li.textContent = name;
    li.style.cursor = "pointer";
    li.title = "Click to select this list name below";
    li.addEventListener("click", () => {
      const input = document.getElementById("list-name");
      if (input) input.value = name;
    });
    ul.appendChild(li);
  });
}

async function saveList() {
  const listNameEl = document.getElementById("list-name");
  const listName = (listNameEl?.value || "").trim();

  if (!listName) {
    alert("Please enter a name for the list.");
    return;
  }

  const current = await fetchCurrentListFromFirebase();
  if (!current) {
    alert("There is no current list to save.");
    return;
  }

  const saveRef = ref(db, `${getSavedListsPath()}/${listName}`);
  await set(saveRef, {
    list: current,
    savedAt: Date.now()
  });

  alert(`List "${listName}" saved for this game.`);
  loadSavedLists();
}

async function loadList() {
  const listNameEl = document.getElementById("list-name");
  const listName = (listNameEl?.value || "").trim();

  if (!listName) {
    alert("Please enter the name of the list to load.");
    return;
  }

  const loadRef = ref(db, `${getSavedListsPath()}/${listName}`);
  const snap = await get(loadRef);

  if (!snap.exists()) {
    alert(`No list found with the name "${listName}".`);
    return;
  }

  const savedList = snap.val().list;
  const entries = normalizeEntries(savedList);

  if (entries.length === 0) {
    alert(`Saved list "${listName}" is empty.`);
    return;
  }

  const rankingsRef = ref(db, getEntriesPath());

  for (const entry of entries) {
    const {
      name,
      playerName,
      number,
      initiative,
      initiativeBonus,
      health,
      currentHp,
      grd,
      res,
      tgh,
      url,
      ac,
      banes,
      countdownRemaining,
      countdownActive,
      countdownEnded,
      customBuild,
      createdByUid,
      createdByName
    } = entry || {};

    await set(push(rankingsRef), {
      name: name ?? playerName ?? "Unknown",
      playerName: playerName ?? name ?? "Unknown",
      number: typeof number === "number"
        ? number
        : typeof initiative === "number"
          ? initiative
          : typeof initiativeBonus === "number"
            ? initiativeBonus
            : 0,
      initiative: typeof initiative === "number"
        ? initiative
        : typeof number === "number"
          ? number
          : 0,
      health: typeof health === "number"
        ? health
        : typeof currentHp === "number"
          ? currentHp
          : null,
      currentHp: typeof currentHp === "number"
        ? currentHp
        : typeof health === "number"
          ? health
          : null,
      grd: typeof grd === "number" ? grd : null,
      res: typeof res === "number" ? res : null,
      tgh: typeof tgh === "number" ? tgh : null,
      ac: typeof ac === "number" ? ac : null,
      url: url ?? null,
      banes: banes ?? null,
      customBuild: customBuild ?? null,
      createdByUid: createdByUid ?? customBuild?.createdByUid ?? null,
      createdByName: createdByName ?? customBuild?.createdByName ?? null,
      countdownRemaining: typeof countdownRemaining === "number" ? countdownRemaining : null,
      countdownActive: !!countdownActive,
      countdownEnded: !!countdownEnded,
      loadedFromSavedList: true,
      updatedAt: Date.now()
    });
  }

  const code = getGameCode();
  const groupPage = await getGroupPageForCurrentGame();
  alert(`List "${listName}" loaded into this game.`);
  window.location.href = `${groupPage}?code=${encodeURIComponent(code)}`;
}

async function deleteList() {
  const listNameEl = document.getElementById("list-name");
  const listName = (listNameEl?.value || "").trim();

  if (!listName) {
    alert("Please enter the name of the list to delete.");
    return;
  }

  if (!confirm(`Delete saved list "${listName}"? This cannot be undone.`)) return;

  const delRef = ref(db, `${getSavedListsPath()}/${listName}`);
  await remove(delRef);

  alert(`List "${listName}" deleted.`);
  loadSavedLists();
}

async function loadSavedLists() {
  try {
    const saved = await fetchSavedLists();
    renderSavedLists(saved);
  } catch (err) {
    console.error("Error loading saved lists:", err);
  }
}

document.getElementById("save-list-button")?.addEventListener("click", saveList);
document.getElementById("load-list-button")?.addEventListener("click", loadList);
document.getElementById("delete-list-button")?.addEventListener("click", deleteList);

document.addEventListener("DOMContentLoaded", async () => {
  loadSavedLists();

  const backLink = document.getElementById("view-rankings-link");
  if (backLink) {
    const code = getGameCode();
    const groupPage = await getGroupPageForCurrentGame();
    backLink.href = `${groupPage}?code=${encodeURIComponent(code)}`;
  }
});