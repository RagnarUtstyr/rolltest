import { db } from "./firebase-config.js";
import { ref, update, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

let currentEntryId = null;

function qs(id) {
  return document.getElementById(id);
}

function getGameCode() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
  const code = getGameCode();
  if (!code) throw new Error("Missing game code in URL.");
  return `games/${code}/entries`;
}

function openModal(modal) {
  if (modal) modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (modal) modal.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeModal(qs("stat-modal"));
  closeModal(qs("hp-modal"));
  closeModal(qs("effect-picker-modal"));
  closeModal(qs("effects-modal"));
}

function fillStatModalFromRow(row) {
  currentEntryId = row.dataset.entryId || null;

  const name = row.dataset.name || row.querySelector(".name")?.textContent?.trim() || "Unknown";
  const initiative = row.dataset.initiative || "N/A";
  const ac = row.dataset.ac || row.querySelector(".ac")?.textContent?.replace(/^AC:\s*/, "") || "N/A";
  const hp = row.dataset.health || row.querySelector(".health")?.textContent?.replace(/^HP:\s*/, "") || "N/A";
  const url = row.dataset.url || "";

  if (qs("stat-modal-title")) qs("stat-modal-title").textContent = name;
  if (qs("stat-init")) qs("stat-init").textContent = initiative;
  if (qs("stat-ac")) qs("stat-ac").textContent = ac;
  if (qs("stat-hp")) qs("stat-hp").textContent = hp;

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

  if (qs("stat-heal-amount")) qs("stat-heal-amount").value = "";
}

function fillHpModalFromRow(row) {
  currentEntryId = row.dataset.entryId || null;

  const name = row.dataset.name || row.querySelector(".name")?.textContent?.trim() || "Unknown";
  const hp = row.dataset.health || row.querySelector(".health")?.textContent?.replace(/^HP:\s*/, "") || "";

  if (qs("hp-modal-title")) qs("hp-modal-title").textContent = `${name} HP`;
  if (qs("hp-set-amount")) qs("hp-set-amount").value = hp === "N/A" ? "" : hp;
}

function bindCloseBehavior(modalId, closeId) {
  const modal = qs(modalId);
  if (!modal) return;

  qs(closeId)?.addEventListener("click", () => closeModal(modal));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

function findRow(entryId) {
  return document.querySelector(`li[data-entry-id="${entryId}"]`);
}

async function healCurrentEntry() {
  if (!currentEntryId) return;

  const row = findRow(currentEntryId);
  const input = qs("stat-heal-amount");
  if (!row || !input) return;

  const amount = parseInt(input.value, 10);
  if (Number.isNaN(amount) || amount <= 0) return;

  const currentHealth = row.dataset.health === "N/A" ? 0 : parseInt(row.dataset.health, 10);
  const nextHealth = (Number.isNaN(currentHealth) ? 0 : currentHealth) + amount;

  await update(ref(db, `${getEntriesPath()}/${currentEntryId}`), { health: nextHealth });

  row.dataset.health = String(nextHealth);
  row.querySelector(".health").textContent = `HP: ${nextHealth}`;
  if (qs("stat-hp")) qs("stat-hp").textContent = String(nextHealth);
  input.value = "";
}

async function setCurrentEntryHp() {
  if (!currentEntryId) return;

  const row = findRow(currentEntryId);
  const input = qs("hp-set-amount");
  if (!row || !input) return;

  const amount = parseInt(input.value, 10);
  if (Number.isNaN(amount) || amount < 0) return;

  await update(ref(db, `${getEntriesPath()}/${currentEntryId}`), { health: amount });

  row.dataset.health = String(amount);
  row.querySelector(".health").textContent = `HP: ${amount}`;
  if (qs("stat-hp")) qs("stat-hp").textContent = String(amount);

  closeModal(qs("hp-modal"));
}

async function deleteCurrentEntry() {
  if (!currentEntryId) return;
  if (!confirm("Delete this entry from the list?")) return;

  await remove(ref(db, `${getEntriesPath()}/${currentEntryId}`));
  closeAllModals();
  currentEntryId = null;
}

document.addEventListener("DOMContentLoaded", () => {
  const rankingList = qs("rankingList");

  bindCloseBehavior("stat-modal", "stat-modal-close");
  bindCloseBehavior("hp-modal", "hp-modal-close");
  bindCloseBehavior("effect-picker-modal", "effect-picker-close");
  bindCloseBehavior("effects-modal", "effects-modal-close");

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  rankingList?.addEventListener("click", (e) => {
    const nameEl = e.target.closest(".name");
    if (nameEl) {
      const row = nameEl.closest("li");
      if (!row) return;
      fillStatModalFromRow(row);
      openModal(qs("stat-modal"));
      return;
    }

    const healthEl = e.target.closest(".health");
    if (healthEl) {
      const row = healthEl.closest("li");
      if (!row) return;
      fillHpModalFromRow(row);
      openModal(qs("hp-modal"));
    }
  });

  qs("stat-heal")?.addEventListener("click", healCurrentEntry);
  qs("hp-set-button")?.addEventListener("click", setCurrentEntryHp);
  qs("stat-delete")?.addEventListener("click", deleteCurrentEntry);

  qs("hp-set-amount")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setCurrentEntryHp();
    }
  });
});