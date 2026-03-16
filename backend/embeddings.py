"""
embeddings.py
-------------
Handles semantic similarity using HuggingFace Sentence Transformers.
Used to find the most relevant context from conversation history
before sending to OpenAI, improving response accuracy.
"""

from sentence_transformers import SentenceTransformer
import numpy as np

# Load a lightweight but accurate model
# 'all-MiniLM-L6-v2' is fast and performs well on semantic similarity tasks
MODEL_NAME = "all-MiniLM-L6-v2"
model = SentenceTransformer(MODEL_NAME)


def embed(texts: list[str]) -> np.ndarray:
    """Encode a list of strings into embedding vectors."""
    return model.encode(texts, convert_to_numpy=True)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-10))


def get_relevant_history(query: str, history: list[dict], top_k: int = 5) -> list[dict]:
    """
    Given a user query and full conversation history,
    return the top_k most semantically relevant past messages.
    This ensures OpenAI gets the most useful context, not just the last N messages.
    """
    if not history:
        return []

    # Extract text content from history messages
    history_texts = [msg["content"] for msg in history]

    query_embedding = embed([query])[0]
    history_embeddings = embed(history_texts)

    scores = [
        cosine_similarity(query_embedding, h_emb)
        for h_emb in history_embeddings
    ]

    # Get indices of top_k most relevant messages
    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_k]
    top_indices = sorted(top_indices)  # preserve chronological order

    return [history[i] for i in top_indices]
