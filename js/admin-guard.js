// Firebase test-project ready: shared config + authenticated access.
import { ref, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./fauth.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  return code ? code.trim().toUpperCase() : "";
}

function getModeFromBody() {
  return document.body?.dataset?.mode || "";
}

function setGameMeta(text) {
  const el = document.getElementById("game-meta");
  if (el) el.textContent = text;
}

function showGuardError(message) {
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#1f1d1a;
      color:#e3cf95;
      font-family:'MedievalSharp', cursive;
      padding:20px;
      text-align:center;
    ">
      <div style="
        width:100%;
        max-width:560px;
        background:rgba(31,29,26,0.95);
        border:1px solid #2d3d73;
        border-radius:12px;
        padding:24px;
      ">
        <h1>Access Denied</h1>
        <p>${message}</p>
        <a href="lobby.html" style="
          display:inline-block;
          margin-top:12px;
          padding:10px 14px;
          border-radius:6px;
          text-decoration:none;
          background:#0b2621;
          color:#e3cf95;
          border:2px solid #2d3d73;
        ">Back to Lobby</a>
      </div>
    </div>
  `;
}

requireAuth(async (user) => {
  const code = getGameCode();
  const expectedMode = getModeFromBody().toLowerCase();

  if (!code) {
    showGuardError("Missing game code in URL.");
    return;
  }

  try {
    const snap = await get(ref(db, `games/${code}`));

    if (!snap.exists()) {
      showGuardError(`Game ${code} was not found.`);
      return;
    }

    const game = snap.val();
    const actualMode = String(game.mode || "").toLowerCase();

    if (game.ownerUid !== user.uid) {
      showGuardError("You are not the admin/owner of this game.");
      return;
    }

    if (
      expectedMode &&
      !(
        (expectedMode === "dnd" && actualMode === "dnd") ||
        (expectedMode === "openlegend" && (actualMode === "openlegend" || actualMode === "ol" || actualMode === "open_legend"))
      )
    ) {
      showGuardError(`This page does not match the game mode for ${code}.`);
      return;
    }

    const gameName = game.title || game.gameName || "Unnamed Game";
    setGameMeta(`${gameName} (${code})`);
  } catch (error) {
    console.error("admin-guard error:", error);
    showGuardError("Could not verify access to this admin page.");
  }
});