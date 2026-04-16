import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";
import {
  ref,
  set,
  onValue
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

let currentHighlightIndex = 0;
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

window.resetRoundCounter = function resetRoundCounter() {
  window.roundCounter = 1;
  window.updateRoundDisplay();
  persistTrackerState();
};

let __trackerPrevEntryId = null;

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
  const listItems = getListItems();
  if (!listItems.length) return null;

  if (currentHighlightIndex < 0) currentHighlightIndex = 0;
  if (currentHighlightIndex >= listItems.length) {
    currentHighlightIndex = listItems.length - 1;
  }

  return listItems[currentHighlightIndex] || null;
}

function getCurrentHighlightedEntryId() {
  const currentItem = getCurrentItem();
  return currentItem?.dataset?.entryId ?? pendingHighlightedEntryId ?? null;
}

window.getHighlightedEntryId = getCurrentHighlightedEntryId;

function syncIndexToStoredEntryId() {
  const listItems = getListItems();
  if (!listItems.length) {
    currentHighlightIndex = 0;
    return;
  }

  const targetId = pendingHighlightedEntryId || __trackerPrevEntryId;
  if (targetId) {
    const existingIndex = listItems.findIndex((item) => item.dataset.entryId === targetId);
    if (existingIndex >= 0) {
      currentHighlightIndex = existingIndex;
      return;
    }
  }

  if (currentHighlightIndex >= listItems.length) {
    currentHighlightIndex = listItems.length - 1;
  }
  if (currentHighlightIndex < 0) {
    currentHighlightIndex = 0;
  }
}

function buildTrackerStatePayload() {
  return {
    highlightedEntryId: getCurrentHighlightedEntryId(),
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
    console.error("Error saving tracker state:", error);
  });

  return saveTrackerStatePromise;
}

function applyRemoteTrackerState(state) {
  isApplyingRemoteState = true;
  try {
    const nextRound = Number.parseInt(state?.roundCounter, 10);
    window.roundCounter = Number.isFinite(nextRound) && nextRound > 0 ? nextRound : 1;
    window.updateRoundDisplay?.();

    pendingHighlightedEntryId = state?.highlightedEntryId || null;
    syncIndexToStoredEntryId();
    highlightCurrentEntry(false, "sync");
  } finally {
    isApplyingRemoteState = false;
  }
}

function highlightCurrentEntry(emitEvent = false, reason = "sync") {
  const listItems = getListItems();

  if (listItems.length === 0) {
    return;
  }

  if (!emitEvent) {
    syncIndexToStoredEntryId();
  } else {
    if (currentHighlightIndex >= listItems.length) currentHighlightIndex = listItems.length - 1;
    if (currentHighlightIndex < 0) currentHighlightIndex = 0;
  }

  listItems.forEach((item) => item.classList.remove("highlighted"));

  const currentItem = listItems[currentHighlightIndex];
  if (!currentItem) return;

  currentItem.classList.add("highlighted");

  const currentId = currentItem?.dataset?.entryId ?? null;
  pendingHighlightedEntryId = currentId;

  if (emitEvent) {
    const previousId = __trackerPrevEntryId;

    if (currentId && currentId !== previousId) {
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

    __trackerPrevEntryId = currentId;
    persistTrackerState();
  } else if (currentId) {
    __trackerPrevEntryId = currentId;
  }
}

function moveToNextEntry() {
  const listItems = getListItems();
  if (listItems.length === 0) return;

  const wasLast = currentHighlightIndex === listItems.length - 1;
  currentHighlightIndex = (currentHighlightIndex + 1) % listItems.length;

  if (wasLast && currentHighlightIndex === 0) {
    window.roundCounter = (window.roundCounter ?? 1) + 1;
    window.updateRoundDisplay?.();
  }

  highlightCurrentEntry(true, "next");
}

function moveToPreviousEntry() {
  const listItems = getListItems();
  if (listItems.length === 0) return;

  currentHighlightIndex = (currentHighlightIndex - 1 + listItems.length) % listItems.length;
  highlightCurrentEntry(true, "prev");
}

function refreshHighlightAfterRemoval() {
  const listItems = getListItems();

  if (listItems.length === 0) {
    currentHighlightIndex = 0;
    pendingHighlightedEntryId = null;
    __trackerPrevEntryId = null;
    persistTrackerState();
    return;
  }

  if (currentHighlightIndex >= listItems.length) {
    currentHighlightIndex = Math.min(currentHighlightIndex, listItems.length - 1);
  }

  highlightCurrentEntry(false, "sync");
  persistTrackerState();
}

function removeEntry(listItem) {
  const listItems = getListItems();
  const indexToRemove = listItems.indexOf(listItem);

  listItem.remove();

  if (currentHighlightIndex >= indexToRemove) {
    currentHighlightIndex = Math.max(0, currentHighlightIndex - 1);
  }

  refreshHighlightAfterRemoval();
}

function ensureHighlightAlwaysVisible() {
  const observer = new MutationObserver(() => {
    syncIndexToStoredEntryId();
    highlightCurrentEntry(false, "sync");
  });

  const listElement = document.getElementById("rankingList");
  if (listElement) {
    observer.observe(listElement, { childList: true, subtree: false });
  }
}

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
  const nextButton = document.getElementById("next-button");
  if (nextButton) nextButton.addEventListener("click", moveToNextEntry);

  const resetRoundButton = document.getElementById("reset-round-button");
  if (resetRoundButton) {
    resetRoundButton.addEventListener("click", () => {
      window.resetRoundCounter?.();
      highlightCurrentEntry(false, "sync");
    });
  }

  const prevButton = document.getElementById("prev-button");
  if (prevButton) prevButton.addEventListener("click", moveToPreviousEntry);

  highlightCurrentEntry(false, "sync");
  window.updateRoundDisplay?.();
  ensureHighlightAlwaysVisible();

  initTrackerPersistence().catch((error) => {
    console.error("Failed to initialize tracker persistence:", error);
  });
});
