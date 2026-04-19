// countdown_dnd.js
import { db } from "./js/ffirebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const latestCountdownState = new Map();
let rankingObserver = null;

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) {
    throw new Error("Missing game code in URL.");
  }
  return `games/${code}/entries`;
}

function normalizeCountdown(entry = {}) {
  const rawRemaining = entry.countdownRemaining;
  const numericRemaining =
    typeof rawRemaining === "number"
      ? rawRemaining
      : rawRemaining === null || rawRemaining === undefined || rawRemaining === ""
        ? null
        : Number(rawRemaining);

  return {
    active: !!entry.countdownActive,
    remaining: Number.isFinite(numericRemaining) ? numericRemaining : null,
    ended: !!entry.countdownEnded,
  };
}

function ensureStyles() {
  if (document.getElementById("countdown-dnd-styles")) return;

  const style = document.createElement("style");
  style.id = "countdown-dnd-styles";
  style.textContent = `
    .row-countdown {
      display: flex;
      justify-content: flex-start;
      margin-top: 6px;
      min-height: 24px;
    }

    .row-countdown:empty {
      display: none;
    }

    .row-countdown-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 0.82rem;
      line-height: 1;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #f5e7c1;
      white-space: nowrap;
    }

    .row-countdown-badge.is-ended {
      color: #ffb3b3;
      border-color: rgba(255, 120, 120, 0.45);
      background: rgba(100, 0, 0, 0.25);
    }

    li.countdown-expired {
      box-shadow: 0 0 0 1px rgba(255, 120, 120, 0.4);
    }
  `;
  document.head.appendChild(style);
}

function getRow(entryId) {
  return document.querySelector(`#rankingList li[data-entry-id="${entryId}"]`);
}

function ensureCountdownContainer(row) {
  let container = row.querySelector(".row-countdown");
  if (container) return container;

  container = document.createElement("div");
  container.className = "row-countdown";

  const nameAcContainer = row.querySelector(".name-ac-container");
  if (nameAcContainer) {
    nameAcContainer.appendChild(container);
  } else {
    row.appendChild(container);
  }

  return container;
}

function formatCountdownLabel(state) {
  if (state.ended) return "⏳ Ended";
  if (state.active && typeof state.remaining === "number") {
    return `⏳ ${state.remaining} turn${state.remaining === 1 ? "" : "s"}`;
  }
  if (!state.active && state.remaining === 0) return "⏳ 0 turns";
  return "";
}

function applyCountdownToRow(row, state) {
  if (!row) return;

  const container = ensureCountdownContainer(row);
  const label = formatCountdownLabel(state);

  row.dataset.countdownActive = String(!!state.active);
  row.dataset.countdownEnded = String(!!state.ended);
  row.dataset.countdownRemaining =
    typeof state.remaining === "number" ? String(state.remaining) : "";

  container.innerHTML = "";

  if (!label) {
    row.classList.remove("countdown-expired");
    return;
  }

  const badge = document.createElement("span");
  badge.className = `row-countdown-badge${state.ended ? " is-ended" : ""}`;
  badge.textContent = label;
  container.appendChild(badge);

  row.classList.toggle("countdown-expired", !!state.ended);
}

function refreshAllVisibleRows() {
  document.querySelectorAll("#rankingList li[data-entry-id]").forEach((row) => {
    const entryId = row.dataset.entryId;
    if (!entryId) return;

    const state =
      latestCountdownState.get(entryId) ||
      normalizeCountdown({
        countdownActive: row.dataset.countdownActive === "true",
        countdownRemaining:
          row.dataset.countdownRemaining === "" ? null : Number(row.dataset.countdownRemaining),
        countdownEnded: row.dataset.countdownEnded === "true",
      });

    applyCountdownToRow(row, state);
  });
}

function watchRankingList() {
  if (rankingObserver) {
    rankingObserver.disconnect();
  }

  const rankingList = document.getElementById("rankingList");
  if (!rankingList) return;

  rankingObserver = new MutationObserver(() => {
    refreshAllVisibleRows();
  });

  rankingObserver.observe(rankingList, {
    childList: true,
    subtree: true,
  });
}

function subscribeToCountdowns() {
  const entriesRef = ref(db, getEntriesPath());

  onValue(entriesRef, (snapshot) => {
    latestCountdownState.clear();

    const data = snapshot.val() || {};
    Object.entries(data).forEach(([entryId, entry]) => {
      latestCountdownState.set(entryId, normalizeCountdown(entry));
    });

    refreshAllVisibleRows();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureStyles();
  watchRankingList();
  subscribeToCountdowns();
  refreshAllVisibleRows();
});