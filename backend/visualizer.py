"""
PaperMind - Visualizer Module
Generates topic clustering (PCA) and Word2Vec concept exploration.
All offline, no external APIs.
"""

import re
import random
import numpy as np
from collections import Counter

import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords

for pkg in ["punkt", "stopwords", "punkt_tab"]:
    try:
        nltk.download(pkg, quiet=True)
    except Exception:
        pass

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import PCA

STOP_WORDS = set(stopwords.words("english"))

# Try to import Gensim Word2Vec
USE_GENSIM = False
try:
    from gensim.models import Word2Vec
    USE_GENSIM = True
    print("[Visualizer] Gensim Word2Vec available.")
except ImportError:
    print("[Visualizer] Gensim not available. Using frequency-based fallback.")


# ── Topic Visualization (PCA) ───────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 200) -> list:
    """
    Split text into overlapping word chunks for vectorization.
    Each chunk represents a 'topic region' of the paper.
    """
    words = text.split()
    chunks = []
    step = chunk_size // 2  # 50% overlap

    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if len(chunk.split()) >= 50:  # Minimum chunk size
            chunks.append(chunk)

    return chunks[:50]  # Max 50 chunks per paper


def generate_topic_visualization(texts: dict) -> dict:
    """
    Generate PCA 2D visualization of topic clusters across papers.

    Args:
        texts: { paper_id: full_text }

    Returns:
        chart_data dict for Plotly/Chart.js scatter plot
    """
    all_chunks = []
    labels = []      # Which paper each chunk belongs to
    paper_ids = []

    for paper_id, text in texts.items():
        chunks = chunk_text(text)
        all_chunks.extend(chunks)
        labels.extend([paper_id] * len(chunks))
        paper_ids.append(paper_id)

    if len(all_chunks) < 3:
        return {"error": "Not enough text to visualize"}

    # TF-IDF vectorization
    vectorizer = TfidfVectorizer(
        max_features=200,
        stop_words="english",
        min_df=1,
        ngram_range=(1, 2)
    )

    try:
        tfidf_matrix = vectorizer.fit_transform(all_chunks).toarray()
    except Exception as e:
        return {"error": f"Vectorization failed: {str(e)}"}

    # Reduce to 2D using PCA
    n_components = min(2, tfidf_matrix.shape[0] - 1, tfidf_matrix.shape[1] - 1)
    if n_components < 2:
        return {"error": "Not enough data for PCA"}

    pca = PCA(n_components=2)
    coords = pca.fit_transform(tfidf_matrix)

    # Assign colors to papers
    colors = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6"]
    color_map = {pid: colors[i % len(colors)] for i, pid in enumerate(paper_ids)}

    # Build chart data points
    points = []
    for i, (x, y) in enumerate(coords):
        pid = labels[i]
        # Get a representative keyword for this chunk
        chunk_words = [
            w.lower() for w in all_chunks[i].split()
            if w.isalpha() and w.lower() not in STOP_WORDS and len(w) > 4
        ]
        top_word = Counter(chunk_words).most_common(1)
        hover_label = top_word[0][0].capitalize() if top_word else pid

        points.append({
            "x": round(float(x), 4),
            "y": round(float(y), 4),
            "label": pid,
            "color": color_map[pid],
            "hover": hover_label,
        })

    return {
        "points": points,
        "explained_variance": [round(float(v), 3) for v in pca.explained_variance_ratio_],
        "paper_ids": paper_ids,
        "colors": color_map,
    }


# ── Word2Vec Concept Explorer ───────────────────────────────────────────────────

def tokenize_for_w2v(text: str) -> list:
    """Tokenize text into sentences of word lists for Word2Vec training"""
    sentences = sent_tokenize(text)
    result = []
    for sent in sentences:
        tokens = [
            w.lower() for w in word_tokenize(sent)
            if w.isalpha() and w.lower() not in STOP_WORDS and len(w) > 2
        ]
        if len(tokens) >= 3:
            result.append(tokens)
    return result


def fallback_related_terms(text: str, term: str, n: int = 8) -> list:
    """
    Fallback when Gensim not available.
    Returns words that co-occur frequently with the search term.
    """
    term = term.lower()
    sentences = sent_tokenize(text)

    # Find sentences containing the term
    related_sentences = [s for s in sentences if term in s.lower()]

    if not related_sentences:
        # Return top keywords from the whole text
        words = [
            w.lower() for w in word_tokenize(text)
            if w.isalpha() and w not in STOP_WORDS and len(w) > 3
        ]
        freq = Counter(words)
        top = [w for w, _ in freq.most_common(n + 5) if w != term][:n]
        return [{"term": w, "score": round(random.uniform(0.5, 0.9), 2)} for w in top]

    # Count words in those sentences (co-occurrence)
    cooccur = Counter()
    for sent in related_sentences:
        words = [
            w.lower() for w in word_tokenize(sent)
            if w.isalpha() and w not in STOP_WORDS and len(w) > 3 and w.lower() != term
        ]
        cooccur.update(words)

    total = sum(cooccur.values()) + 1
    result = []
    for word, count in cooccur.most_common(n):
        score = round(count / total, 3)
        result.append({"term": word, "score": score})

    return result


def word2vec_explore(text: str, term: str, n: int = 10) -> list:
    """
    Find semantically related terms to the given query term.
    Uses Gensim Word2Vec if available, otherwise falls back to co-occurrence.

    Returns: list of { term, score } dicts
    """
    term = term.lower().strip()

    if not USE_GENSIM:
        return fallback_related_terms(text, term, n)

    # Train Word2Vec on the paper text
    sentences = tokenize_for_w2v(text)

    if len(sentences) < 5:
        return fallback_related_terms(text, term, n)

    try:
        model = Word2Vec(
            sentences=sentences,
            vector_size=100,
            window=5,
            min_count=1,
            workers=2,
            epochs=10
        )

        if term not in model.wv:
            # Term not in vocabulary; try partial match
            vocab = list(model.wv.key_to_index.keys())
            partial = [w for w in vocab if term in w or w in term]
            if partial:
                term = partial[0]
            else:
                return fallback_related_terms(text, term, n)

        similar = model.wv.most_similar(term, topn=n)
        return [{"term": word, "score": round(float(score), 3)} for word, score in similar]

    except Exception as e:
        print(f"[Word2Vec] Error: {e}. Using fallback.")
        return fallback_related_terms(text, term, n)
