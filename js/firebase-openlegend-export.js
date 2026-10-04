import { db, firestore } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const TRANSFER_FORMAT = "rpgtracker-openlegend-transfer";
const TRANSFER_VERSION = 1;

function isOpenLegend(mode) {
  const value = String(mode || "").toLowerCase();
  return value === "openlegend" || value === "open_legend" || value === "ol";
}

function safeClone(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (Array.isArray(value)) return value.map(safeClone);
  if (typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = safeClone(child);
    return out;
  }
  return value;
}

async function readPath(path, fallback = null) {
  const snapshot = await get(ref(db, path));
  return snapshot.exists() ? safeClone(snapshot.val()) : fallback;
}

async function readCustomNpcs(uid, gameCode) {
  const npcRef = collection(firestore, "users", uid, "gameCustomNpcs", gameCode, "npcs");
  const snapshot = await getDocs(npcRef);
  return snapshot.docs.map((item) => ({ id: item.id, ...safeClone(item.data()) }));
}

function rosterFromGame(game = {}) {
  return Object.values(game.members || {}).map((member) => ({
    sourceUid: member?.uid || "",
    name: member?.name || "",
    role: member?.role || "player"
  }));
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function exportOpenLegendFirebaseGame({ user, game }) {
  if (!user?.uid) throw new Error("Sign in before exporting.");
  if (!game?.code) throw new Error("Game code is missing.");
  if (!isOpenLegend(game.mode)) throw new Error("Only Open Legend games can be exported by this migration tool.");

  const code = String(game.code).trim().toUpperCase();
  const sourceGame = await readPath(`games/${code}`, null);
  if (!sourceGame) throw new Error("Game not found in Firebase.");

  const isOwner = sourceGame.ownerUid === user.uid || sourceGame.members?.[user.uid]?.role === "admin";

  const [player, builder, entry, trackerState, customNpcs] = await Promise.all([
    readPath(`games/${code}/players/${user.uid}`, null),
    readPath(`games/${code}/builderSheets/${user.uid}`, null),
    readPath(`games/${code}/entries/${user.uid}`, null),
    readPath(`games/${code}/trackerState/${user.uid}`, null),
    readCustomNpcs(user.uid, code)
  ]);

  const payload = {
    format: TRANSFER_FORMAT,
    version: TRANSFER_VERSION,
    system: "openlegend",
    exportedAt: Date.now(),
    source: {
      provider: "firebase",
      projectId: "rpgtracker-7387b",
      gameCode: code,
      gameTitle: sourceGame.title || game.title || "Open Legend Game",
      gameCreatedAt: sourceGame.createdAt || null,
      sourceUserUid: user.uid,
      sourceUserName: user.displayName || "",
      sourceRole: isOwner ? "gm" : "player"
    },
    game: {
      title: sourceGame.title || game.title || "Open Legend Game",
      mode: "openlegend",
      ownerName: sourceGame.ownerName || "",
      roster: rosterFromGame(sourceGame)
    },
    userData: {
      character: {
        player: player || null,
        builder: builder || null,
        entry: entry || null
      },
      trackerState: trackerState || null,
      customNpcs
    },
    dmData: isOwner ? {
      savedLists: safeClone(sourceGame.savedLists || {}),
      initiativeEntries: safeClone(sourceGame.entries || {}),
      roster: rosterFromGame(sourceGame)
    } : null
  };

  const role = isOwner ? "dm" : "player";
  const filename = `rpgtracker-openlegend-${code}-${role}-${dateStamp()}.json`;
  downloadJson(filename, payload);

  return {
    filename,
    role,
    characterIncluded: Boolean(player || builder || entry),
    customNpcCount: customNpcs.length,
    savedListCount: isOwner ? Object.keys(sourceGame.savedLists || {}).length : 0,
    initiativeEntryCount: isOwner ? Object.keys(sourceGame.entries || {}).length : 0
  };
}
