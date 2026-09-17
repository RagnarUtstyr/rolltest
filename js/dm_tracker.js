function byId(id) {
  return document.getElementById(id);
}

function openAddEntryModal() {
  const modal = byId("add-entry-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "false");
  window.setTimeout(() => byId("name")?.focus(), 0);
}

function closeAddEntryModal() {
  const modal = byId("add-entry-modal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
}

function closeMoreMenu() {
  const more = document.querySelector(".dm-more-menu[open]");
  if (more) more.removeAttribute("open");
}

function initDmTrackerUi() {
  const modal = byId("add-entry-modal");
  byId("add-entry-open-button")?.addEventListener("click", openAddEntryModal);
  byId("add-entry-close")?.addEventListener("click", closeAddEntryModal);
  byId("add-entry-cancel")?.addEventListener("click", closeAddEntryModal);

  modal?.addEventListener("click", (event) => {
    if (event.target === modal) closeAddEntryModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal?.getAttribute("aria-hidden") === "false") closeAddEntryModal();
    closeMoreMenu();
  });

  document.addEventListener("click", (event) => {
    const more = document.querySelector(".dm-more-menu[open]");
    if (more && !more.contains(event.target)) more.removeAttribute("open");
  });

  document.addEventListener("dm-entry-submitted", closeAddEntryModal);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDmTrackerUi);
} else {
  initDmTrackerUi();
}
