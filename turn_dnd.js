// turn_dnd.js
let currentHighlightIndex = 0;
let previousHighlightedEntryId = null;

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

function applyHighlight(emitEvent = false, reason = "sync") {
  const items = getListItems();

  if (!items.length) {
    currentHighlightIndex = 0;
    previousHighlightedEntryId = null;
    return;
  }

  if (currentHighlightIndex < 0) currentHighlightIndex = 0;
  if (currentHighlightIndex >= items.length) {
    currentHighlightIndex = items.length - 1;
  }

  items.forEach((item) => item.classList.remove("highlighted"));

  const currentItem = items[currentHighlightIndex];
  if (!currentItem) return;

  currentItem.classList.add("highlighted");

  const currentId = currentItem.dataset.entryId || null;
  const previousId = previousHighlightedEntryId;

  if (emitEvent && currentId && currentId !== previousId) {
    window.dispatchEvent(
      new CustomEvent("tracker:highlightChange", {
        detail: {
          previousId,
          currentId,
          index: currentHighlightIndex,
          reason
        }
      })
    );
  }

  previousHighlightedEntryId = currentId;
}

function moveToNextEntry() {
  const items = getListItems();
  if (!items.length) return;

  currentHighlightIndex = (currentHighlightIndex + 1) % items.length;
  applyHighlight(true, "next");
}

function moveToPreviousEntry() {
  const items = getListItems();
  if (!items.length) return;

  currentHighlightIndex = (currentHighlightIndex - 1 + items.length) % items.length;
  applyHighlight(true, "prev");
}

function syncIndexToExistingHighlightOrEntry() {
  const items = getListItems();

  if (!items.length) {
    currentHighlightIndex = 0;
    previousHighlightedEntryId = null;
    return;
  }

  const highlightedIndex = items.findIndex((item) =>
    item.classList.contains("highlighted")
  );

  if (highlightedIndex >= 0) {
    currentHighlightIndex = highlightedIndex;
    previousHighlightedEntryId = items[highlightedIndex].dataset.entryId || null;
    return;
  }

  if (previousHighlightedEntryId) {
    const existingIndex = items.findIndex(
      (item) => item.dataset.entryId === previousHighlightedEntryId
    );
    if (existingIndex >= 0) {
      currentHighlightIndex = existingIndex;
      return;
    }
  }

  if (currentHighlightIndex >= items.length) {
    currentHighlightIndex = items.length - 1;
  }
  if (currentHighlightIndex < 0) {
    currentHighlightIndex = 0;
  }
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
  return item?.dataset?.entryId || null;
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("next-button")?.addEventListener("click", moveToNextEntry);

  const prevButton = document.getElementById("prev-button");
  if (prevButton) {
    prevButton.addEventListener("click", moveToPreviousEntry);
  }

  syncIndexToExistingHighlightOrEntry();
  applyHighlight(false, "sync");
  watchRankingList();
});