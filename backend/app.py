import os
import traceback
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

from backend.summarizer import summarize_text, extract_key_points, one_line_summary
from backend.qa_engine import answer_question
from backend.compare import compare_papers
from backend.utils import (
    extract_text_from_pdf,
    detect_sections,
    extract_keywords,
    simplify_text,
    export_report_pdf
)

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
EXPORT_FOLDER = "exports"
ALLOWED_EXTENSIONS = {"pdf"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPORT_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

paper_store = {}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/")
def home():
    return jsonify({"message": "PaperMind backend running 🚀"})


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/upload", methods=["POST"])
def upload_pdf():
    try:
        if "files" not in request.files:
            return jsonify({"error": "No files uploaded"}), 400

        files = request.files.getlist("files")
        results = []

        for file in files:
            if file.filename == "":
                continue

            if not allowed_file(file.filename):
                results.append({"error": f"{file.filename} is not PDF"})
                continue

            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)

            try:
                text = extract_text_from_pdf(filepath)

                if not text.strip():
                    results.append({"error": f"No readable text in {filename}"})
                    continue

                paper_id = filename.replace(".pdf", "").replace(" ", "_")

                sections = detect_sections(text)
                keywords = extract_keywords(text, top_n=20)

                paper_store[paper_id] = {
                    "text": text,
                    "filename": filename,
                    "filepath": filepath,
                    "sections": sections,
                    "keywords": keywords
                }

                results.append({
                    "paper_id": paper_id,
                    "filename": filename,
                    "word_count": len(text.split())
                })

            except Exception as e:
                traceback.print_exc()
                results.append({"error": str(e)})

        return jsonify({"papers": results})

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/summarize", methods=["POST"])
def summarize():
    data = request.json
    paper_id = data.get("paper_id")
    mode = data.get("mode", "short")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    text = paper_store[paper_id]["text"]

    if mode == "bullets":
        summary = extract_key_points(text)
    elif mode == "oneliner":
        summary = one_line_summary(text)
    else:
        summary = summarize_text(text)

    return jsonify({"summary": summary})


@app.route("/api/simplify", methods=["POST"])
def simplify():
    data = request.json
    paper_id = data.get("paper_id")
    level = data.get("level", "beginner")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    text = paper_store[paper_id]["text"]
    simplified = simplify_text(text, level)

    return jsonify({"simplified": simplified})


@app.route("/api/keywords", methods=["POST"])
def keywords():
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    return jsonify({"keywords": paper_store[paper_id]["keywords"]})


@app.route("/api/sections", methods=["POST"])
def sections():
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    return jsonify({"sections": paper_store[paper_id]["sections"]})


@app.route("/api/ask", methods=["POST"])
def ask():
    data = request.json
    paper_id = data.get("paper_id")
    question = data.get("question", "")

    if paper_id not in paper_store:
        return jsonify({"error": "Paper not found"}), 404

    answer = answer_question(paper_store[paper_id]["text"], question)
    return jsonify({"answer": answer})


@app.route("/api/compare", methods=["POST"])
def compare():
    if len(paper_store) < 2:
        return jsonify({"error": "Upload at least 2 papers"}), 400

    result = compare_papers(paper_store)
    return jsonify({"comparison": result})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
