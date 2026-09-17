import { requireAuth, logout } from "./auth.js";
import {
  createGame,
  joinGame,
  watchOwnedAndJoinedGames,
  deleteGame,
  leaveSpecificGame
} from "./game-service.js?v=20260917olui1";

const createBtn = document.getElementById("create-game-button");
const joinBtn = document.getElementById("join-game-button");
const logoutBtn = document.getElementById("logout-button");
const statusEl = document.getElementById("lobby-status");
const gamesList = document.getElementById("games-list");
const userCard = document.getElementById("user-card");

function gameLink(game, uid) {
  const role = game.ownerUid === uid ? "admin" : (game.members?.[uid]?.role || "player");
  const target = role === "admin" ? "admin.html" : "player.html";
  return `${target}?code=${encodeURIComponent(game.code)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function modeLabel(mode) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "openlegend" || normalized === "open_legend" || normalized === "ol") return "Open Legend";
  if (normalized === "dnd") return "D&D";
  return mode || "Game";
}

function modeClass(mode) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "openlegend" || normalized === "open_legend" || normalized === "ol") return "is-openlegend";
  if (normalized === "dnd") return "is-dnd";
  return "";
}

const user = await requireAuth();

userCard.innerHTML = `
  <div class="user-row">
    ${user.photoURL ? `<img src="${escapeHtml(user.photoURL)}" alt="${escapeHtml(user.displayName || "User")}" class="avatar" />` : ""}
    <div>
      <div class="panel-kicker">Signed in</div>
      <div><strong>${escapeHtml(user.displayName || "User")}</strong></div>
      <div class="muted">${escapeHtml(user.email || "")}</div>
    </div>
  </div>
`;

watchOwnedAndJoinedGames(user.uid, (games) => {
  if (!games.length) {
    gamesList.innerHTML = "";
    return;
  }

  gamesList.innerHTML = games.map((game) => {
    const isOwner = game.ownerUid === user.uid;
    const role = isOwner ? "Admin" : "Player";
    const actionLabel = isOwner ? "Delete game" : "Leave game";

    const systemLabel = modeLabel(game.mode);
    const systemClass = modeClass(game.mode);

    return `
      <div class="game-card" data-mode="${escapeHtml(String(game.mode || ""))}">
        <div class="game-card-row">
          <a class="game-card-main" href="${gameLink(game, user.uid)}">
            <div class="game-card-title-row">
              <strong class="game-card-title">${escapeHtml(game.title || "Untitled game")}</strong>
              <span class="role-badge ${isOwner ? "is-admin" : ""}">${role}</span>
            </div>
            <div class="game-card-meta">
              <span class="system-badge ${systemClass}">${escapeHtml(systemLabel)}</span>
              <span class="code-badge">${escapeHtml(game.code)}</span>
            </div>
          </a>
          <button
            class="game-action-button"
            data-game-code="${escapeHtml(game.code)}"
            data-is-owner="${String(isOwner)}"
            type="button"
          >
            ${actionLabel}
          </button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".game-action-button").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const gameCode = button.dataset.gameCode;
      const isOwner = button.dataset.isOwner === "true";

      try {
        if (isOwner) {
          const confirmed = confirm(`Delete game ${gameCode}? This removes the room, entries, and saved lists for everyone.`);
          if (!confirmed) return;
          statusEl.textContent = "Deleting game...";
          await deleteGame(user.uid, gameCode);
          statusEl.textContent = `Game ${gameCode} deleted.`;
        } else {
          const confirmed = confirm(`Leave game ${gameCode}? This removes your character/entry from that room.`);
          if (!confirmed) return;
          statusEl.textContent = "Leaving game...";
          await leaveSpecificGame(user.uid, gameCode);
          statusEl.textContent = `You left game ${gameCode}.`;
        }
      } catch (error) {
        console.error(error);
        statusEl.textContent = error.message || "Could not complete that action.";
      }
    });
  });
});

createBtn?.addEventListener("click", async () => {
  const title = document.getElementById("game-title").value;
  const mode = document.getElementById("game-mode").value;

  statusEl.textContent = "Creating game...";
  try {
    const game = await createGame({ owner: user, mode, title });
    window.location.href = `admin.html?code=${encodeURIComponent(game.code)}`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Could not create game.";
  }
});

joinBtn?.addEventListener("click", async () => {
  const code = document.getElementById("join-code").value.trim().toUpperCase();

  statusEl.textContent = "Joining game...";
  try {
    const game = await joinGame({ user, code });
    window.location.href = `player.html?code=${encodeURIComponent(game.code)}`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Could not join game.";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await logout();
  window.location.href = "login.html";
});