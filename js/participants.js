import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function displayName(member = {}) {
  const name = String(member.name || "").trim();
  if (name) return name;

  const email = String(member.email || "").trim();
  if (email) return email;

  return "Unnamed player";
}

function renderParticipants(members, ownerUid) {
  const panel = document.getElementById("participants-panel");
  const list = document.getElementById("participants-list");
  const count = document.getElementById("participants-count");
  if (!panel || !list || !count) return;

  const players = Object.values(members || {})
    .filter(Boolean)
    .filter((member) => member.uid !== ownerUid && String(member.role || "").toLowerCase() !== "admin")
    .sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" }));

  count.textContent = `${players.length} ${players.length === 1 ? "player" : "players"}`;
  list.replaceChildren();

  if (!players.length) {
    const empty = document.createElement("div");
    empty.className = "participants-empty";
    empty.textContent = "No players have joined yet.";
    list.appendChild(empty);
    return;
  }

  players.forEach((member) => {
    const row = document.createElement("div");
    row.className = "participant-row";

    const name = document.createElement("span");
    name.className = "participant-name";
    name.textContent = displayName(member);

    const role = document.createElement("span");
    role.className = "participant-role";
    role.textContent = "Player";

    row.append(name, role);
    list.appendChild(row);
  });
}

async function initParticipantsPanel() {
  const panel = document.getElementById("participants-panel");
  if (!panel) return;

  const code = getGameCode();
  if (!code) return;

  const user = await requireAuth();

  onValue(ref(db, `games/${code}`), (snapshot) => {
    if (!snapshot.exists()) {
      panel.hidden = true;
      return;
    }

    const game = snapshot.val() || {};
    const isOwner = game.ownerUid === user.uid;
    panel.hidden = !isOwner;

    if (!isOwner) return;
    renderParticipants(game.members || {}, game.ownerUid || user.uid);
  }, (error) => {
    console.error("Could not load participants:", error);
    panel.hidden = true;
  });
}

initParticipantsPanel().catch((error) => {
  console.error("Participants panel failed to initialize:", error);
});
