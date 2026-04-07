// turn_dnd.js
let currentHighlightIndex = 0;
let trackerPrevEntryId = null;

function highlightCurrentEntry(emitEvent = false, reason = "sync") {
  const listItems = document.querySelectorAll("#rankingList li");

  if (listItems.length === 0) {
    return;
  }

  if (currentHighlightIndex >= listItems.length) {
    currentHighlightIndex = Math.min(currentHighlightIndex, listItems.length - 1);
  }

  listItems.forEach((item) => item.classList.remove("highlighted"));

  const currentItem = listItems[currentHighlightIndex];
  currentItem.classList.add("highlighted");

  const currentId = currentItem?.dataset?.entryId ?? null;

  if (emitEvent) {
    const previousId = trackerPrevEntryId;

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

    trackerPrevEntryId = currentId;
  } else {
    if (currentId) trackerPrevEntryId = currentId;
  }
}

function moveToNextEntry() {
  const listItems = document.querySelectorAll("#rankingList li");
  if (listItems.length === 0) return;

  currentHighlightIndex = (currentHighlightIndex + 1) % listItems.length;
  highlightCurrentEntry(true, "next");
}

function moveToPreviousEntry() {
  const listItems = document.querySelectorAll("#rankingList li");
  if (listItems.length === 0) return;

  currentHighlightIndex =
    (currentHighlightIndex - 1 + listItems.length) % listItems.length;

  highlightCurrentEntry(true, "prev");
}

function ensureHighlightAlwaysVisible() {
  const observer = new MutationObserver(() => {
    highlightCurrentEntry(false, "sync");
  });

  const listElement = document.getElementById("rankingList");
  if (listElement) {
    observer.observe(listElement, { childList: true, subtree: false });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const nextButton = document.getElementById("next-button");
  if (nextButton) nextButton.addEventListener("click", moveToNextEntry);

  const prevButton = document.getElementById("prev-button");
  if (prevButton) prevButton.addEventListener("click", moveToPreviousEntry);

  highlightCurrentEntry(false, "sync");
  ensureHighlightAlwaysVisible();
});