// Firebase test-project ready: shared config + authenticated access.
import { ref, get } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  return code ? code.trim().toUpperCase() : "";
}

function setStatus(message, detail = "", isError = false) {
  const statusEl = document.getElementById("admin-status");
  const detailEl = document.getElementById("admin-detail");

  if (statusEl) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  if (detailEl) {
    detailEl.textContent = detail;
    detailEl.classList.toggle("error", isError);
  }
}

requireAuth(async (user) => {
  const code = getGameCode();

  if (!code) {
    setStatus("Missing game code.", "Open this page as admin.html?code=ABCD", true);
    return;
  }

  setStatus("Loading game…", `Game code: ${code}`);

  try {
    const gameSnap = await get(ref(db, `games/${code}`));

    if (!gameSnap.exists()) {
      setStatus("Game not found.", `No game exists with code ${code}.`, true);
      return;
    }

    const game = gameSnap.val();

    if (!game.ownerUid) {
      setStatus("This game is missing owner information.", "Add ownerUid when creating the game.", true);
      return;
    }

    if (game.ownerUid !== user.uid) {
      setStatus("You are not the admin for this game.", "Only the game owner can open admin.html for this code.", true);
      return;
    }

    const mode = String(game.mode || "").toLowerCase();

    if (mode === "dnd") {
      window.location.href = `group_dnd.html?code=${encodeURIComponent(code)}`;
      return;
    }

    if (mode === "openlegend" || mode === "ol" || mode === "open_legend") {
      window.location.href = `group.html?code=${encodeURIComponent(code)}`;
      return;
    }

    setStatus(
      "Unknown game mode.",
      `Expected "dnd" or "openlegend", but got "${game.mode}".`,
      true
    );
  } catch (error) {
    console.error("admin-router error:", error);
    setStatus("Failed to load admin page.", error.message || "Unknown error", true);
  }
});