"""
PaperMind - Q&A Engine
TF-IDF cosine similarity based semantic Q&A
Optimized for Render free deployment
"""

import math
from collections import defaultdict

import numpy as np
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords

# Download lightweight NLTK resources safely on startup
for pkg in ["punkt", "stopwords"]:
    try:
        nltk.download(pkg, quiet=True)
    except Exception:
        pass

STOP_WORDS = set(stopwords.words("english"))


# ── TF-IDF Vector Helpers ─────────────────────────────────────────────────────

def build_tfidf_vectors(documents: list[str]):
    """
    Build TF-IDF vectors for a list of text documents.
    Returns (vocabulary, vectors)
    """
    tokenized = []
    for doc in documents:
        tokens = [
            w.lower()
            for w in word_tokenize(doc)
            if w.isalpha() and w.lower() not in STOP_WORDS
        ]
        tokenized.append(tokens)

    vocab = sorted(set(word for tokens in tokenized for word in tokens))
    vocab_index = {word: i for i, word in enumerate(vocab)}

    total_docs = len(documents)

    # TF
    tf_list = []
    for tokens in tokenized:
        tf = defaultdict(float)
        total = len(tokens) if tokens else 1
        for token in tokens:
            tf[token] += 1 / total
        tf_list.append(tf)

    # DF + IDF
    df = defaultdict(int)
    for tokens in tokenized:
        for token in set(tokens):
            df[token] += 1

    idf = {
        word: math.log((total_docs + 1) / (df[word] + 1)) + 1
        for word in vocab
    }

    vectors = []
    for tf in tf_list:
        vec = np.zeros(len(vocab))
        for word, tf_val in tf.items():
            if word in vocab_index:
                vec[vocab_index[word]] = tf_val * idf[word]
        vectors.append(vec)

    return vocab, vectors


def cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return float(np.dot(v1, v2) / (norm1 * norm2))


# ── Index Builder ─────────────────────────────────────────────────────────────

def build_index(text: str):
    """
    Pre-build sentence index from paper text.
    """
    sentences = [s.strip() for s in sent_tokenize(text) if len(s.split()) > 4]

    if not sentences:
        return {
            "sentences": [],
            "vectors": [],
            "mode": "tfidf",
        }

    _, vectors = build_tfidf_vectors(sentences)

    return {
        "sentences": sentences,
        "vectors": vectors,
        "mode": "tfidf",
    }


# ── Intent Detection ──────────────────────────────────────────────────────────

INTENT_KEYWORDS = {
    "objective": ["objective", "goal", "aim", "purpose"],
    "dataset": ["dataset", "data", "corpus", "benchmark"],
    "methodology": ["method", "methodology", "approach", "algorithm", "model"],
    "results": ["result", "performance", "accuracy", "experiment"],
    "conclusion": ["conclusion", "summary", "finding", "contribution"],
    "limitation": ["limitation", "weakness", "drawback", "future"],
    "future": ["future", "scope", "extend", "improve"],
}


def detect_intent(question: str) -> str:
    q_lower = question.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(keyword in q_lower for keyword in keywords):
            return intent
    return "general"


def get_intent_context(intent: str, ranked: list[tuple[float, str]]):
    boost_words = INTENT_KEYWORDS.get(intent, [])
    boosted = []

    for score, sentence in ranked:
        bonus = sum(1 for word in boost_words if word in sentence.lower()) * 0.3
        boosted.append((score + bonus, sentence))

    boosted.sort(reverse=True)
    return boosted


# ── Main Q&A Function ────────────────────────────────────────────────────────

def answer_question(text: str, question: str, top_k: int = 5) -> str:
    """
    Answer a question about the paper using TF-IDF semantic retrieval.
    """
    sentences = [s.strip() for s in sent_tokenize(text) if len(s.split()) > 4]

    if not sentences:
        return "I couldn't find enough content in this paper to answer your question."

    intent = detect_intent(question)

    # Build vectors for sentences + question
    all_docs = sentences + [question]
    _, vectors = build_tfidf_vectors(all_docs)

    question_vector = vectors[-1]
    sentence_vectors = vectors[:-1]

    similarities = [
        cosine_similarity(question_vector, sentence_vector)
        for sentence_vector in sentence_vectors
    ]

    ranked_pairs = [
        (similarities[i], sentences[i])
        for i in range(len(sentences))
    ]

    # Apply intent boosting
    ranked_pairs = get_intent_context(intent, ranked_pairs)
    ranked_pairs.sort(reverse=True)

    top_sentences = [
        sentence
        for score, sentence in ranked_pairs[:top_k]
        if score > 0.05
    ]

    if not top_sentences:
        return (
            "I could not find a direct answer to your question in this paper. "
            "Try rephrasing or asking about the abstract, methodology, or results."
        )

    return build_response(intent, top_sentences)


# ── Response Builder ─────────────────────────────────────────────────────────

def build_response(intent: str, sentences: list[str]) -> str:
    """Build a readable answer from retrieved sentences."""
    intro_map = {
        "objective": "Based on the paper, the main objective is:\n\n",
        "dataset": "Regarding the dataset used in this paper:\n\n",
        "methodology": "The methodology described in this paper:\n\n",
        "results": "Here are the key results from the paper:\n\n",
        "conclusion": "The paper concludes that:\n\n",
        "limitation": "The limitations mentioned in this paper:\n\n",
        "future": "Future work discussed in the paper:\n\n",
        "general": "Based on the paper content:\n\n",
    }

    intro = intro_map.get(intent, intro_map["general"])

    answer_body = " ".join(sentences[:3])

    extra = ""
    if len(sentences) > 3:
        extra = "\n\nAdditional context: " + " ".join(sentences[3:5])

    return intro + answer_body + extra
