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
 * PaperMind — FULL FIXED Frontend Script
 * Includes deployment-safe backend URL + proper sidebar/select restore fixes.
 */

// ── DEPLOYMENT SAFE API BASE ───────────────────────────────────────────────
const API_BASE = window.location.hostname.includes("onrender.com")
  ? `${window.location.origin}/api`
  : "http://localhost:5000/api";
// ── STATE ──────────────────────────────────────────────────────────────────
let uploadedPapers = [];
let activePaperId = null;
let topicChart = null;
let pdfDoc = null;
let pdfCurrentPage = 1;

// ── HELPERS ────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el) { el?.classList.remove("hidden"); }
function hide(el) { el?.classList.add("hidden"); }

function showLoading(text = "Processing...") {
  $("#loading-text").textContent = text;
  show($("#loading-overlay"));
}
function hideLoading() { hide($("#loading-overlay")); }

function showToast(msg, duration = 3000) {
  const toast = $("#toast");
  toast.textContent = msg;
  show(toast);
  setTimeout(() => hide(toast), duration);
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

function selectPaper(paperId) {
  activePaperId = paperId;
  syncSelects(paperId);

  $$(".paper-chip").forEach(chip => {
    chip.classList.toggle("selected", chip.dataset.id === paperId);
  });
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
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
  $("#sidebar")?.classList.toggle("open");
});

// ── PDF PREVIEW ────────────────────────────────────────────────────────────
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

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const info = $("#pdf-page-info");
  if (info) info.textContent = `Page ${pdfCurrentPage} of ${pdfDoc.numPages}`;
}

// ── PAPER UI HELPERS ───────────────────────────────────────────────────────
function addPaperToSidebar(paper) {
  const list = $("#paper-list");
  if (!list) return;

  const existing = list.querySelector(`[data-id="${paper.paper_id}"]`);
  if (existing) return;

  const emptyHint = list.querySelector(".empty-hint");
  if (emptyHint) emptyHint.remove();

  const chip = document.createElement("div");
  chip.className = "paper-chip";
  chip.dataset.id = paper.paper_id;
  chip.innerHTML = `
    <div class="paper-chip-dot"></div>
    <div class="paper-chip-name" title="${paper.filename}">${paper.filename}</div>
  `;

  chip.addEventListener("click", () => selectPaper(paper.paper_id));
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

    const exists = [...el.options].some(opt => opt.value === paper.paper_id);
    if (!exists) {
      el.insertAdjacentHTML(
        "beforeend",
        `<option value="${paper.paper_id}">${paper.filename}</option>`
      );
    }
  });

  const checkboxGroup = $("#compare-paper-checkboxes");
  if (!checkboxGroup) return;

  const already = checkboxGroup.querySelector(`input[value="${paper.paper_id}"]`);
  if (already) return;

  checkboxGroup.insertAdjacentHTML("beforeend", `
    <label class="paper-checkbox-label">
      <input type="checkbox" value="${paper.paper_id}" />
      ${paper.filename}
    </label>
  `);
}

// ── UPLOAD ─────────────────────────────────────────────────────────────────
const fileInput = $("#file-input");
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

  if (!firstFile) return showToast("Please select PDF files only.");

  // instant preview
  if (typeof pdfjsLib !== "undefined") {
    const fileURL = URL.createObjectURL(firstFile);
    pdfDoc = await pdfjsLib.getDocument(fileURL).promise;
    pdfCurrentPage = 1;
    show($("#pdf-preview-area"));
    renderPDFPage(1);
  }

  showLoading("Uploading PDF...");

  try {
    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    hideLoading();

    if (!data.papers?.length) {
      return showToast("Upload failed.");
    }

    for (const paper of data.papers) {
      if (!uploadedPapers.some(p => p.paper_id === paper.paper_id)) {
        uploadedPapers.push(paper);
      }

      addPaperToSidebar(paper);
      addPaperToSelects(paper);
      selectPaper(paper.paper_id);

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

    showToast("Paper uploaded and visible now ✅");

  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Backend connection failed.");
  }
}

// ── SUMMARIZE FIX ───────────────────────────────────────────────────────────
$("#btn-summarize")?.addEventListener("click", async () => {
  const paperId = $("#summary-paper-select")?.value;
  if (!paperId) return showToast("Please select a paper first.");

  showLoading("Generating summary...");

  try {
    const res = await fetch(`${API_BASE}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paper_id: paperId, mode: "short" })
    });

    const data = await res.json();
    hideLoading();

    $("#summary-content").textContent = data.summary || "No summary generated.";
    show($("#summary-output"));

  } catch (err) {
    hideLoading();
    showToast("Summary failed.");
  }
});

// ── SINGLE CLEAN FIREBASE RESTORE (IMPORTANT FIX) ──────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const snapshot = await get(ref(db, `users/${user.uid}/papers`));

    uploadedPapers = [];
    $("#paper-list").innerHTML = "";
    $("#compare-paper-checkboxes").innerHTML = "";

    [
      "#chat-paper-select",
      "#summary-paper-select",
      "#simplify-paper-select",
      "#keywords-paper-select",
      "#sections-paper-select",
      "#w2v-paper-select"
    ].forEach(sel => {
      const el = $(sel);
      if (el) el.innerHTML = `<option value="">— Select a paper —</option>`;
    });

    if (snapshot.exists()) {
      const papers = Object.values(snapshot.val());

      papers.forEach(paper => {
        if (!uploadedPapers.some(p => p.paper_id === paper.paper_id)) {
          uploadedPapers.push(paper);
        }

        addPaperToSidebar(paper);
        addPaperToSelects(paper);
      });

      if (uploadedPapers.length) {
        selectPaper(uploadedPapers[0].paper_id);
      }
    }

    console.log("Papers restored successfully");
  } catch (err) {
    console.error("Restore failed:", err);
  }
});
