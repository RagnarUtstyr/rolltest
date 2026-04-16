import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import {
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

let currentHighlightIndex = 0;
let previousHighlightedEntryId = null;
let currentUser = null;
let currentTrackerState = null;
let pendingHighlightedEntryId = null;
let isApplyingRemoteState = false;
let saveTrackerStatePromise = Promise.resolve();

window.roundCounter = window.roundCounter ?? 1;
window.updateRoundDisplay = function updateRoundDisplay() {
  const el = document.getElementById("round-value");
  if (el) el.textContent = String(window.roundCounter ?? 1);
};

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getTrackerStatePath(uid) {
  const code = getGameCode();
  if (!code || !uid) return null;
  return `games/${code}/trackerState/${uid}`;
}

function getListItems() {
  return Array.from(document.querySelectorAll("#rankingList li"));
}

function getCurrentItem() {
  const items = getListItems();
  if (!items.length) return null;

  if (currentHighlightIndex < 0) currentHighlightIndex = 0;
  if (currentHighlightIndex >= items.length) {
    currentHighlightIndex = items.length - 1;
  }

  return items[currentHighlightIndex] || null;
}

function buildTrackerStatePayload() {
  return {
    highlightedEntryId: window.getHighlightedEntryId?.() || pendingHighlightedEntryId || null,
    roundCounter: window.roundCounter ?? 1,
    updatedAt: Date.now()
  };
}

function persistTrackerState() {
  if (!currentUser || isApplyingRemoteState) return saveTrackerStatePromise;

  const path = getTrackerStatePath(currentUser.uid);
  if (!path) return saveTrackerStatePromise;

  const nextState = buildTrackerStatePayload();
  currentTrackerState = nextState;

  saveTrackerStatePromise = set(ref(db, path), nextState).catch((error) => {
    console.error("Error saving DND tracker state:", error);
  });

  return saveTrackerStatePromise;
}

function syncIndexToExistingHighlightOrEntry() {
  const items = getListItems();

  if (!items.length) {
    currentHighlightIndex = 0;
    previousHighlightedEntryId = null;
    return;
  }

  const targetId = pendingHighlightedEntryId || previousHighlightedEntryId;
  if (targetId) {
    const existingIndex = items.findIndex((item) => item.dataset.entryId === targetId);
    if (existingIndex >= 0) {
      currentHighlightIndex = existingIndex;
      return;
    }
  }

  const highlightedIndex = items.findIndex((item) => item.classList.contains("highlighted"));
  if (highlightedIndex >= 0) {
    currentHighlightIndex = highlightedIndex;
    previousHighlightedEntryId = items[highlightedIndex].dataset.entryId || null;
    return;
  }

  if (currentHighlightIndex >= items.length) currentHighlightIndex = items.length - 1;
  if (currentHighlightIndex < 0) currentHighlightIndex = 0;
}

function applyRemoteTrackerState(state) {
  isApplyingRemoteState = true;
  try {
    const nextRound = Number.parseInt(state?.roundCounter, 10);
    window.roundCounter = Number.isFinite(nextRound) && nextRound > 0 ? nextRound : 1;
    window.updateRoundDisplay?.();

    pendingHighlightedEntryId = state?.highlightedEntryId || null;
    syncIndexToExistingHighlightOrEntry();
    applyHighlight(false, "sync");
  } finally {
    isApplyingRemoteState = false;
  }
}

function applyHighlight(emitEvent = false, reason = "sync") {
  const items = getListItems();

  if (!items.length) {
    currentHighlightIndex = 0;
    previousHighlightedEntryId = null;
    pendingHighlightedEntryId = null;
    return;
  }

  syncIndexToExistingHighlightOrEntry();

  items.forEach((item) => item.classList.remove("highlighted"));

  const currentItem = items[currentHighlightIndex];
  if (!currentItem) return;

  currentItem.classList.add("highlighted");

  const currentId = currentItem.dataset.entryId || null;
  const previousId = previousHighlightedEntryId;
  pendingHighlightedEntryId = currentId;

  if (emitEvent && currentId && currentId !== previousId) {
    window.dispatchEvent(
      new CustomEvent("tracker:highlightChange", {
        detail: {
          previousId,
          currentId,
          index: currentHighlightIndex,
          roundCounter: window.roundCounter ?? 1,
          reason
        }
      })
    );
  }

  previousHighlightedEntryId = currentId;

  if (emitEvent) {
    persistTrackerState();
  }
}

function moveToNextEntry() {
  const items = getListItems();
  if (!items.length) return;

  const wasLast = currentHighlightIndex === items.length - 1;
  currentHighlightIndex = (currentHighlightIndex + 1) % items.length;

  if (wasLast && currentHighlightIndex === 0) {
    window.roundCounter = (window.roundCounter ?? 1) + 1;
    window.updateRoundDisplay?.();
  }

  applyHighlight(true, "next");
}

function moveToPreviousEntry() {
  const items = getListItems();
  if (!items.length) return;

  currentHighlightIndex = (currentHighlightIndex - 1 + items.length) % items.length;
  applyHighlight(true, "prev");
}

function watchRankingList() {
  const rankingList = document.getElementById("rankingList");
  if (!rankingList) return;

  const observer = new MutationObserver(() => {
    syncIndexToExistingHighlightOrEntry();
    applyHighlight(false, "sync");
  });

  observer.observe(rankingList, {
    childList: true,
    subtree: false
  });
}

window.getHighlightedEntryId = function () {
  const item = getCurrentItem();
  return item?.dataset?.entryId || pendingHighlightedEntryId || null;
};

async function initTrackerPersistence() {
  currentUser = await requireAuth();

  const path = getTrackerStatePath(currentUser.uid);
  if (!path) return;

  onValue(ref(db, path), (snapshot) => {
    if (!snapshot.exists()) {
      currentTrackerState = buildTrackerStatePayload();
      persistTrackerState();
      return;
    }

    const nextState = snapshot.val() || {};
    const nextKey = JSON.stringify({
      highlightedEntryId: nextState.highlightedEntryId || null,
      roundCounter: nextState.roundCounter || 1
    });
    const currentKey = JSON.stringify({
      highlightedEntryId: currentTrackerState?.highlightedEntryId || null,
      roundCounter: currentTrackerState?.roundCounter || 1
    });

    currentTrackerState = nextState;

    if (nextKey !== currentKey) {
      applyRemoteTrackerState(nextState);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("next-button")?.addEventListener("click", moveToNextEntry);

  const prevButton = document.getElementById("prev-button");
  if (prevButton) {
    prevButton.addEventListener("click", moveToPreviousEntry);
  }

  syncIndexToExistingHighlightOrEntry();
  applyHighlight(false, "sync");
  window.updateRoundDisplay?.();
  watchRankingList();

  initTrackerPersistence().catch((error) => {
    console.error("Failed to initialize DND tracker persistence:", error);
  });
});