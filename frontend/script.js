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
 * PaperMind — Frontend Script
 * FINAL Production Ready Version
 */

// ================= CONFIG =================
const API_BASE = "https://papermind-ai-research-paper-simplifier-2.onrender.com/api";

// ================= STATE =================
let uploadedPapers = [];
let activePaperId = null;
let pdfDoc = null;
let pdfCurrentPage = 1;

// ================= HELPERS =================
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
  toast.textContent = msg;
  show(toast);
  setTimeout(() => hide(toast), duration);
}

// ================= NAVIGATION =================
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

$("#hamburger")?.addEventListener("click", () => {
  $("#sidebar").classList.toggle("open");
});

// ================= PDF PREVIEW =================
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

$("#pdf-prev")?.addEventListener("click", () => {
  if (pdfCurrentPage > 1) {
    pdfCurrentPage--;
    renderPDFPage(pdfCurrentPage);
  }
});

$("#pdf-next")?.addEventListener("click", () => {
  if (pdfDoc && pdfCurrentPage < pdfDoc.numPages) {
    pdfCurrentPage++;
    renderPDFPage(pdfCurrentPage);
  }
});

// ================= FILE UPLOAD =================
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

fileInput?.addEventListener("change", () => handleFiles(fileInput.files));

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
    showToast("Please upload PDF files only.");
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

    const statusContainer = $("#upload-status");
    show(statusContainer);

    for (const paper of data.papers) {
      if (paper.error) {
        showToast(paper.error);
        continue;
      }

      uploadedPapers.push(paper);
      activePaperId = paper.paper_id;

      addPaperToSidebar(paper);
      addPaperToSelects(paper);

      statusContainer.insertAdjacentHTML("beforeend", `
        <div class="upload-item success">
          <span class="upload-item-icon">✓</span>
          <div class="upload-item-info">
            <div class="upload-item-name">${paper.filename}</div>
            <div class="upload-item-meta">${paper.word_count.toLocaleString()} words</div>
          </div>
        </div>
      `);

      const user = auth.currentUser;
      if (user) {
        const paperRef = push(ref(db, `users/${user.uid}/papers`));
        await set(paperRef, {
          filename: paper.filename,
          paper_id: paper.paper_id,
          word_count: paper.word_count,
          uploadedAt: new Date().toISOString()
        });
      }
    }

    showToast("Paper uploaded successfully!");

  } catch (err) {
    hideLoading();
    showToast("Backend connection failed.");
    console.error(err);
  }
}

// ================= PAPER UI =================
function addPaperToSidebar(paper) {
  const list = $("#paper-list");
  const chip = document.createElement("div");

  chip.className = "paper-chip";
  chip.innerHTML = `
    <div class="paper-chip-dot"></div>
    <div class="paper-chip-name">${paper.filename}</div>
  `;

  chip.addEventListener("click", () => {
    activePaperId = paper.paper_id;
    syncSelects(paper.paper_id);
  });

  list.appendChild(chip);
}

function addPaperToSelects(paper) {
  const selectors = [
    "#chat-paper-select",
    "#summary-paper-select",
    "#simplify-paper-select",
    "#keywords-paper-select",
    "#sections-paper-select"
  ];

  selectors.forEach(sel => {
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

// ================= SUMMARY =================
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

// ================= CHAT =================
$("#btn-send")?.addEventListener("click", sendChatMessage);

$("#chat-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

function addChatBubble(text, role = "ai") {
  const messagesEl = $("#chat-messages");

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `
    <div class="chat-avatar">${role === "user" ? "U" : "◎"}</div>
    <div class="chat-message-body">${text}</div>
  `;

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendChatMessage() {
  const paperId = $("#chat-paper-select").value;
  const question = $("#chat-input").value.trim();

  if (!paperId) return showToast("Select a paper.");
  if (!question) return;

  addChatBubble(question, "user");
  $("#chat-input").value = "";

  try {
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

    const user = auth.currentUser;
    if (user) {
      const chatRef = push(ref(db, `users/${user.uid}/history/chat`));
      await set(chatRef, {
        paper_id: paperId,
        question,
        answer: data.answer,
        timestamp: new Date().toISOString()
      });
    }

  } catch (err) {
    addChatBubble("Cannot connect to backend.", "ai");
  }
}

// ================= RESTORE FIREBASE =================
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const papersSnapshot = await get(ref(db, `users/${user.uid}/papers`));

  if (papersSnapshot.exists()) {
    const papers = Object.values(papersSnapshot.val());

    uploadedPapers = [];

    papers.forEach(paper => {
      uploadedPapers.push(paper);
      addPaperToSidebar(paper);
      addPaperToSelects(paper);
      activePaperId = paper.paper_id;
    });
  }

  const chatSnapshot = await get(ref(db, `users/${user.uid}/history/chat`));

  if (chatSnapshot.exists()) {
    const chats = Object.values(chatSnapshot.val());

    chats
      .filter(chat => chat.paper_id === activePaperId)
      .forEach(chat => {
        addChatBubble(chat.question, "user");
        addChatBubble(chat.answer, "ai");
      });
  }
});
