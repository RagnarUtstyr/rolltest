let currentHighlightIndex = 0;

// === Round counter (increments each time the list cycles back to the top) ===
window.roundCounter = window.roundCounter ?? 1;

window.updateRoundDisplay = function updateRoundDisplay() {
    const el = document.getElementById('round-value');
    if (el) el.textContent = window.roundCounter;
};

window.resetRoundCounter = function resetRoundCounter() {
    window.roundCounter = 1;
    window.updateRoundDisplay();
};

/* ===================== ADDED: tracker highlight event support ===================== */
/**
 * health.js listens to this to decrement countdowns when an entry is reached again.
 * We dispatch a single event whenever the highlighted row changes due to NAVIGATION.
 *
 *   window event: "tracker:highlightChange"
 *   detail: { previousId, currentId, index, roundCounter, reason }
 *
 * reason:
 *  - "next" / "prev" -> user navigation (countdown should tick)
 *  - "sync"          -> highlight re-application due to DOM changes (countdown should NOT tick)
 */
let __trackerPrevEntryId = null;
/* =================== /ADDED: tracker highlight event support =================== */

/**
 * highlightCurrentEntry controls whether to dispatch the "tracker:highlightChange" event.
 * - emitEvent = true only for true user navigation (next/prev)
 * - emitEvent = false for re-sync highlights (MutationObserver, initial load, removal refresh)
 */
function highlightCurrentEntry(emitEvent = false, reason = "sync") {
    const listItems = document.querySelectorAll('#rankingList li');

    // If there are no items, exit the function
    if (listItems.length === 0) {
        return;
    }

    // Ensure currentHighlightIndex is within bounds
    if (currentHighlightIndex >= listItems.length) {
        currentHighlightIndex = Math.min(currentHighlightIndex, listItems.length - 1);
    }

    // Remove highlight from all items
    listItems.forEach(item => item.classList.remove('highlighted'));

    // Highlight the current item
    const currentItem = listItems[currentHighlightIndex];
    currentItem.classList.add('highlighted');

    /* ===================== ADDED: emit highlight change event (navigation only) ===================== */
    if (emitEvent) {
        const currentId = currentItem?.dataset?.entryId ?? null;
        const previousId = __trackerPrevEntryId;

        // Only dispatch if we actually have a currentId and it changed
        if (currentId && currentId !== previousId) {
            window.dispatchEvent(new CustomEvent('tracker:highlightChange', {
                detail: {
                    previousId,
                    currentId,
                    index: currentHighlightIndex,
                    roundCounter: window.roundCounter ?? 1,
                    reason
                }
            }));
        }

        __trackerPrevEntryId = currentId;
    } else {
        // Keep prev id in sync without triggering countdown ticks
        const currentId = currentItem?.dataset?.entryId ?? null;
        if (currentId) __trackerPrevEntryId = currentId;
    }
    /* =================== /ADDED: emit highlight change event =================== */
}

function moveToNextEntry() {
    const listItems = document.querySelectorAll('#rankingList li');
    if (listItems.length === 0) return;

    const wasLast = currentHighlightIndex === listItems.length - 1;

    currentHighlightIndex = (currentHighlightIndex + 1) % listItems.length;

    if (wasLast && currentHighlightIndex === 0) {
        window.roundCounter = (window.roundCounter ?? 1) + 1;
        window.updateRoundDisplay?.();
    }

    // NAVIGATION highlight: emit event so countdown ticks once
    highlightCurrentEntry(true, "next");
}

function moveToPreviousEntry() {
    const listItems = document.querySelectorAll('#rankingList li');
    if (listItems.length === 0) return;

    currentHighlightIndex = (currentHighlightIndex - 1 + listItems.length) % listItems.length;

    // NAVIGATION highlight: emit event so countdown ticks once
    highlightCurrentEntry(true, "prev");
}

function refreshHighlightAfterRemoval() {
    const listItems = document.querySelectorAll('#rankingList li');

    if (listItems.length === 0) {
        currentHighlightIndex = 0;
        __trackerPrevEntryId = null;
        return;
    }

    if (currentHighlightIndex >= listItems.length) {
        currentHighlightIndex = Math.min(currentHighlightIndex, listItems.length - 1);
    }

    // Re-sync highlight: do NOT emit event (avoid countdown ticking)
    highlightCurrentEntry(false, "sync");
}

function removeEntry(listItem) {
    const listItems = document.querySelectorAll('#rankingList li');
    const indexToRemove = Array.from(listItems).indexOf(listItem);

    listItem.remove();

    if (currentHighlightIndex >= indexToRemove) {
        currentHighlightIndex = Math.max(0, currentHighlightIndex - 1);
    }

    refreshHighlightAfterRemoval();
}

// Ensure that highlighting is always applied after DOM changes or button clicks
function ensureHighlightAlwaysVisible() {
    const observer = new MutationObserver(() => {
        // Re-sync highlight after DOM changes: do NOT emit event (avoid countdown ticking)
        highlightCurrentEntry(false, "sync");
    });

    const listElement = document.getElementById('rankingList');
    if (listElement) {
        observer.observe(listElement, { childList: true, subtree: false });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const nextButton = document.getElementById('next-button');
    if (nextButton) nextButton.addEventListener('click', moveToNextEntry);

    const resetRoundButton = document.getElementById('reset-round-button');
    if (resetRoundButton) {
        resetRoundButton.addEventListener('click', () => {
            window.resetRoundCounter?.();

            // Re-sync highlight; no countdown tick
            highlightCurrentEntry(false, "sync");
        });
    }

    const prevButton = document.getElementById('prev-button');
    if (prevButton) prevButton.addEventListener('click', moveToPreviousEntry);

    // Initial highlight: do NOT emit event (avoid countdown ticking at page load)
    highlightCurrentEntry(false, "sync");
    window.updateRoundDisplay?.();

    ensureHighlightAlwaysVisible();
});