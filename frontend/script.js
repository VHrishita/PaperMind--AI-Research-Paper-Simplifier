import { auth, db } from "./firebase-config.js";
import {
  ref,
  push,
  set,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * PaperMind - FINAL FULL PRODUCTION SCRIPT
 */

const API_BASE = "https://papermind-ai-research-paper-simplifier-2.onrender.com/api";

let uploadedPapers = [];
let activePaperId = null;
let pdfDoc = null;
let pdfCurrentPage = 1;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
}

function showLoading(text = "Processing...") {
  $("#loading-text").textContent = text;
  show($("#loading-overlay"));
}

function hideLoading() {
  hide($("#loading-overlay"));
}

function showToast(msg, duration = 3000) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = msg;
  show(toast);
  setTimeout(() => hide(toast), duration);
}

/* ================= NAVIGATION ================= */
$$(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    const panelName = btn.dataset.panel;

    $$(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    $$(".panel").forEach(p => p.classList.remove("active"));
    $(`#panel-${panelName}`)?.classList.add("active");

    $("#topbar-title").textContent = btn.textContent.trim();
  });
});

/* ================= PDF ================= */
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

async function renderPDFPage(pageNum) {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageNum);
  const canvas = $("#pdf-canvas");
  const ctx = canvas.getContext("2d");

  const viewport = page.getViewport({ scale: 1.2 });
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  $("#pdf-page-info").textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
}

/* ================= FILE UPLOAD ================= */
const dropZone = $("#drop-zone");
const fileInput = $("#file-input");

dropZone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone?.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone?.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragging");
  handleFiles(e.dataTransfer.files);
});

fileInput?.addEventListener("change", () => {
  handleFiles(fileInput.files);
});

async function handleFiles(files) {
  if (!files?.length) return;

  const formData = new FormData();
  let firstFile = null;

  for (const file of files) {
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      formData.append("files", file);
      if (!firstFile) firstFile = file;
    }
  }

  if (!firstFile) {
    showToast("Please upload only PDF files.");
    return;
  }

  if (typeof pdfjsLib !== "undefined") {
    const fileURL = URL.createObjectURL(firstFile);
    pdfDoc = await pdfjsLib.getDocument(fileURL).promise;
    pdfCurrentPage = 1;
    show($("#pdf-preview-area"));
    renderPDFPage(1);
  }

  showLoading("Uploading paper...");

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    hideLoading();

    if (!data.papers) {
      showToast("Upload failed.");
      return;
    }

    for (const paper of data.papers) {
      if (paper.error) {
        showToast(paper.error);
        continue;
      }

      uploadedPapers.push(paper);
      activePaperId = paper.paper_id;

      addPaperToSidebar(paper);
      addPaperToSelects(paper);

      const user = auth.currentUser;
      if (user) {
        const paperRef = push(ref(db, `users/${user.uid}/papers`));
        await set(paperRef, paper);
      }
    }

    showToast("Paper uploaded successfully!");

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Backend connection failed.");
  }
}

/* ================= PAPER UI ================= */
function addPaperToSidebar(paper) {
  const list = $("#paper-list");
  if (!list) return;

  const chip = document.createElement("div");
  chip.className = "paper-chip";
  chip.innerHTML = `
    <div class="paper-chip-dot"></div>
    <div class="paper-chip-name">${paper.filename}</div>
  `;

  chip.onclick = () => {
    activePaperId = paper.paper_id;
    syncSelects(paper.paper_id);
  };

  list.appendChild(chip);
}

function addPaperToSelects(paper) {
  [
    "#chat-paper-select",
    "#summary-paper-select",
    "#simplify-paper-select",
    "#keywords-paper-select",
    "#sections-paper-select"
  ].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.insertAdjacentHTML(
      "beforeend",
      `<option value="${paper.paper_id}">${paper.filename}</option>`
    );
  });
}

function syncSelects(paperId) {
  [
    "#chat-paper-select",
    "#summary-paper-select",
    "#simplify-paper-select",
    "#keywords-paper-select",
    "#sections-paper-select"
  ].forEach(sel => {
    const el = $(sel);
    if (el) el.value = paperId;
  });
}

/* ================= SUMMARY ================= */
$("#btn-summarize")?.addEventListener("click", async () => {
  const paperId = $("#summary-paper-select").value;
  if (!paperId) return showToast("Select a paper.");

  showLoading("Generating summary...");

  const res = await fetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId })
  });

  const data = await res.json();
  hideLoading();

  if (data.error) return showToast(data.error);

  show($("#summary-output"));
  $("#summary-content").textContent = data.summary;
});

/* ================= SIMPLIFY ================= */
$("#btn-simplify")?.addEventListener("click", async () => {
  const paperId = $("#simplify-paper-select").value;
  if (!paperId) return showToast("Select a paper.");

  showLoading("Simplifying paper...");

  const res = await fetch(`${API_BASE}/simplify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paper_id: paperId,
      level: "beginner"
    })
  });

  const data = await res.json();
  hideLoading();

  if (data.error) return showToast(data.error);

  show($("#simplify-output"));
  $("#simplify-content").textContent = data.simplified;
});

/* ================= KEYWORDS ================= */
$("#btn-keywords")?.addEventListener("click", async () => {
  const paperId = $("#keywords-paper-select").value;
  if (!paperId) return showToast("Select a paper.");

  showLoading("Extracting keywords...");

  const res = await fetch(`${API_BASE}/keywords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId })
  });

  const data = await res.json();
  hideLoading();

  if (data.error) return showToast(data.error);

  const container = $("#keywords-cloud");
  container.innerHTML = "";

  data.keywords.forEach(kw => {
    const tag = document.createElement("span");
    tag.className = "keyword-tag";
    tag.textContent = kw;
    container.appendChild(tag);
  });

  show($("#keywords-output"));
});

/* ================= SECTIONS ================= */
$("#btn-sections")?.addEventListener("click", async () => {
  const paperId = $("#sections-paper-select").value;
  if (!paperId) return showToast("Select a paper.");

  showLoading("Detecting sections...");

  const res = await fetch(`${API_BASE}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId })
  });

  const data = await res.json();
  hideLoading();

  if (data.error) return showToast(data.error);

  const output = $("#sections-output");
  output.innerHTML = "";

  Object.entries(data.sections).forEach(([title, content]) => {
    output.innerHTML += `
      <div class="section-card">
        <h4>${title}</h4>
        <p>${content}</p>
      </div>
    `;
  });

  show(output);
});

/* ================= CHAT ================= */
window.setQuestion = function(btn) {
  $("#chat-input").value = btn.textContent.trim();
  sendChatMessage();
};

$("#btn-send")?.addEventListener("click", sendChatMessage);

$("#chat-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

function addChatBubble(text, role = "ai") {
  const box = $("#chat-messages");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `
    <div class="chat-avatar">${role === "user" ? "U" : "◎"}</div>
    <div class="chat-message-body">${text}</div>
  `;
  box.appendChild(bubble);
}

async function sendChatMessage() {
  const paperId = $("#chat-paper-select").value;
  const question = $("#chat-input").value.trim();

  if (!paperId) return showToast("Select a paper.");
  if (!question) return;

  addChatBubble(question, "user");
  $("#chat-input").value = "";

  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId, question })
  });

  const data = await res.json();

  if (data.error) {
    addChatBubble(data.error, "ai");
    return;
  }

  addChatBubble(data.answer.replace(/\n/g, "<br>"), "ai");
}

/* ================= FIREBASE RESTORE ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snapshot = await get(ref(db, `users/${user.uid}/papers`));

  if (!snapshot.exists()) return;

  const papers = Object.values(snapshot.val());

  uploadedPapers = [];

  papers.forEach(paper => {
    uploadedPapers.push(paper);
    addPaperToSidebar(paper);
    addPaperToSelects(paper);
    activePaperId = paper.paper_id;
  });
});
