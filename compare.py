"""
PaperMind - Paper Comparison Module
Compares multiple research papers across key dimensions.
"""

import re
from collections import Counter

import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords

for pkg in ["punkt", "stopwords", "punkt_tab"]:
    try:
        nltk.download(pkg, quiet=True)
    except Exception:
        pass

STOP_WORDS = set(stopwords.words("english"))

# ── Section Extraction Helpers ──────────────────────────────────────────────────

SECTION_PATTERNS = {
    "abstract": r"abstract[\s\S]{0,2000}?(?=\n\s*\n|\bintroduction\b)",
    "objective": r"(objective|goal|aim|purpose)[\s\S]{0,500}",
    "methodology": r"(method|methodology|approach|proposed|system)[\s\S]{0,1500}",
    "results": r"(result|experiment|evaluation|performance|accuracy)[\s\S]{0,1500}",
    "conclusion": r"(conclusion|conclud|summary|finding)[\s\S]{0,1000}",
    "limitations": r"(limitation|drawback|weakness|constraint|future work)[\s\S]{0,800}",
}

TECH_KEYWORDS = [
    # ML/AI
    "deep learning", "neural network", "machine learning", "cnn", "rnn", "lstm",
    "transformer", "bert", "gpt", "attention", "reinforcement learning",
    # Computer Vision
    "object detection", "image segmentation", "yolo", "resnet", "vgg",
    # NLP
    "nlp", "sentiment", "classification", "embedding", "word2vec",
    # Data
    "dataset", "training", "validation", "test set", "benchmark",
    # Methods
    "regression", "clustering", "svm", "random forest", "gradient boosting",
    # IoT/Systems
    "iot", "sensor", "edge computing", "cloud", "arduino", "raspberry pi",
    # Evaluation
    "accuracy", "precision", "recall", "f1", "auc", "mse", "rmse",
]


def extract_section_text(text: str, section: str) -> str:
    """Extract text for a specific section using regex patterns"""
    text_lower = text.lower()
    pattern = SECTION_PATTERNS.get(section, "")
    if not pattern:
        return ""

    match = re.search(pattern, text_lower, re.IGNORECASE | re.DOTALL)
    if match:
        # Return original-case text at matched position
        start = match.start()
        end = min(match.end(), start + 800)
        snippet = text[start:end].strip()
        # Clean up
        snippet = re.sub(r"\s+", " ", snippet)
        return snippet[:500]  # Limit to 500 chars for display
    return "Not clearly mentioned in this paper."


def extract_technologies(text: str) -> list:
    """Find which technologies/methods are mentioned in the paper"""
    text_lower = text.lower()
    found = []
    for tech in TECH_KEYWORDS:
        if tech in text_lower:
            found.append(tech.title())
    return list(set(found))[:10]  # Return top 10 unique


def extract_top_keywords(text: str, n: int = 10) -> list:
    """Extract most frequent meaningful keywords"""
    words = word_tokenize(text.lower())
    words = [
        w for w in words
        if w.isalpha() and w not in STOP_WORDS and len(w) > 3
    ]
    freq = Counter(words)
    return [word for word, count in freq.most_common(n)]


def estimate_paper_title(text: str, filename: str) -> str:
    """
    Try to extract the paper title from the first few lines.
    Falls back to filename if not found.
    """
    # Title is usually in the first 500 characters, before 'Abstract'
    header = text[:500]
    lines = [l.strip() for l in header.split("\n") if len(l.strip()) > 10]
    if lines:
        # The first substantial line is often the title
        candidate = lines[0]
        if len(candidate) < 200:  # Titles are usually not too long
            return candidate
    return filename.replace("_", " ").replace(".pdf", "")


# ── Main Comparison Function ────────────────────────────────────────────────────

def compare_papers(papers: dict) -> list:
    """
    Compare multiple papers across key dimensions.

    Args:
        papers: dict of { paper_id: { text, filename, ... } }

    Returns:
        List of comparison dicts, one per paper.
    """
    comparison_results = []

    for paper_id, paper_data in papers.items():
        text = paper_data["text"]
        filename = paper_data["filename"]

        result = {
            "paper_id": paper_id,
            "title": estimate_paper_title(text, filename),
            "filename": filename,
            "word_count": len(text.split()),
            "abstract": extract_section_text(text, "abstract"),
            "objective": extract_section_text(text, "objective"),
            "methodology": extract_section_text(text, "methodology"),
            "results": extract_section_text(text, "results"),
            "conclusion": extract_section_text(text, "conclusion"),
            "limitations": extract_section_text(text, "limitations"),
            "technologies": extract_technologies(text),
            "top_keywords": extract_top_keywords(text, n=8),
        }

        comparison_results.append(result)

    # Add a similarity score between papers
    if len(comparison_results) >= 2:
        for i in range(len(comparison_results)):
            for j in range(i + 1, len(comparison_results)):
                kw_i = set(comparison_results[i]["top_keywords"])
                kw_j = set(comparison_results[j]["top_keywords"])
                if kw_i | kw_j:
                    similarity = len(kw_i & kw_j) / len(kw_i | kw_j)
                    comparison_results[i]["similarity_with"] = {
                        comparison_results[j]["paper_id"]: round(similarity * 100, 1)
                    }

    return comparison_results
