import { db } from "./firebase-config.js";
import { ref, set, get, update, onValue, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 4) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function gameRef(code) {
  return ref(db, `games/${code}`);
}

function gameJoinIndexRef(code) {
  return ref(db, `gameJoinIndex/${code}`);
}

function membershipRef(uid) {
  return ref(db, `memberships/${uid}`);
}

function userGamesRef(uid) {
  return ref(db, `users/${uid}/games`);
}

function gameSummaryFromGame(game = {}) {
  return {
    code: game.code || "",
    title: game.title || "Game",
    mode: game.mode || "dnd",
    ownerUid: game.ownerUid || "",
    ownerName: game.ownerName || "Admin",
    createdAt: game.createdAt || Date.now()
  };
}

export async function createUniqueGameCode(length = 4, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = randomCode(length);
    const snapshot = await get(gameJoinIndexRef(code));
    if (!snapshot.exists()) return code;
  }
  throw new Error("Could not generate a unique game code.");
}

export async function createGame({ owner, mode, title }) {
  const code = await createUniqueGameCode();
  const createdAt = Date.now();
  const game = {
    code,
    title: title?.trim() || `${mode === "dnd" ? "D&D" : "Open Legend"} Game`,
    mode,
    ownerUid: owner.uid,
    ownerName: owner.displayName || owner.email || "Admin",
    createdAt,
    members: {
      [owner.uid]: {
        uid: owner.uid,
        role: "admin",
        name: owner.displayName || "Admin",
        email: owner.email || ""
      }
    }
  };

  const summary = gameSummaryFromGame(game);

  await update(ref(db), {
    [`games/${code}`]: game,
    [`gameJoinIndex/${code}`]: summary,
    [`memberships/${owner.uid}`]: { gameCode: code, role: "admin", mode },
    [`users/${owner.uid}/games/${code}`]: {
      code,
      role: "admin",
      joinedAt: createdAt
    }
  });

  return game;
}

export async function joinGame({ user, code }) {
  const normalized = code.trim().toUpperCase();
  const gameIndexSnap = await get(gameJoinIndexRef(normalized));

  if (!gameIndexSnap.exists()) {
    throw new Error("Game not found.");
  }

  const gameSummary = gameIndexSnap.val();
  const joinedAt = Date.now();

  await update(ref(db), {
    [`games/${normalized}/members/${user.uid}`]: {
      uid: user.uid,
      role: "player",
      name: user.displayName || "Player",
      email: user.email || ""
    },
    [`memberships/${user.uid}`]: {
      gameCode: normalized,
      role: "player",
      mode: gameSummary.mode || "dnd"
    },
    [`users/${user.uid}/games/${normalized}`]: {
      code: normalized,
      role: "player",
      joinedAt
    }
  });

  const fullGameSnap = await get(gameRef(normalized));
  return fullGameSnap.exists() ? fullGameSnap.val() : gameSummary;
}

export async function leaveCurrentGame(uid) {
  const membershipSnap = await get(membershipRef(uid));
  if (!membershipSnap.exists()) return;

  const membership = membershipSnap.val();
  const { gameCode } = membership;

  await update(ref(db), {
    [`games/${gameCode}/members/${uid}`]: null,
    [`games/${gameCode}/entries/${uid}`]: null,
    [`games/${gameCode}/players/${uid}`]: null,
    [`games/${gameCode}/builderSheetsDnd/${uid}`]: null,
    [`memberships/${uid}`]: null,
    [`users/${uid}/games/${gameCode}`]: null
  });
}

export async function leaveSpecificGame(uid, gameCode) {
  const normalized = gameCode.trim().toUpperCase();
  const gameSnap = await get(gameRef(normalized));

  if (!gameSnap.exists()) {
    throw new Error("Game not found.");
  }

  const game = gameSnap.val();

  if (game.ownerUid === uid) {
    throw new Error("The owner cannot leave their own game. Delete it instead.");
  }

  const updates = {
    [`games/${normalized}/members/${uid}`]: null,
    [`games/${normalized}/entries/${uid}`]: null,
    [`games/${normalized}/players/${uid}`]: null,
    [`games/${normalized}/builderSheetsDnd/${uid}`]: null,
    [`users/${uid}/games/${normalized}`]: null
  };

  const membershipSnap = await get(membershipRef(uid));
  if (membershipSnap.exists()) {
    const membership = membershipSnap.val();
    if (membership.gameCode === normalized) {
      updates[`memberships/${uid}`] = null;
    }
  }

  await update(ref(db), updates);
}

export async function deleteGame(ownerUid, gameCode) {
  const normalized = gameCode.trim().toUpperCase();
  const gameSnap = await get(gameRef(normalized));

  if (!gameSnap.exists()) {
    throw new Error("Game not found.");
  }

  const game = gameSnap.val();
  if (game.ownerUid !== ownerUid) {
    throw new Error("Only the owner can delete this game.");
  }

  const members = game.members || {};
  const memberIds = Object.keys(members);
  const updates = {
    [`games/${normalized}`]: null,
    [`gameJoinIndex/${normalized}`]: null
  };

  for (const uid of memberIds) {
    const membershipSnap = await get(membershipRef(uid));
    if (membershipSnap.exists()) {
      const membership = membershipSnap.val();
      if (membership.gameCode === normalized) {
        updates[`memberships/${uid}`] = null;
      }
    }
    updates[`users/${uid}/games/${normalized}`] = null;
  }

  await update(ref(db), updates);
}

export async function loadMembership(uid) {
  const membershipSnap = await get(membershipRef(uid));
  return membershipSnap.exists() ? membershipSnap.val() : null;
}

export function watchOwnedAndJoinedGames(uid, callback) {
  const indexRef = userGamesRef(uid);
  let stopGameWatchers = [];

  const clearGameWatchers = () => {
    stopGameWatchers.forEach((stop) => stop());
    stopGameWatchers = [];
  };

  const stopIndexWatcher = onValue(indexRef, (snapshot) => {
    clearGameWatchers();

    const codes = Object.keys(snapshot.val() || {});
    if (!codes.length) {
      callback([]);
      return;
    }

    const gameMap = new Map();

    const publish = () => {
      const games = codes
        .map((code) => gameMap.get(code))
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      callback(games);
    };

    codes.forEach((code) => {
      const stop = onValue(gameRef(code), (gameSnapshot) => {
        if (gameSnapshot.exists()) {
          gameMap.set(code, gameSnapshot.val());
        } else {
          gameMap.delete(code);
        }
        publish();
      });

      stopGameWatchers.push(stop);
    });
  });

  return () => {
    stopIndexWatcher();
    clearGameWatchers();
  };
}

export async function submitInitiative({ gameCode, user, initiative, name }) {
  const entriesRef = ref(db, `games/${gameCode}/entries/${user.uid}`);
  const entry = {
    uid: user.uid,
    playerName: name?.trim() || user.displayName || "Player",
    initiative: Number(initiative),
    updatedAt: Date.now()
  };

  await set(entriesRef, entry);
}

export async function removePlayerEntry(gameCode, uid) {
  await remove(ref(db, `games/${gameCode}/entries/${uid}`));
}

export function watchEntries(gameCode, callback) {
  return onValue(ref(db, `games/${gameCode}/entries`), (snapshot) => {
    const data = snapshot.val() || {};
    const entries = Object.values(data).sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    callback(entries);
  });
}

export function watchGame(gameCode, callback) {
  return onValue(gameRef(gameCode), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

export async function watchOrLoadGame(gameCode) {
  const snapshot = await get(gameRef(gameCode));
  return snapshot.exists() ? snapshot.val() : null;
}

export async function updateGameMeta(gameCode, patch) {
  const normalized = gameCode.trim().toUpperCase();
  await update(gameRef(normalized), patch);

  const nextSummaryPatch = {};
  if (patch.title !== undefined) nextSummaryPatch.title = patch.title;
  if (patch.mode !== undefined) nextSummaryPatch.mode = patch.mode;
  if (patch.ownerName !== undefined) nextSummaryPatch.ownerName = patch.ownerName;

  if (Object.keys(nextSummaryPatch).length) {
    await update(gameJoinIndexRef(normalized), nextSummaryPatch);
  }
}