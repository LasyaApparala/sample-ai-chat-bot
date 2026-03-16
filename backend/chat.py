"""
chat.py
-------
Core chat logic. Uses:
- HuggingFace Sentence Transformers for semantic context retrieval
- Groq API (free) with LLaMA 3.3 70B for accurate, fast responses
"""

import os
from groq import Groq
from dotenv import load_dotenv
from embeddings import get_relevant_history

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are a highly accurate and helpful AI assistant.
Your goal is to provide clear, precise, and well-reasoned answers.
- Always answer based on facts and logic.
- If you are unsure, say so honestly rather than guessing.
- Keep responses concise but complete.
- Use bullet points or numbered lists when explaining multi-step things.
- Be friendly and professional."""


def get_chat_response(user_message: str, history: list[dict]) -> str:
    """
    Generate a response using Groq (LLaMA 3.3 70B) with semantically relevant context.
    """
    relevant_history = get_relevant_history(user_message, history, top_k=6)

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(relevant_history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )

    return response.choices[0].message.content
