// countdown_dnd.js
import { db } from "./firebase-config.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const countdownStateById = new Map();
let rankingListObserver = null;

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  return code ? `games/${code}/entries` : null;
}

function normalizeCountdown(entry) {
  const rawRemaining = entry?.countdownRemaining;
  let remaining = null;

  if (typeof rawRemaining === "number" && !Number.isNaN(rawRemaining)) {
    remaining = rawRemaining;
  } else if (rawRemaining !== null && rawRemaining !== undefined && rawRemaining !== "") {
    const parsed = Number(rawRemaining);
    remaining = Number.isNaN(parsed) ? null : parsed;
  }

  return {
    active: !!entry?.countdownActive,
    remaining,
    ended: !!entry?.countdownEnded
  };
}

function injectCountdownStyles() {
  if (document.getElementById("countdown-dnd-inline-styles")) return;

  const style = document.createElement("style");
  style.id = "countdown-dnd-inline-styles";
  style.textContent = `
    .dnd-countdown-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.78rem;
      line-height: 1.2;
      font-weight: 700;
      background: rgba(0, 0, 0, 0.18);
      border: 1px solid rgba(0, 0, 0, 0.18);
      white-space: nowrap;
    }

    .dnd-countdown-badge.ended {
      border-color: rgba(180, 40, 40, 0.45);
      background: rgba(180, 40, 40, 0.12);
    }

    #rankingList li.countdown-active {
      outline-offset: 0;
    }

    #rankingList li.countdown-expired {
      box-shadow: inset 0 0 0 2px rgba(180, 40, 40, 0.22);
    }
  `;
  document.head.appendChild(style);
}

function getRow(entryId) {
  return document.querySelector(`#rankingList li[data-entry-id="${entryId}"]`);
}

function getNameButton(row) {
  return row?.querySelector(".name-button");
}

function getBadgeText(state) {
  if (state.ended) return "CD: ENDED";
  if (state.active && typeof state.remaining === "number" && state.remaining > 0) {
    return `CD: ${state.remaining}`;
  }
  return "";
}

function updateRowCountdown(entryId) {
  const row = getRow(entryId);
  if (!row) return;

  const nameButton = getNameButton(row);
  if (!nameButton) return;

  const state = countdownStateById.get(entryId) || {
    active: false,
    remaining: null,
    ended: false
  };

  let badge = nameButton.querySelector(".dnd-countdown-badge");
  const text = getBadgeText(state);

  if (!text) {
    if (badge) badge.remove();
    row.classList.remove("countdown-active", "countdown-expired");
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = "dnd-countdown-badge";
    nameButton.appendChild(badge);
  }

  badge.textContent = text;
  badge.classList.toggle("ended", !!state.ended);

  if (state.active && typeof state.remaining === "number" && state.remaining > 0) {
    row.classList.add("countdown-active");
  } else {
    row.classList.remove("countdown-active");
  }

  if (state.ended) {
    row.classList.add("countdown-expired");
  } else {
    row.classList.remove("countdown-expired");
  }
}

function refreshAllVisibleRows() {
  document.querySelectorAll("#rankingList li[data-entry-id]").forEach((row) => {
    const entryId = row.dataset.entryId;
    if (entryId) updateRowCountdown(entryId);
  });
}

function watchRankingList() {
  const rankingList = document.getElementById("rankingList");
  if (!rankingList) return;

  if (rankingListObserver) rankingListObserver.disconnect();

  rankingListObserver = new MutationObserver(() => {
    refreshAllVisibleRows();
  });

  rankingListObserver.observe(rankingList, {
    childList: true,
    subtree: true
  });
}

function subscribeToCountdowns() {
  const path = getEntriesPath();
  if (!path) return;

  const entriesRef = ref(db, path);

  onValue(
    entriesRef,
    (snapshot) => {
      const data = snapshot.val() || {};
      countdownStateById.clear();

      Object.entries(data).forEach(([entryId, entry]) => {
        countdownStateById.set(entryId, normalizeCountdown(entry));
      });

      refreshAllVisibleRows();
    },
    (error) => {
      console.error("countdown_dnd.js Firebase listener failed:", error);
    }
  );
}

function boot() {
  try {
    injectCountdownStyles();
    watchRankingList();
    subscribeToCountdowns();
    refreshAllVisibleRows();
  } catch (error) {
    console.error("countdown_dnd.js failed to initialize:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}