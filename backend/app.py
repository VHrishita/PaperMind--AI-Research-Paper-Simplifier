"""
PaperMind - Main Flask Application
Entry point for all API endpoints
"""

import os
import json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import traceback

from backend.summarizer import summarize_text, extract_key_points, one_line_summary
from backend.qa_engine import answer_question, build_index
from backend.compare import compare_papers
from backend.utils import (
    extract_text_from_pdf,
    detect_sections,
    extract_keywords,
    simplify_text,
    export_report_pdf
)

# ── App Setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from frontend

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.expanduser("~"), "PaperMind_Uploads")
ALLOWED_EXTENSIONS = {"pdf"}
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs("exports", exist_ok=True)

# In-memory store for uploaded paper data (reset on server restart)
paper_store = {}  # { paper_id: { text, filename, sections, keywords } }


def allowed_file(filename):
    """Check if file extension is allowed"""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "PaperMind backend is live 🚀",
        "health": "/api/health",
        "upload": "/api/upload"
    })
    
@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "PaperMind backend is running"})


@app.route("/api/upload", methods=["POST"])
def upload_pdf():
    """
    Upload one or more PDF files.
    Returns paper_id(s) for subsequent API calls.
    """
    if "files" not in request.files:
        return jsonify({"error": "No files provided"}), 400

    files = request.files.getlist("files")
    results = []

    for file in files:
        if file.filename == "":
            continue
        if not allowed_file(file.filename):
            results.append({"error": f"{file.filename} is not a PDF"})
            continue

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)

        # Extract text from PDF
        try:
            text = extract_text_from_pdf(filepath)
            if not text.strip():
                results.append({"error": f"Could not extract text from {filename}"})
                continue

            # Generate paper ID
            paper_id = filename.replace(".pdf", "").replace(" ", "_")

            # Pre-process and store paper data
            sections = detect_sections(text)
            keywords = extract_keywords(text, top_n=20)

            paper_store[paper_id] = {
                "text": text,
                "filename": filename,
                "filepath": filepath,
                "sections": sections,
                "keywords": keywords,
            }

            results.append({
                "paper_id": paper_id,
                "filename": filename,
                "word_count": len(text.split()),
                "sections_found": list(sections.keys()),
                "message": "Upload successful"
            })

        except Exception as e:
            results.append({"error": f"Failed to process {filename}: {str(e)}"})

    return jsonify({"papers": results})


@app.route("/api/summarize", methods=["POST"])
def summarize():
    """
    Summarize a paper.
    Body: { paper_id, mode: 'short'|'bullets'|'oneliner' }
    """
    data = request.json
    paper_id = data.get("paper_id")
    mode = data.get("mode", "short")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found. Please upload first."}), 404

    text = paper_store[paper_id]["text"]

    try:
        if mode == "bullets":
            result = extract_key_points(text)
        elif mode == "oneliner":
            result = one_line_summary(text)
        else:
            result = summarize_text(text)

        return jsonify({"summary": result, "mode": mode})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/simplify", methods=["POST"])
def simplify():
    """
    Simplify complex research language.
    Body: { paper_id, level: 'beginner'|'student'|'viva' }
    """
    data = request.json
    paper_id = data.get("paper_id")
    level = data.get("level", "beginner")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    text = paper_store[paper_id]["text"]

    try:
        simplified = simplify_text(text, level=level)
        return jsonify({"simplified": simplified, "level": level})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/keywords", methods=["POST"])
def keywords():
    """
    Extract keywords from paper.
    Body: { paper_id }
    """
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    kws = paper_store[paper_id]["keywords"]
    return jsonify({"keywords": kws})


@app.route("/api/sections", methods=["POST"])
def sections():
    """
    Get detected sections from paper.
    Body: { paper_id }
    """
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    secs = paper_store[paper_id]["sections"]
    return jsonify({"sections": secs})


@app.route("/api/ask", methods=["POST"])
def ask():
    """
    Ask a question about the paper (semantic Q&A).
    Body: { paper_id, question }
    """
    data = request.json
    paper_id = data.get("paper_id")
    question = data.get("question", "")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    if not question.strip():
        return jsonify({"error": "Question cannot be empty"}), 400

    text = paper_store[paper_id]["text"]

    try:
        answer = answer_question(text, question)
        return jsonify({"answer": answer, "question": question})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/compare", methods=["POST"])
def compare():
    return jsonify({
        "comparison": "Compare feature temporarily disabled for lightweight deployment"
    })

@app.route("/api/visualize", methods=["POST"])
def visualize():
    return jsonify({
        "chart_data": [],
        "message": "Visualization temporarily disabled"
    })


@app.route("/api/word2vec", methods=["POST"])
def word2vec():
    return jsonify({
        "related_terms": [],
        "message": "Word2Vec temporarily disabled"
    })

@app.route("/api/export", methods=["POST"])
def export():
    """
    Export paper analysis as PDF report.
    Body: { paper_id }
    """
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    paper = paper_store[paper_id]

    try:
        # Build full report data
        text = paper["text"]
        report_data = {
            "filename": paper["filename"],
            "summary": summarize_text(text),
            "key_points": extract_key_points(text),
            "keywords": paper["keywords"],
            "sections": paper["sections"],
        }

        output_path = os.path.join("exports", f"{paper_id}_report.pdf")
        export_report_pdf(report_data, output_path)

        return send_file(output_path, as_attachment=True, download_name=f"{paper_id}_report.pdf")

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/papers", methods=["GET"])
def list_papers():
    papers = []
    for pid, p in paper_store.items():
        papers.append({
            "paper_id": pid,
            "filename": p["filename"],
            "word_count": len(p["text"].split()),
        })
    return jsonify({"papers": papers})


if __name__ == "__main__":
    print("=" * 50)
    print("PaperMind Backend Starting...")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False)
