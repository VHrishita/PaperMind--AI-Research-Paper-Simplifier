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

const API_BASE = "https://papermind-ai-research-paper-simplifier-2.onrender.com/api";

let uploadedPapers = [];
let activePaperId = null;
let pdfDoc = null;
let pdfCurrentPage = 1;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ================= HELPERS ================= */
function show(el) {
  if (el) el.classList.remove("hidden");
}

function hide(el) {
  if (el) el.classList.add("hidden");
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

    const title = btn.textContent.trim().replace(/\s+/g, " ");
    $("#topbar-title").textContent = title;
  });
});

/* ================= PDF PREVIEW ================= */
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

async function renderPDFPage(pageNum) {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageNum);
  const canvas = $("#pdf-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const viewport = page.getViewport({ scale: 1.2 });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

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
    showToast("Please upload PDF only");
    return;
  }

  // preview first pdf
  if (typeof pdfjsLib !== "undefined") {
    const fileURL = URL.createObjectURL(firstFile);
    pdfDoc = await pdfjsLib.getDocument(fileURL).promise;
    pdfCurrentPage = 1;
    show($("#pdf-preview-area"));
    renderPDFPage(1);
  }

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    console.log("UPLOAD RESPONSE:", data);

    if (!data.papers || !Array.isArray(data.papers)) {
      showToast("Invalid upload response");
      return;
    }

    for (const paper of data.papers) {
      if (!paper || paper.error) {
        showToast(paper?.error || "Upload failed");
        continue;
      }

      const safePaper = {
        paper_id: paper.paper_id,
        filename: paper.filename || "Untitled.pdf",
        word_count: paper.word_count || 0
      };

      const alreadyExists = uploadedPapers.some(
        p => p.paper_id === safePaper.paper_id
      );

      if (!alreadyExists) {
        uploadedPapers.push(safePaper);
        addPaperToSidebar(safePaper);
        addPaperToSelects(safePaper);
      }

      activePaperId = safePaper.paper_id;
      syncSelects(safePaper.paper_id);
    }

    showToast("Paper uploaded successfully");
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    showToast("Backend connection failed");
  }
}

/* ================= PAPER UI ================= */
function addPaperToSidebar(paper) {
  const list = $("#paper-list");
  if (!list) return;

  const emptyHint = list.querySelector(".empty-hint");
  if (emptyHint) emptyHint.remove();

  const exists = [...list.querySelectorAll(".paper-chip")]
    .some(chip => chip.dataset.paperId === paper.paper_id);

  if (exists) return;

  const chip = document.createElement("div");
  chip.className = "paper-chip";
  chip.dataset.paperId = paper.paper_id;

  chip.innerHTML = `
    <div class="paper-chip-dot"></div>
    <div class="paper-chip-name">${paper.filename}</div>
  `;

  chip.addEventListener("click", () => {
    activePaperId = paper.paper_id;
    syncSelects(paper.paper_id);
    showToast(`Selected ${paper.filename}`);
  });

  list.appendChild(chip);
}

function addPaperToSelects(paper) {
  const selectors = [
    "#chat-paper-select",
    "#summary-paper-select",
    "#simplify-paper-select",
    "#keywords-paper-select",
    "#sections-paper-select",
    "#w2v-paper-select"
  ];

  selectors.forEach(sel => {
    const el = $(sel);
    if (!el) return;

    const exists = [...el.options]
      .some(opt => opt.value === paper.paper_id);

    if (!exists) {
      const option = document.createElement("option");
      option.value = paper.paper_id;
      option.textContent = paper.filename;
      el.appendChild(option);
    }
  });
}

function syncSelects(paperId) {
  [
    "#chat-paper-select",
    "#summary-paper-select",
    "#simplify-paper-select",
    "#keywords-paper-select",
    "#sections-paper-select",
    "#w2v-paper-select"
  ].forEach(sel => {
    const el = $(sel);
    if (el) el.value = paperId;
  });
}

/* ================= SUMMARY ================= */
$$(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

$("#btn-summarize")?.addEventListener("click", async () => {
  const paperId = $("#summary-paper-select").value;
  if (!paperId) return showToast("Select a paper");

  const mode =
    $(".mode-btn.active")?.dataset.mode || "short";

  const res = await fetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId, mode })
  });

  const data = await res.json();

  if (data.error) return showToast(data.error);

  $("#summary-content").textContent = data.summary;
  show($("#summary-output"));
});

/* ================= SIMPLIFY ================= */
$("#btn-simplify")?.addEventListener("click", async () => {
  const paperId = $("#simplify-paper-select").value;
  if (!paperId) return showToast("Select a paper");

  const level =
    document.querySelector('input[name="simplify-level"]:checked')?.value ||
    "beginner";

  const res = await fetch(`${API_BASE}/simplify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId, level })
  });

  const data = await res.json();

  if (data.error) return showToast(data.error);

  $("#simplify-content").textContent = data.simplified;
  show($("#simplify-output"));
});

/* ================= KEYWORDS ================= */
$("#btn-keywords")?.addEventListener("click", async () => {
  const paperId = $("#keywords-paper-select").value;
  if (!paperId) return showToast("Select a paper");

  const res = await fetch(`${API_BASE}/keywords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId })
  });

  const data = await res.json();

  if (data.error) return showToast(data.error);

  const cloud = $("#keywords-cloud");
  cloud.innerHTML = "";

  data.keywords.forEach(word => {
    const tag = document.createElement("span");
    tag.className = "keyword-tag";
    tag.textContent = word;
    cloud.appendChild(tag);
  });

  show($("#keywords-output"));
});

/* ================= SECTIONS ================= */
$("#btn-sections")?.addEventListener("click", async () => {
  const paperId = $("#sections-paper-select").value;
  if (!paperId) return showToast("Select a paper");

  const res = await fetch(`${API_BASE}/sections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId })
  });

  const data = await res.json();

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

async function sendChatMessage() {
  const paperId = $("#chat-paper-select").value;
  const question = $("#chat-input").value.trim();

  if (!paperId) return showToast("Select a paper");
  if (!question) return;

  const box = $("#chat-messages");
  box.innerHTML += `<p><b>You:</b> ${question}</p>`;
  $("#chat-input").value = "";

  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paper_id: paperId, question })
  });

  const data = await res.json();
  box.innerHTML += `<p><b>AI:</b> ${data.answer || data.error}</p>`;
  box.scrollTop = box.scrollHeight;
}

/* ================= FIREBASE RESTORE ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const snapshot = await get(ref(db, `users/${user.uid}/papers`));
  if (!snapshot.exists()) return;

  const papers = Object.values(snapshot.val());

  papers.forEach(paper => {
    const safePaper = {
      paper_id: paper.paper_id,
      filename: paper.filename || "Untitled.pdf"
    };

    const exists = uploadedPapers.some(
      p => p.paper_id === safePaper.paper_id
    );

    if (!exists) {
      uploadedPapers.push(safePaper);
      addPaperToSidebar(safePaper);
      addPaperToSelects(safePaper);
    }
  });

  if (papers.length > 0) {
    activePaperId = papers[0].paper_id;
    syncSelects(activePaperId);
  }
});
