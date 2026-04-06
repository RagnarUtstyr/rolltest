function qs(id) {
  return document.getElementById(id);
}

function textAfterPrefix(text, prefix) {
  if (!text) return "";
  return text.startsWith(prefix) ? text.slice(prefix.length).trim() : text.trim();
}

function openModal(modal) {
  if (!modal) return;
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
}

function fillStatModalFromRow(row) {
  const name = row.dataset.name || row.querySelector(".name")?.textContent?.trim() || "Unknown";
  const initiative = row.dataset.initiative || "N/A";
  const ac = row.dataset.ac || textAfterPrefix(row.querySelector(".ac")?.textContent || "", "AC:") || "N/A";
  const hp = row.dataset.health || textAfterPrefix(row.querySelector(".health")?.textContent || "", "HP:") || "N/A";
  const url = row.dataset.url || "";

  qs("stat-modal-title").textContent = name;
  qs("stat-init").textContent = initiative;
  qs("stat-ac").textContent = ac;
  qs("stat-hp").textContent = hp;

  const link = qs("stat-url");
  if (link) {
    if (url) {
      link.href = url;
      link.style.display = "";
    } else {
      link.removeAttribute("href");
      link.style.display = "none";
    }
  }
}

function fillHpModalFromRow(row) {
  const name = row.dataset.name || row.querySelector(".name")?.textContent?.trim() || "Unknown";
  const hp = row.dataset.health || textAfterPrefix(row.querySelector(".health")?.textContent || "", "HP:") || "";

  qs("hp-modal-title").textContent = `${name} HP`;
  const input = qs("hp-set-amount");
  if (input) {
    input.value = hp === "N/A" ? "" : hp;
  }
}

function bindCloseBehavior(modalId, closeId) {
  const modal = qs(modalId);
  const closeBtn = qs(closeId);
  if (!modal) return;

  closeBtn?.addEventListener("click", () => closeModal(modal));

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const rankingList = qs("rankingList");
  const statModal = qs("stat-modal");
  const hpModal = qs("hp-modal");

  bindCloseBehavior("stat-modal", "stat-modal-close");
  bindCloseBehavior("hp-modal", "hp-modal-close");
  bindCloseBehavior("effect-picker-modal", "effect-picker-close");
  bindCloseBehavior("effects-modal", "effects-modal-close");

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(statModal);
      closeModal(hpModal);
      closeModal(qs("effect-picker-modal"));
      closeModal(qs("effects-modal"));
    }
  });

  if (!rankingList) return;

  rankingList.addEventListener("click", (e) => {
    const hpTarget = e.target.closest(".health-button, .health");
    if (hpTarget) {
      const row = hpTarget.closest("li");
      if (!row) return;
      fillHpModalFromRow(row);
      openModal(hpModal);
      return;
    }

    const nameTarget = e.target.closest(".name-button, .name");
    if (nameTarget) {
      const row = nameTarget.closest("li");
      if (!row) return;
      fillStatModalFromRow(row);
      openModal(statModal);
    }
  });
});