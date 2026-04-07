let currentHighlightIndex = 0;
let previousHighlightedEntryId = null;

function getListItems() {
  return Array.from(document.querySelectorAll("#rankingList li"));
}

function getHighlightedEntryId() {
  const items = getListItems();
  if (!items.length) return null;
  const current = items[currentHighlightIndex];
  return current?.dataset?.entryId ?? null;
}

function syncIndexWithinBounds(items) {
  if (!items.length) {
    currentHighlightIndex = 0;
    return;
  }

  if (currentHighlightIndex < 0) {
    currentHighlightIndex = 0;
  }

  if (currentHighlightIndex >= items.length) {
    currentHighlightIndex = Math.max(0, items.length - 1);
  }
}

function highlightCurrentEntry(emitEvent = false, reason = "sync") {
  const listItems = getListItems();
  if (!listItems.length) {
    previousHighlightedEntryId = null;
    return;
  }

  syncIndexWithinBounds(listItems);

  listItems.forEach((item) => item.classList.remove("highlighted"));

  const currentItem = listItems[currentHighlightIndex];
  currentItem.classList.add("highlighted");

  const currentId = currentItem?.dataset?.entryId ?? null;

  if (emitEvent) {
    const previousId = previousHighlightedEntryId;
    if (currentId && currentId !== previousId) {
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
  }

  previousHighlightedEntryId = currentId;
}

function moveToNextEntry() {
  const listItems = getListItems();
  if (!listItems.length) return;

  currentHighlightIndex = (currentHighlightIndex + 1) % listItems.length;
  highlightCurrentEntry(true, "next");
}

function moveToPreviousEntry() {
  const listItems = getListItems();
  if (!listItems.length) return;

  currentHighlightIndex =
    (currentHighlightIndex - 1 + listItems.length) % listItems.length;

  highlightCurrentEntry(true, "prev");
}

function ensureHighlightAlwaysVisible() {
  const listElement = document.getElementById("rankingList");
  if (!listElement) return;

  const observer = new MutationObserver(() => {
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
    } else if (previousHighlightedEntryId) {
      const previousIndex = items.findIndex(
        (item) => item.dataset.entryId === previousHighlightedEntryId
      );
      if (previousIndex >= 0) {
        currentHighlightIndex = previousIndex;
      }
    }

    highlightCurrentEntry(false, "sync");
  });

  observer.observe(listElement, { childList: true, subtree: false });
}

window.getHighlightedEntryId = getHighlightedEntryId;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("next-button")?.addEventListener("click", moveToNextEntry);
  document.getElementById("prev-button")?.addEventListener("click", moveToPreviousEntry);

  highlightCurrentEntry(false, "sync");
  ensureHighlightAlwaysVisible();
});