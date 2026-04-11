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

const MODE_TO_PAGE = {
  dnd: "group_dnd.html",
  openlegend: "group.html",
  ol: "group.html",
  open_legend: "group.html",
  pathfinder2e: "group.html",
  pf2e: "group.html",
  callofcthulhu7e: "group.html",
  coc7e: "group.html",
  savageworlds: "group.html",
  swade: "group.html",
  vampire5e: "group.html",
  vtm5e: "group.html",
  worldofdarkness: "group.html",
  cyberpunkred: "group.html",
  lancer: "group.html",
  shadowdark: "group.html",
  warhammer4e: "group.html",
  wfrp4e: "group.html",
  starfinder: "group.html"
};

const targetPage = MODE_TO_PAGE[mode];

if (!targetPage) {
  statusEl.textContent = `Unknown game mode: ${game.mode}`;
  throw new Error(`Unknown game mode: ${game.mode}`);
}

window.location.href = `${targetPage}?code=${encodeURIComponent(code)}`;
