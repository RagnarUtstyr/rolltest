import { requireAuth } from "./auth.js";
import { watchOrLoadGame } from "./game-service.js";

const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").toUpperCase();

const metaEl = document.getElementById("game-meta");
const statusEl = document.getElementById("admin-status");

const user = await requireAuth();

if (!code) {
  statusEl.textContent = "Missing game code.";
  throw new Error("Missing game code.");
}

const game = await watchOrLoadGame(code);

if (!game) {
  statusEl.textContent = "Game not found.";
  throw new Error("Game not found.");
}

if (game.ownerUid !== user.uid) {
  window.location.href = `player.html?code=${encodeURIComponent(code)}`;
  throw new Error("User is not the game owner.");
}

metaEl.innerHTML = `
  <div><strong>${game.title}</strong></div>
  <div class="muted">Code: ${game.code} · ${game.mode} · Admin: ${game.ownerName}</div>
`;

statusEl.textContent = "Opening tracker...";

const mode = String(game.mode || "").toLowerCase();

if (mode === "dnd") {
  window.location.href = `group_dnd.html?code=${encodeURIComponent(code)}`;
} else if (mode === "openlegend" || mode === "ol" || mode === "open_legend") {
  window.location.href = `group.html?code=${encodeURIComponent(code)}`;
} else {
  statusEl.textContent = `Unknown game mode: ${game.mode}`;
  throw new Error(`Unknown game mode: ${game.mode}`);
}