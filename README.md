# 📄 PaperMind - AI Research Paper Simplifier

PaperMind is an AI-powered web application that helps students, researchers, and developers **upload, analyze, simplify, and interact with research papers**.

It supports:

* 📤 PDF upload and preview
* 💬 Chat with paper
* 📝 Smart summarization
* ✨ Simplification into plain English
* 🔍 Keyword extraction
* 🧩 Section detection
* 📊 Paper comparison
* 🌐 Topic cluster visualization
* 🧠 Word2Vec concept explorer
* 🔐 Firebase authentication
* ☁️ Cloud deployment with Vercel + Render

---

# 🚀 Live Architecture

* **Frontend:** Vercel
* **Backend:** Render (Flask)
* **Authentication:** Firebase
* **Storage:** Firebase Realtime Database

---

# 📁 Project Structure

```bash
PaperMind_AI/
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── script.js
│   ├── style.css
│   ├── auth.css
│   ├── firebase-config.js
│   └── logo.png
│
├── backend/
│   ├── app.py
│   ├── summarizer.py
│   ├── qa_engine.py
│   ├── compare.py
│   ├── visualizer.py
│   ├── utils.py
│   └── requirements.txt
│
└── .gitignore
```

---

# ⚙️ Local Setup

## 1) Clone Repo

```bash
git clone https://github.com/VHrishita/PaperMind--AI-Research-Paper-Simplifier.git
cd PaperMind--AI-Research-Paper-Simplifier
```

## 2) Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Backend runs on:

```bash
http://localhost:5000
```

## 3) Frontend Setup

Open:

```bash
frontend/login.html
```

> ✅ The **login page is the first page** of the app.

---

# 🔐 Important Login-First Flow

The app should always open on:

```text
/frontend/login.html
```

After successful login:

```text
→ redirect to index.html
```

Your current login flow is correct:

```javascript
window.location.href = "index.html";
```

---

# 🌍 Frontend Deployment on Vercel

## ✅ IMPORTANT: first page must be login page

Because Vercel serves `index.html` as default, we make **index redirect to login**.

## ✅ Option A (BEST): rename pages

Inside `frontend/`:

### Rename:

```bash
login.html → index.html
index.html → app.html
```

Then update `frontend/login.js`:

```javascript
window.location.href = "app.html";
```

This guarantees:

* site opens on login page first ✅
* after login goes to main PaperMind app ✅

---

## 🚀 Deploy Steps

1. Go to **Vercel**
2. Click **New Project**
3. Import GitHub repo
4. Set:

   * **Framework:** Other
   * **Root Directory:** `frontend`
5. Deploy

Your frontend goes live instantly.

---

# 🧠 Backend Deployment on Render

## 🚀 Steps

1. Go to **Render**
2. Click **New Web Service**
3. Connect GitHub repo
4. Choose repo
5. Configure:

### Root directory

```text
backend
```

### Build command

```bash
pip install -r requirements.txt
```

### Start command

```bash
python app.py
```

### Runtime

```text
Python 3
```

Deploy.

---

# 🔗 Connect Frontend to Render Backend

After backend deploys, Render gives URL like:

```text
https://papermind-backend.onrender.com
```

Update `frontend/script.js`:

```javascript
const API_BASE = "https://papermind-backend.onrender.com/api";
```

Commit + push.

Vercel auto redeploys.

---

# 🔥 Production Notes

## CORS in Flask

In `backend/app.py` ensure:

```python
from flask_cors import CORS
CORS(app)
```

---

## Render Port Fix

In `backend/app.py` use:

```python
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
```

---

# 🎯 Resume-Ready Impact

PaperMind demonstrates:

* full-stack development
* AI/NLP workflows
* PDF processing
* vector semantics
* Firebase auth
* data visualization
* cloud deployment

Perfect for:

* hackathons
* internships
* research tooling portfolios
* AI product showcases

---

# 👩‍💻 Author

**Vempali Hrishita**

Built using Flask, JavaScript, Firebase, Vercel, and Render.
