import { requireAuth } from "./auth.js";
import { db } from "./firebase-config.js";
import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";

const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").trim().toUpperCase();
const user = await requireAuth();
if (!code) throw new Error("Missing game code.");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const style = document.createElement("style");
style.textContent = `
  #dm-documents-button{white-space:nowrap}
  .dm-documents-dialog{width:min(760px,94vw)!important;max-height:88vh;overflow:auto}
  .dm-documents-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end;margin:12px 0}
  .dm-documents-toolbar input[type=file]{width:100%;min-width:0;padding:9px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:rgba(0,0,0,.18);color:inherit}
  .dm-documents-list{display:grid;gap:8px;margin-top:12px}
  .dm-document-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(0,0,0,.12)}
  .dm-document-row strong,.dm-document-row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .dm-document-status{min-height:1.2em;margin-top:8px}
  @media(max-width:600px){.dm-documents-toolbar{grid-template-columns:1fr}.dm-document-row{grid-template-columns:minmax(0,1fr) auto}.dm-document-row .button-link{grid-column:1/2}}
`;
document.head.appendChild(style);

const sessionBar = document.querySelector(".dm-session-bar");
const participantsButton = document.getElementById("participants-open-button");
const documentsButton = document.createElement("button");
documentsButton.id = "dm-documents-button";
documentsButton.type = "button";
documentsButton.className = "dm-header-button";
documentsButton.textContent = "Documents";
if (sessionBar) sessionBar.insertBefore(documentsButton, participantsButton || sessionBar.lastElementChild);

document.body.insertAdjacentHTML("beforeend", `
  <div id="dm-documents-modal" class="ol-modal" aria-hidden="true">
    <div class="ol-modal__dialog ol-modal__dialog--wide dm-documents-dialog" role="dialog" aria-modal="true" aria-labelledby="dm-documents-title">
      <button class="ol-modal__close" id="dm-documents-close" aria-label="Close">×</button>
      <h3 id="dm-documents-title">Game Documents</h3>
      <p class="muted">Upload files for players in this game. Files are stored with the game and appear in the players' Documents tab.</p>
      <div class="dm-documents-toolbar">
        <label>File<input id="dm-document-file" type="file" /></label>
        <button id="dm-document-upload" type="button">Upload</button>
      </div>
      <div id="dm-document-status" class="muted dm-document-status"></div>
      <div id="dm-documents-list" class="dm-documents-list"></div>
    </div>
  </div>
`);

const modal = document.getElementById("dm-documents-modal");
const list = document.getElementById("dm-documents-list");
const status = document.getElementById("dm-document-status");
const input = document.getElementById("dm-document-file");

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

documentsButton.addEventListener("click", () => modal?.setAttribute("aria-hidden", "false"));
document.getElementById("dm-documents-close")?.addEventListener("click", () => modal?.setAttribute("aria-hidden", "true"));
modal?.addEventListener("click", (event) => { if (event.target === modal) modal.setAttribute("aria-hidden", "true"); });

document.getElementById("dm-document-upload")?.addEventListener("click", async () => {
  const file = input?.files?.[0];
  if (!file) { status.textContent = "Choose a file first."; return; }
  // Realtime Database is used so this works with the same game rules as the tracker.
  // Keep the limit conservative to avoid oversized game records.
  if (file.size > 1_500_000) { status.textContent = "File is too large. Maximum size is 1.5 MB."; return; }
  try {
    status.textContent = "Uploading…";
    const dataUrl = await fileToDataUrl(file);
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await set(ref(db, `games/${code}/documents/${id}`), {
      id,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl,
      uploadedAt: Date.now(),
      uploadedBy: user.uid
    });
    input.value = "";
    status.textContent = "Uploaded.";
  } catch (error) {
    console.error(error);
    status.textContent = error.message || "Upload failed.";
  }
});

list?.addEventListener("click", async (event) => {
  const remove = event.target.closest("[data-dm-document-delete]");
  if (!remove) return;
  if (!confirm("Delete this document for all players?")) return;
  await set(ref(db, `games/${code}/documents/${remove.dataset.dmDocumentDelete}`), null);
});

onValue(ref(db, `games/${code}/documents`), (snapshot) => {
  const docs = Object.values(snapshot.val() || {}).sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0));
  list.innerHTML = docs.length ? docs.map((doc) => `
    <div class="dm-document-row">
      <div><strong>${escapeHtml(doc.name || "Document")}</strong><small>${escapeHtml(doc.type || "file")}${doc.size ? ` · ${Math.max(1, Math.round(Number(doc.size) / 1024))} KB` : ""}</small></div>
      <a class="button-link" href="${doc.dataUrl || "#"}" download="${escapeHtml(doc.name || "document")}">Open</a>
      <button type="button" class="remove-button" data-dm-document-delete="${escapeHtml(doc.id || "")}">Delete</button>
    </div>
  `).join("") : '<div class="empty-state">No documents uploaded yet.</div>';
});
