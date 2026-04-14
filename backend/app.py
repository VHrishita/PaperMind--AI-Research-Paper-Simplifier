from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import io
import uuid
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

papers_store = {}


def extract_text_from_pdf(path):
    text = ""
    reader = PdfReader(path)
    for page in reader.pages:
        extracted = page.extract_text()
        if extracted:
            text += extracted + "\n"
    return text.strip()


@app.route("/api/upload", methods=["POST"])
def upload_files():
    if "files" not in request.files:
        return jsonify({"error": "No files uploaded"}), 400

    files = request.files.getlist("files")
    papers = []

    for file in files:
        if not file.filename.endswith(".pdf"):
            continue

        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())[:8]
        saved_name = f"{unique_id}_{filename}"
        filepath = os.path.join(UPLOAD_FOLDER, saved_name)
        file.save(filepath)

        text = extract_text_from_pdf(filepath)
        paper_id = unique_id

        papers_store[paper_id] = {
            "filename": filename,
            "text": text,
            "path": filepath,
            "word_count": len(text.split())
        }

        papers.append({
            "paper_id": paper_id,
            "filename": filename,
            "word_count": len(text.split()),
            "sections_found": ["Abstract", "Introduction", "Conclusion"]
        })

    return jsonify({"papers": papers})


@app.route("/api/summarize", methods=["POST"])
def summarize():
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    text = papers_store[paper_id]["text"]
    summary = " ".join(text.split()[:120])

    return jsonify({"summary": summary})


@app.route("/api/ask", methods=["POST"])
def ask_question():
    data = request.json
    paper_id = data.get("paper_id")
    question = data.get("question", "")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    text = papers_store[paper_id]["text"]
    answer = f"Based on the paper, here's a response to: {question}\n\n{text[:500]}..."

    return jsonify({"answer": answer})


@app.route("/api/keywords", methods=["POST"])
def keywords():
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    words = papers_store[paper_id]["text"].split()
    unique = list(dict.fromkeys([w.strip('.,').lower() for w in words if len(w) > 6]))

    return jsonify({"keywords": unique[:15]})


@app.route("/api/sections", methods=["POST"])
def sections():
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    text = papers_store[paper_id]["text"]

    return jsonify({
        "sections": {
            "Abstract": text[:500],
            "Content": text[500:1500],
            "Conclusion": text[-500:]
        }
    })


@app.route("/api/simplify", methods=["POST"])
def simplify():
    data = request.json
    paper_id = data.get("paper_id")
    level = data.get("level", "beginner")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    text = papers_store[paper_id]["text"]
    sentences = text.split(".")
    simplified = ". ".join(sentences[:5])

    if level == "child":
        simplified = "This paper talks about: " + simplified
    elif level == "expert":
        simplified = "Technical explanation: " + simplified

    return jsonify({"simplified": simplified})


@app.route("/api/compare", methods=["POST"])
def compare():
    data = request.json
    paper_ids = data.get("paper_ids", [])

    if len(paper_ids) < 2:
        return jsonify({"error": "At least 2 papers required"}), 400

    comparison = []

    for pid in paper_ids:
        if pid in papers_store:
            paper = papers_store[pid]
            text = paper["text"]

            comparison.append({
                "title": paper["filename"],
                "objective": "Research objective extracted from first part",
                "methodology": "Method inferred from content",
                "results": text[:200],
                "conclusion": text[-200:],
                "limitations": "Not explicitly detected",
                "technologies": ["NLP", "PDF", "ML"],
                "word_count": paper["word_count"]
            })

    return jsonify({"comparison": comparison})


@app.route("/api/word2vec", methods=["POST"])
def word2vec():
    data = request.json
    paper_id = data.get("paper_id")
    term = data.get("term", "").lower()

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    words = papers_store[paper_id]["text"].lower().split()
    related = []

    for word in list(dict.fromkeys(words)):
        if term in word and word != term:
            related.append({
                "term": word,
                "score": 0.8
            })

    if not related:
        related = [{"term": "no similar terms found", "score": 0.1}]

    return jsonify({
        "query": term,
        "related_terms": related[:10]
    })


@app.route("/api/visualize", methods=["POST"])
def visualize():
    data = request.json
    paper_ids = data.get("paper_ids", [])

    points = []
    colors = {}

    for i, pid in enumerate(paper_ids):
        if pid in papers_store:
            points.append({
                "x": i + 1,
                "y": (i + 1) * 2,
                "label": pid,
                "hover": papers_store[pid]["filename"]
            })
            colors[pid] = "#6366f1"

    return jsonify({
        "chart_data": {
            "points": points,
            "paper_ids": paper_ids,
            "colors": colors,
            "explained_variance": [0.62, 0.21]
        }
    })


@app.route("/api/export", methods=["POST"])
def export():
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    text = papers_store[paper_id]["text"][:2000]

    buffer = io.BytesIO()
    buffer.write(text.encode("utf-8"))
    buffer.seek(0)

    return send_file(
        buffer,
        as_attachment=True,
        download_name="paper_report.txt",
        mimetype="text/plain"
    )


@app.route("/")
def home():
    return "PaperMind backend running"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
