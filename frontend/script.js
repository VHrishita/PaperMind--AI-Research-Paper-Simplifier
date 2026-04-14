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

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
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

    el.innerHTML += `<option value="${paper.paper_id}">${paper.filename}</option>`;
  });
}

async function handleFiles(files) {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  try {
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.papers) {
      showToast("Upload failed");
      return;
    }

    data.papers.forEach(paper => {
      if (paper.error) {
        showToast(paper.error);
        return;
      }

      uploadedPapers.push(paper);
      activePaperId = paper.paper_id;
      addPaperToSelects(paper);
    });

    showToast("PDF uploaded successfully");
  } catch (err) {
    console.error(err);
    showToast("Upload failed");
  }
}

$("#file-input")?.addEventListener("change", e => {
  handleFiles(e.target.files);
});

$("#btn-summarize")?.addEventListener("click", async () => {
  const paperId = $("#summary-paper-select").value;

  const res = await fetch(`${API_BASE}/summarize`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ paper_id: paperId })
  });

  const data = await res.json();
  $("#summary-content").textContent = data.summary;
  $("#summary-output").classList.remove("hidden");
});

$("#btn-simplify")?.addEventListener("click", async () => {
  const paperId = $("#simplify-paper-select").value;

  const res = await fetch(`${API_BASE}/simplify`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ paper_id: paperId, level:"beginner" })
  });

  const data = await res.json();
  $("#simplify-content").textContent = data.simplified;
  $("#simplify-output").classList.remove("hidden");
});

window.setQuestion = function(btn) {
  $("#chat-input").value = btn.textContent.trim();
};

$("#btn-send")?.addEventListener("click", async () => {
  const paperId = $("#chat-paper-select").value;
  const question = $("#chat-input").value;

  const res = await fetch(`${API_BASE}/ask`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ paper_id: paperId, question })
  });

  const data = await res.json();
  $("#chat-messages").innerHTML += `<p><b>You:</b> ${question}</p>`;
  $("#chat-messages").innerHTML += `<p><b>AI:</b> ${data.answer}</p>`;
});
