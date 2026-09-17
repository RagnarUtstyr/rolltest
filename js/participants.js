import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { BANES } from "./banes.js";
import { EFFECTS } from "./effects.js";
import {
  ref,
  onValue,
  get,
  update
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function characterRecord(game, uid) {
  const member = game?.members?.[uid] || {};
  const sheet = game?.players?.[uid] || {};
  const entry = game?.entries?.[uid] || {};
  const builder = game?.builderSheetsDnd?.[uid] || {};

  const characterName = [
    sheet.name,
    sheet.playerName,
    entry.name,
    entry.playerName,
    builder.name
  ].map((value) => String(value || "").trim()).find(Boolean) || "Character not set";

  return {
    uid,
    member,
    sheet,
    entry,
    builder,
    characterName
  };
}

function getPlayerMembers(game) {
  const ownerUid = game?.ownerUid || "";
  return Object.values(game?.members || {})
    .filter(Boolean)
    .filter((member) => member.uid && member.uid !== ownerUid && String(member.role || "").toLowerCase() !== "admin")
    .sort((a, b) => {
      const aName = characterRecord(game, a.uid).characterName;
      const bName = characterRecord(game, b.uid).characterName;
      return aName.localeCompare(bName, undefined, { sensitivity: "base" });
    });
}

function normalizedMode(game) {
  const mode = String(game?.mode || "").toLowerCase();
  if (mode === "dnd") return "dnd";
  if (mode === "openlegend" || mode === "ol" || mode === "open_legend") return "openlegend";
  return mode;
}

function noteValue(value) {
  if (!value) {
    return {
      text: "", updatedAt: 0, updatedByRole: "", updatedByName: "",
      pingActive: false, pingEligible: false, pingedAt: 0, pingedNoteUpdatedAt: 0, dmReadAt: 0
    };
  }
  if (typeof value === "string") {
    return {
      text: value, updatedAt: 0, updatedByRole: "", updatedByName: "",
      pingActive: false, pingEligible: false, pingedAt: 0, pingedNoteUpdatedAt: 0, dmReadAt: 0
    };
  }
  return {
    text: String(value.text || ""),
    updatedAt: Number(value.updatedAt) || 0,
    updatedByRole: String(value.updatedByRole || ""),
    updatedByName: String(value.updatedByName || ""),
    pingActive: value.pingActive === true,
    pingEligible: value.pingEligible === true,
    pingedAt: Number(value.pingedAt) || 0,
    pingedNoteUpdatedAt: Number(value.pingedNoteUpdatedAt) || 0,
    dmReadAt: Number(value.dmReadAt) || 0
  };
}

function formatNoteMeta(note) {
  if (!note.updatedAt) return "Shared between DM and player.";
  const who = note.updatedByRole === "dm" ? "DM" : note.updatedByRole === "player" ? "Player" : "Someone";
  const when = new Date(note.updatedAt).toLocaleString();
  return `Last updated by ${who} · ${when}`;
}

function hasActivePing(game, uid) {
  return noteValue(game?.players?.[uid]?.sharedNote).pingActive;
}

function activePingCount(game) {
  return getPlayerMembers(game).reduce((count, member) => count + (hasActivePing(game, member.uid) ? 1 : 0), 0);
}

function currentStatuses(game, uid) {
  const mode = normalizedMode(game);
  const field = mode === "dnd" ? "effects" : "banes";
  const sheet = game?.players?.[uid];
  const entry = game?.entries?.[uid];

  const sheetStamp = Number(sheet?.statusUpdatedAt) || 0;
  const entryStamp = Number(entry?.statusUpdatedAt) || 0;

  if (entry && entry[field] !== undefined && entryStamp > sheetStamp) return normalizeList(entry[field]);
  if (sheet && sheet[field] !== undefined) return normalizeList(sheet[field]);
  if (entry && entry[field] !== undefined) return normalizeList(entry[field]);
  return [];
}

function statusLibrary(game) {
  return normalizedMode(game) === "dnd" ? EFFECTS : BANES;
}

function statusField(game) {
  return normalizedMode(game) === "dnd" ? "effects" : "banes";
}

function statusLabel(game) {
  return normalizedMode(game) === "dnd" ? "Effects" : "Banes";
}

let currentGame = null;
let currentUser = null;
let selectedUid = null;

const code = getGameCode();

function els() {
  return {
    openButton: document.getElementById("participants-open-button"),
    countBadge: document.getElementById("participants-button-count"),
    pingBadge: document.getElementById("participants-ping-badge"),
    modal: document.getElementById("participants-modal"),
    closeButton: document.getElementById("participants-modal-close"),
    listView: document.getElementById("participants-list-view"),
    list: document.getElementById("participants-list"),
    count: document.getElementById("participants-count"),
    detailView: document.getElementById("participant-detail-view"),
    backButton: document.getElementById("participant-detail-back"),
    detailName: document.getElementById("participant-detail-name"),
    stats: document.getElementById("participant-detail-stats"),
    note: document.getElementById("participant-note"),
    noteMeta: document.getElementById("participant-note-meta"),
    noteSave: document.getElementById("participant-note-save"),
    noteStatus: document.getElementById("participant-note-status"),
    statusTitle: document.getElementById("participant-status-title"),
    statusCurrent: document.getElementById("participant-status-current"),
    statusSelect: document.getElementById("participant-status-select"),
    statusAdd: document.getElementById("participant-status-add"),
    statusMessage: document.getElementById("participant-status-message")
  };
}

function showModal() {
  const { modal } = els();
  if (!modal) return;
  selectedUid = null;
  renderListView();
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const { modal } = els();
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  selectedUid = null;
}

function renderListView() {
  const { listView, detailView, list, count, countBadge, pingBadge } = els();
  if (!currentGame || !list || !count) return;

  listView?.removeAttribute("hidden");
  detailView?.setAttribute("hidden", "");

  const players = getPlayerMembers(currentGame);
  const countText = `${players.length} ${players.length === 1 ? "player" : "players"}`;
  count.textContent = countText;
  if (countBadge) countBadge.textContent = String(players.length);
  const pingCount = activePingCount(currentGame);
  if (pingBadge) {
    pingBadge.textContent = String(pingCount);
    pingBadge.hidden = pingCount === 0;
  }

  list.replaceChildren();

  if (!players.length) {
    const empty = document.createElement("div");
    empty.className = "participants-empty";
    empty.textContent = "No players have joined yet.";
    list.appendChild(empty);
    return;
  }

  players.forEach((member) => {
    const record = characterRecord(currentGame, member.uid);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "participant-row participant-row-button";
    button.addEventListener("click", () => openParticipantDetail(member.uid));

    const text = document.createElement("span");
    text.className = "participant-row-text";

    const nameLine = document.createElement("span");
    nameLine.className = "participant-name-line";

    const character = document.createElement("span");
    character.className = "participant-name";
    character.textContent = record.characterName;
    nameLine.appendChild(character);

    if (hasActivePing(currentGame, member.uid)) {
      button.classList.add("has-ping");
      const ping = document.createElement("span");
      ping.className = "participant-ping-indicator";
      ping.textContent = "!";
      ping.title = "New note ping";
      ping.setAttribute("aria-label", "New note ping");
      nameLine.appendChild(ping);
    }

    text.appendChild(nameLine);

    const arrow = document.createElement("span");
    arrow.className = "participant-open-arrow";
    arrow.textContent = "›";

    button.append(text, arrow);
    list.appendChild(button);
  });
}

function addStat(label, value) {
  const { stats } = els();
  if (!stats) return;

  const card = document.createElement("div");
  card.className = "participant-stat-card";

  const labelEl = document.createElement("span");
  labelEl.className = "participant-stat-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "participant-stat-value";
  valueEl.textContent = safeText(value);

  card.append(labelEl, valueEl);
  stats.appendChild(card);
}

function renderStats(record) {
  const { stats } = els();
  if (!stats || !currentGame) return;
  stats.replaceChildren();

  const mode = normalizedMode(currentGame);
  const sheet = record.sheet || {};
  const entry = record.entry || {};
  const builder = record.builder || {};

  addStat("Initiative", sheet.initiative ?? entry.initiative ?? entry.number ?? builder.initiativeBonus);

  if (mode === "dnd") {
    addStat("HP", sheet.currentHp ?? sheet.hp ?? entry.currentHp ?? entry.health ?? builder.currentHp ?? builder.hp);
    addStat("AC", sheet.ac ?? entry.ac ?? builder.ac);
    addStat("Prof", sheet.proficiencyBonus ?? sheet.prof ?? builder.proficiencyBonus ?? builder.prof);
    addStat("STR", sheet.strength ?? sheet.str ?? builder.strength ?? builder.str);
    addStat("DEX", sheet.dexterity ?? sheet.dex ?? builder.dexterity ?? builder.dex);
    addStat("CON", sheet.constitution ?? sheet.con ?? builder.constitution ?? builder.con);
    addStat("INT", sheet.intelligence ?? sheet.int ?? builder.intelligence ?? builder.int);
    addStat("WIS", sheet.wisdom ?? sheet.wis ?? builder.wisdom ?? builder.wis);
    addStat("CHA", sheet.charisma ?? sheet.cha ?? builder.charisma ?? builder.cha);
  } else {
    addStat("HP", sheet.currentHp ?? entry.currentHp ?? entry.health);
    addStat("GRD", sheet.grd ?? entry.grd);
    addStat("RES", sheet.res ?? entry.res);
    addStat("TGH", sheet.tgh ?? entry.tgh);
    addStat("Lethal", sheet.lethal ?? entry.lethal ?? 0);
    addStat("Fatigue", sheet.fatigue?.points ?? entry.fatigue?.points ?? 0);
  }
}

function renderStatusControls(uid) {
  const {
    statusTitle,
    statusCurrent,
    statusSelect,
    statusMessage
  } = els();
  if (!currentGame || !statusTitle || !statusCurrent || !statusSelect) return;

  const label = statusLabel(currentGame);
  const statuses = currentStatuses(currentGame, uid);
  const library = statusLibrary(currentGame);

  statusTitle.textContent = label;
  statusMessage.textContent = "";
  statusCurrent.replaceChildren();

  if (!statuses.length) {
    const empty = document.createElement("span");
    empty.className = "participants-empty";
    empty.textContent = `No ${label.toLowerCase()} active.`;
    statusCurrent.appendChild(empty);
  } else {
    statuses.forEach((status) => {
      const chip = document.createElement("div");
      chip.className = "participant-status-chip";

      if (status?.icon) {
        const icon = document.createElement("img");
        icon.src = status.icon;
        icon.alt = status.name || label.slice(0, -1);
        chip.appendChild(icon);
      }

      const name = document.createElement("span");
      name.textContent = status?.name || "Unknown";
      chip.appendChild(name);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "participant-status-remove";
      remove.textContent = "×";
      remove.title = `Remove ${status?.name || label.slice(0, -1)}`;
      remove.addEventListener("click", () => removeStatus(uid, status?.name || ""));
      chip.appendChild(remove);

      statusCurrent.appendChild(chip);
    });
  }

  const existingNames = new Set(statuses.map((item) => String(item?.name || "").toLowerCase()));
  statusSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = `Add ${label.slice(0, -1).toLowerCase()}…`;
  statusSelect.appendChild(placeholder);

  library
    .filter((item) => !existingNames.has(String(item?.name || "").toLowerCase()))
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")))
    .forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name || "";
      option.textContent = item.name || "Unknown";
      statusSelect.appendChild(option);
    });
}

function renderParticipantDetail() {
  if (!currentGame || !selectedUid) return;

  const {
    listView,
    detailView,
    detailName,
    note,
    noteMeta,
    noteStatus
  } = els();

  const record = characterRecord(currentGame, selectedUid);
  const sharedNote = noteValue(currentGame?.players?.[selectedUid]?.sharedNote);

  listView?.setAttribute("hidden", "");
  detailView?.removeAttribute("hidden");

  if (detailName) detailName.textContent = record.characterName;

  renderStats(record);

  if (note && document.activeElement !== note) note.value = sharedNote.text;
  if (noteMeta) noteMeta.textContent = formatNoteMeta(sharedNote);
  if (noteStatus) noteStatus.textContent = "";

  renderStatusControls(selectedUid);
}

async function openParticipantDetail(uid) {
  selectedUid = uid;
  renderParticipantDetail();

  const sharedNote = noteValue(currentGame?.players?.[uid]?.sharedNote);
  if (sharedNote.pingActive && code) {
    try {
      await update(ref(db, `games/${code}/players/${uid}/sharedNote`), {
        pingActive: false,
        dmReadAt: Date.now()
      });
    } catch (error) {
      console.error("Could not clear participant ping:", error);
    }
  }
}

async function saveSharedNote() {
  if (!currentGame || !currentUser || !selectedUid || !code) return;
  const { note, noteStatus } = els();
  if (!note) return;

  if (noteStatus) noteStatus.textContent = "Saving…";
  try {
    await update(ref(db, `games/${code}/players/${selectedUid}/sharedNote`), {
      text: note.value,
      updatedAt: Date.now(),
      updatedByUid: currentUser.uid,
      updatedByRole: "dm",
      updatedByName: currentUser.displayName || "DM"
    });
    if (noteStatus) noteStatus.textContent = "Saved.";
  } catch (error) {
    console.error("Could not save participant note:", error);
    if (noteStatus) noteStatus.textContent = error.message || "Could not save note.";
  }
}

async function getStatusTargets(uid) {
  const field = statusField(currentGame);
  const [sheetSnap, entrySnap] = await Promise.all([
    get(ref(db, `games/${code}/players/${uid}`)),
    get(ref(db, `games/${code}/entries/${uid}`))
  ]);

  const sheet = sheetSnap.exists() ? sheetSnap.val() : null;
  const entry = entrySnap.exists() ? entrySnap.val() : null;
  const sheetStamp = Number(sheet?.statusUpdatedAt) || 0;
  const entryStamp = Number(entry?.statusUpdatedAt) || 0;
  const source = entry && entry[field] !== undefined && entryStamp > sheetStamp
    ? normalizeList(entry[field])
    : sheet && sheet[field] !== undefined
      ? normalizeList(sheet[field])
      : normalizeList(entry?.[field]);

  return { field, sheetExists: !!sheet, entryExists: !!entry, source };
}

async function writeStatuses(uid, statuses) {
  const { statusMessage } = els();
  if (!currentGame || !code || !uid) return;

  const targets = await getStatusTargets(uid);
  if (!targets.sheetExists && !targets.entryExists) {
    if (statusMessage) statusMessage.textContent = "This player has not created character data yet.";
    return;
  }

  const stamp = Date.now();
  const updates = {};
  if (targets.sheetExists) {
    updates[`games/${code}/players/${uid}/${targets.field}`] = statuses;
    updates[`games/${code}/players/${uid}/statusUpdatedAt`] = stamp;
  }
  if (targets.entryExists) {
    updates[`games/${code}/entries/${uid}/${targets.field}`] = statuses;
    updates[`games/${code}/entries/${uid}/statusUpdatedAt`] = stamp;
  }

  try {
    await update(ref(db), updates);
    if (statusMessage) statusMessage.textContent = `${statusLabel(currentGame)} updated.`;
  } catch (error) {
    console.error("Could not update participant status:", error);
    if (statusMessage) statusMessage.textContent = error.message || "Could not update status.";
  }
}

async function addSelectedStatus() {
  if (!currentGame || !selectedUid) return;
  const { statusSelect, statusMessage } = els();
  const selectedName = String(statusSelect?.value || "").trim();
  if (!selectedName) {
    if (statusMessage) statusMessage.textContent = "Choose an item to add.";
    return;
  }

  const item = statusLibrary(currentGame).find((candidate) => candidate?.name === selectedName);
  if (!item) return;

  const targets = await getStatusTargets(selectedUid);
  if (targets.source.some((status) => String(status?.name || "").toLowerCase() === selectedName.toLowerCase())) return;

  const next = [
    ...targets.source,
    normalizedMode(currentGame) === "dnd"
      ? {
          name: item.name,
          url: item.url || "",
          icon: item.icon || "icons/effects/test.png",
          type: item.type || "",
          description: item.description || ""
        }
      : {
          name: item.name,
          url: item.url || "",
          icon: item.icon || "../icons/banes/test.png"
        }
  ];

  await writeStatuses(selectedUid, next);
}

async function removeStatus(uid, name) {
  if (!name) return;
  const targets = await getStatusTargets(uid);
  const next = targets.source.filter((status) => String(status?.name || "") !== name);
  await writeStatuses(uid, next);
}

function bindUi() {
  const {
    openButton,
    modal,
    closeButton,
    backButton,
    noteSave,
    statusAdd
  } = els();

  openButton?.addEventListener("click", showModal);
  closeButton?.addEventListener("click", closeModal);
  backButton?.addEventListener("click", () => {
    selectedUid = null;
    renderListView();
  });
  noteSave?.addEventListener("click", saveSharedNote);
  statusAdd?.addEventListener("click", addSelectedStatus);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.getAttribute("aria-hidden") === "false") {
      closeModal();
    }
  });
}

async function initParticipants() {
  const { openButton } = els();
  if (!openButton || !code) return;

  currentUser = await requireAuth();
  bindUi();

  onValue(ref(db, `games/${code}`), (snapshot) => {
    if (!snapshot.exists()) {
      currentGame = null;
      openButton.hidden = true;
      closeModal();
      return;
    }

    currentGame = snapshot.val() || {};
    const isOwner = currentGame.ownerUid === currentUser.uid;
    openButton.hidden = !isOwner;

    if (!isOwner) {
      closeModal();
      return;
    }

    const players = getPlayerMembers(currentGame);
    const { countBadge, pingBadge, modal } = els();
    if (countBadge) countBadge.textContent = String(players.length);
    const pingCount = activePingCount(currentGame);
    if (pingBadge) {
      pingBadge.textContent = String(pingCount);
      pingBadge.hidden = pingCount === 0;
    }

    if (modal?.getAttribute("aria-hidden") === "false") {
      if (selectedUid && currentGame?.members?.[selectedUid]) renderParticipantDetail();
      else renderListView();
    }
  }, (error) => {
    console.error("Could not load participants:", error);
    openButton.hidden = true;
  });
}

initParticipants().catch((error) => {
  console.error("Participants modal failed to initialize:", error);
});
