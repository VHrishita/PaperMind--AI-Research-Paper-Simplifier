# PaperMind — Complete Setup Guide
## AI Research Paper Simplifier (100% Offline, No External APIs)

---

## 📁 Project Folder Structure

```
papermind/
│
├── backend/                   ← Python Flask backend
│   ├── app.py                 ← Main Flask server (all API routes)
│   ├── summarizer.py          ← TF-IDF + TextRank summarization
│   ├── qa_engine.py           ← Semantic Q&A with cosine similarity
│   ├── compare.py             ← Multi-paper comparison logic
│   ├── visualizer.py          ← PCA topic graph + Word2Vec explorer
│   ├── utils.py               ← PDF extraction, simplification, export
│   ├── requirements.txt       ← All Python dependencies
│   ├── uploads/               ← Auto-created: PDF files stored here
│   └── exports/               ← Auto-created: exported reports saved here
│
└── frontend/                  ← HTML/CSS/JS frontend
    ├── index.html             ← Main webpage (single-page app)
    ├── style.css              ← Premium dark glassmorphism theme
    └── script.js              ← All frontend logic & API calls
```

---

## ⚙️ Phase 1: Installation

### Step 1 — Install Python 3.10+

Download from: https://www.python.org/downloads/
During install, check ✅ "Add Python to PATH"

Verify:
```bash
python --version
```

### Step 2 — Install VS Code Extensions

Install these from the Extensions tab (Ctrl+Shift+X):
- **Python** (by Microsoft)
- **Pylance** (by Microsoft)
- **Live Server** (by Ritwick Dey) ← for frontend
- **REST Client** (optional, for testing APIs)

### Step 3 — Create a Virtual Environment

```bash
# Open VS Code terminal (Ctrl + `)
# Navigate to backend folder
cd papermind/backend

# Create virtual environment
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Activate it (Mac/Linux)
source venv/bin/activate
```

You'll see `(venv)` appear in the terminal.

### Step 4 — Install Python Dependencies

With venv activated:
```bash
pip install -r requirements.txt
```

This installs (takes 5–10 minutes first time):
- **flask** — Web server framework
- **flask-cors** — Allow frontend to talk to backend
- **pymupdf** — Fast PDF text extraction
- **pdfminer.six** — Fallback PDF extractor
- **pypdf** — Second fallback PDF extractor
- **nltk** — Natural language toolkit
- **scikit-learn** — TF-IDF, PCA vectorization
- **numpy** — Matrix math
- **gensim** — Word2Vec semantic model
- **sentence-transformers** — SBERT (best semantic Q&A)
- **reportlab** — PDF report generation
- **werkzeug** — Flask utilities

### Step 5 — Download NLTK Data

Run in terminal (once):
```bash
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"
```

---

## 🚀 Phase 5: Running the Project in VS Code

### Start the Backend

```bash
# Make sure you're in papermind/backend/
# And venv is activated (see Step 3)

python app.py
```

You should see:
```
==================================================
  PaperMind Backend Starting...
  Visit: http://localhost:5000
==================================================
 * Running on http://127.0.0.1:5000
```

### Start the Frontend

**Option A — Live Server (Recommended)**
1. Right-click `index.html` in VS Code file explorer
2. Click "Open with Live Server"
3. Browser opens at `http://127.0.0.1:5500`

**Option B — Direct File**
Just double-click `frontend/index.html` to open in browser.

Both options work! The frontend calls the backend at `http://localhost:5000`.

---

## 🔗 How Frontend Connects to Backend

The frontend (HTML/JS) and backend (Flask) are separate:

```
User uploads PDF
       ↓
frontend/script.js
calls: fetch("http://localhost:5000/api/upload", { method: "POST", body: formData })
       ↓
backend/app.py receives the file
       ↓
utils.py extracts text using PyMuPDF
       ↓
JSON response sent back to frontend
       ↓
frontend displays results
```

All API endpoints are defined in `app.py`:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/upload` | POST | Upload PDF(s) |
| `/api/summarize` | POST | Summarize paper |
| `/api/simplify` | POST | Simplify language |
| `/api/keywords` | POST | Extract keywords |
| `/api/sections` | POST | Detect sections |
| `/api/ask` | POST | Chat Q&A |
| `/api/compare` | POST | Compare papers |
| `/api/visualize` | POST | Topic graph |
| `/api/word2vec` | POST | Concept explorer |
| `/api/export` | POST | Download report |

---

## 🎯 How to Use Each Feature

1. **Upload**: Go to "Upload Papers" panel. Drag & drop PDF files.

2. **Chat**: Click "Chat with Paper". Select a paper. Ask natural questions like:
   - "What is the main objective?"
   - "What dataset was used?"
   - "Explain the methodology"

3. **Summarize**: Choose paragraph/bullets/one-liner mode. Click Summarize.

4. **Simplify**: Pick a level (Beginner/Student/Viva). Click Simplify.

5. **Keywords**: Extracts top 15 keywords with colored tags.

6. **Sections**: Auto-detects Abstract, Methods, Results, Conclusion etc.

7. **Compare**: Upload 2+ papers. Check both boxes. Click Compare.

8. **Topic Graph**: PCA scatter plot of topic clusters. Upload multiple papers for best results.

9. **Concept Explorer**: Type a term (e.g., "robot"). See semantically related terms.

10. **Export**: Click "↓ Export Report" in top right for PDF download.

---

## 🔬 How the AI Features Work (No API)

### Summarization
- Splits paper into sentences
- Computes TF-IDF score for each word
- Runs TextRank (sentence graph similarity)
- Combines both scores and picks top sentences

### Q&A (Chat)
- First tries Sentence-BERT (all-MiniLM-L6-v2) — best quality
- Falls back to TF-IDF cosine similarity if BERT unavailable
- Intent detection (methodology/dataset/conclusion etc.)
- Returns top-5 most similar sentences as the answer

### Keywords
- TF-IDF vectorization (finds statistically important terms)
- RAKE algorithm (phrase extraction by stopword splitting)
- Combined and deduplicated

### Simplification
- Dictionary-based jargon replacement (50+ terms)
- Sentence length reduction via conjunction splitting
- Three levels: Beginner / Student / Viva

### Word2Vec
- Trains Gensim Word2Vec on the paper text itself
- Finds cosine-similar words in learned vector space
- Falls back to co-occurrence analysis if Gensim unavailable

### Topic Visualization
- Chunks paper text into 200-word segments
- TF-IDF vectorizes each chunk (200 features)
- PCA reduces to 2D coordinates
- Chart.js renders scatter plot

---

## 🔮 Phase 6: Future Enhancements (Resume-Worthy)

| Feature | Technology | Impact |
|---------|-----------|--------|
| Full BERT extractive QA | HuggingFace transformers (local) | ⭐⭐⭐⭐⭐ |
| Citation graph extraction | regex + networkx | ⭐⭐⭐⭐ |
| Multi-language support | langdetect + mBART | ⭐⭐⭐⭐ |
| Persistent chat history | SQLite / JSON file | ⭐⭐⭐ |
| Paper recommendation | cosine similarity across stored papers | ⭐⭐⭐⭐ |
| OCR for scanned PDFs | pytesseract | ⭐⭐⭐⭐ |
| Named entity recognition | spaCy NER | ⭐⭐⭐⭐ |
| Timeline of research | matplotlib + date extraction | ⭐⭐⭐ |
| Voice Q&A | SpeechRecognition + pyttsx3 | ⭐⭐⭐ |
| Docker deployment | Docker + docker-compose | ⭐⭐⭐⭐⭐ |

---

## ❓ Troubleshooting

**"Cannot connect to backend"**
→ Make sure Flask is running: `python app.py` in `backend/` folder with venv active.

**"Could not extract text from PDF"**
→ Try: `pip install pymupdf` (PyMuPDF)
→ Some PDFs are image-only (scanned). Need OCR: `pip install pytesseract`

**sentence-transformers takes too long**
→ It downloads the model (~90MB) on first use. Wait, or uninstall and use TF-IDF fallback.

**Port 5000 already in use**
→ Change `port=5000` to `port=5001` in `app.py` and update `API_BASE` in `script.js`.

**Chart not showing**
→ Upload at least 1 paper with substantial text (>500 words).

---

## 📌 Project Info

- **All AI runs locally** — zero external API calls
- **No internet needed** after initial setup (model download)
- **Demo-ready** — designed for hackathons and project presentations
- **Beginner-friendly** — all code is commented
