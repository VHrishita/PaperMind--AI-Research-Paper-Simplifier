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
 */

const API_BASE = "https://papermind-ai-research-paper-simplifier-2.onrender.com/api";

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

// ===================== MISSING ANALYSIS FEATURES =====================

// ── CHAT / ASK PAPER ────────────────────────────────────────────────
$("#btn-ask")?.addEventListener("click", async () => {
  const paperId = $("#chat-paper-select")?.value;
  const question = $("#chat-input")?.value?.trim();

  if (!paperId) return showToast("Select a paper first.");
  if (!question) return showToast("Ask something first.");

  showLoading("Thinking...");

  try {
    const res = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_id: paperId,
        question
      })
    });

    const data = await res.json();
    hideLoading();

    $("#chat-output").textContent = data.answer || "No answer found.";
    show($("#chat-result"));
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Chat failed.");
  }
});

// ── SIMPLIFY ────────────────────────────────────────────────────────
$("#btn-simplify")?.addEventListener("click", async () => {
  const paperId = $("#simplify-paper-select")?.value;
  const level = $("#simplify-level")?.value || "beginner";

  if (!paperId) return showToast("Select a paper first.");

  showLoading("Simplifying...");

  try {
    const res = await fetch(`${API_BASE}/simplify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_id: paperId,
        level
      })
    });

    const data = await res.json();
    hideLoading();

    $("#simplify-output").textContent =
      data.simplified || "No simplified text.";
    show($("#simplify-result"));
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Simplify failed.");
  }
});

// ── KEYWORDS ────────────────────────────────────────────────────────
$("#btn-keywords")?.addEventListener("click", async () => {
  const paperId = $("#keywords-paper-select")?.value;
  if (!paperId) return showToast("Select a paper first.");

  showLoading("Extracting keywords...");

  try {
    const res = await fetch(`${API_BASE}/keywords`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_id: paperId
      })
    });

    const data = await res.json();
    hideLoading();

    $("#keywords-output").innerHTML = (data.keywords || [])
      .map(k => `<span class="keyword-chip">${k}</span>`)
      .join(" ");

    show($("#keywords-result"));
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Keyword extraction failed.");
  }
});

// ── SECTIONS ────────────────────────────────────────────────────────
$("#btn-sections")?.addEventListener("click", async () => {
  const paperId = $("#sections-paper-select")?.value;
  if (!paperId) return showToast("Select a paper first.");

  showLoading("Detecting sections...");

  try {
    const res = await fetch(`${API_BASE}/sections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_id: paperId
      })
    });

    const data = await res.json();
    hideLoading();

    const sections = data.sections || {};
    let html = "";

    Object.entries(sections).forEach(([title, content]) => {
      html += `
        <div class="section-card">
          <h4>${title}</h4>
          <p>${content}</p>
        </div>
      `;
    });

    $("#sections-output").innerHTML = html;
    show($("#sections-result"));
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Sections failed.");
  }
});

// ── COMPARE PAPERS ──────────────────────────────────────────────────
$("#btn-compare")?.addEventListener("click", async () => {
  const checked = [
    ...document.querySelectorAll("#compare-paper-checkboxes input:checked")
  ].map(el => el.value);

  if (checked.length < 2) {
    return showToast("Select at least 2 papers.");
  }

  showLoading("Comparing papers...");

  try {
    const res = await fetch(`${API_BASE}/compare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_ids: checked
      })
    });

    const data = await res.json();
    hideLoading();

    let html = "";

    (data.comparison || []).forEach(item => {
      html += `
        <div class="compare-card">
          <h3>${item.title}</h3>
          <p><b>Objective:</b> ${item.objective}</p>
          <p><b>Methodology:</b> ${item.methodology}</p>
          <p><b>Results:</b> ${item.results}</p>
          <p><b>Conclusion:</b> ${item.conclusion}</p>
        </div>
      `;
    });

    $("#compare-output").innerHTML = html;
    show($("#compare-result"));
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Comparison failed.");
  }
});

// ── WORD2VEC / RELATED TERMS ────────────────────────────────────────
$("#btn-w2v")?.addEventListener("click", async () => {
  const paperId = $("#w2v-paper-select")?.value;
  const term = $("#w2v-term")?.value?.trim();

  if (!paperId) return showToast("Select a paper.");
  if (!term) return showToast("Enter a term.");

  showLoading("Finding related terms...");

  try {
    const res = await fetch(`${API_BASE}/word2vec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_id: paperId,
        term
      })
    });

    const data = await res.json();
    hideLoading();

    $("#w2v-output").innerHTML = (data.related_terms || [])
      .map(item => `<div>${item.term} (${item.score})</div>`)
      .join("");

    show($("#w2v-result"));
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Word2Vec failed.");
  }
});

// ── VISUALIZE ───────────────────────────────────────────────────────
$("#btn-visualize")?.addEventListener("click", async () => {
  const checked = [
    ...document.querySelectorAll("#compare-paper-checkboxes input:checked")
  ].map(el => el.value);

  if (checked.length < 1) {
    return showToast("Select papers to visualize.");
  }

  showLoading("Generating chart...");

  try {
    const res = await fetch(`${API_BASE}/visualize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_ids: checked
      })
    });

    const data = await res.json();
    hideLoading();

    console.log("Visualization data:", data);
    showToast("Visualization data ready ✅");
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Visualization failed.");
  }
});

// ── EXPORT REPORT ───────────────────────────────────────────────────
$("#btn-export")?.addEventListener("click", async () => {
  const paperId = activePaperId || $("#summary-paper-select")?.value;
  if (!paperId) return showToast("Select a paper first.");

  showLoading("Preparing export...");

  try {
    const res = await fetch(`${API_BASE}/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        paper_id: paperId
      })
    });

    const blob = await res.blob();
    hideLoading();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paper_report.txt";
    a.click();

    showToast("Export downloaded ✅");
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Export failed.");
  }
});
