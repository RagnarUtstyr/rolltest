const rankingList = document.getElementById("rankingList");

rankingList?.addEventListener("click", (e) => {
  const nameEl = e.target.closest(".name");
  if (!nameEl) return;

  const row = nameEl.closest("li");
  if (!row) return;

  // collect values from the row
  // fill modal fields
  // show modal
});