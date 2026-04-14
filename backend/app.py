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

        [paper_id] = {
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
    """
    Summarize a paper.
    Body: { paper_id, mode: 'short'|'bullets'|'oneliner' }
    """
    data = request.json
    paper_id = data.get("paper_id")
    mode = data.get("mode", "short")

    if paper_id not in :
        return jsonify({"error": "Paper not found. Please upload first."}), 404

    text = [paper_id]["text"]

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

    if paper_id not in :
        return jsonify({"error": "Paper not found"}), 404

    text = [paper_id]["text"]

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

    if paper_id not in :
        return jsonify({"error": "Paper not found"}), 404

    kws = [paper_id]["keywords"]
    return jsonify({"keywords": kws})


@app.route("/api/sections", methods=["POST"])
def sections():
    """
    Get detected sections from paper.
    Body: { paper_id }
    """
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    secs = papers_store[paper_id]["sections"]
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

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    if not question.strip():
        return jsonify({"error": "Question cannot be empty"}), 400

    text = papers_store[paper_id]["text"]

    try:
        answer = answer_question(text, question)
        return jsonify({"answer": answer, "question": question})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/compare", methods=["POST"])
def compare():
    """
    Compare multiple papers.
    Body: { paper_ids: [id1, id2, ...] }
    """
    data = request.json
    paper_ids = data.get("paper_ids", [])

    if len(paper_ids) < 2:
        return jsonify({"error": "Please provide at least 2 paper IDs to compare"}), 400

    papers = {}
    for pid in paper_ids:
        if pid not in papers_store:
            return jsonify({"error": f"Paper '{pid}' not found"}), 404
        papers[pid] = papers_store[pid]

    try:
        comparison = compare_papers(papers)
        return jsonify({"comparison": comparison})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/visualize", methods=["POST"])
def visualize():
    """
    Generate topic visualization (PCA/t-SNE).
    Body: { paper_ids: [...] }
    """
    data = request.json
    paper_ids = data.get("paper_ids", [])

    texts = {}
    for pid in paper_ids:
        if pid in papers_store:
            texts[pid] = papers_store[pid]["text"]

    if not texts:
        # Use all papers
        texts = {pid: p["text"] for pid, p in papers_store.items()}

    if not texts:
        return jsonify({"error": "No papers uploaded"}), 400

    try:
        chart_data = generate_topic_visualization(texts)
        return jsonify({"chart_data": chart_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/word2vec", methods=["POST"])
def word2vec():
    """
    Explore related concepts using Word2Vec.
    Body: { paper_id, term }
    """
    data = request.json
    paper_id = data.get("paper_id")
    term = data.get("term", "")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    if not term.strip():
        return jsonify({"error": "Term cannot be empty"}), 400

    text = papers_store[paper_id]["text"]

    try:
        related = word2vec_explore(text, term)
        return jsonify({"related_terms": related, "query": term})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/export", methods=["POST"])
def export():
    """
    Export paper analysis as PDF report.
    Body: { paper_id }
    """
    data = request.json
    paper_id = data.get("paper_id")

    if paper_id not in papers_store:
        return jsonify({"error": "Paper not found"}), 404

    paper = papers_store[paper_id]

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
    """List all uploaded papers"""
    papers = []
    for pid, p in papers_store.items():
        papers.append({
            "paper_id": pid,
            "filename": p["filename"],
            "word_count": len(p["text"].split()),
        })
    return jsonify({"papers": papers})


@app.route("/")
def home():
    return "PaperMind backend running"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
