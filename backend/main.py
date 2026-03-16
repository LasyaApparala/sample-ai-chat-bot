"""
main.py
-------
FastAPI application entry point.
Exposes REST endpoints consumed by the frontend.

Endpoints:
  POST /chat   - Send a message and get a response
  GET  /health - Health check
  GET  /       - Serves the chat UI (index.html)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from chat import get_chat_response
import os

app = FastAPI(title="AI Chatbot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Resolve frontend path relative to this file's location (absolute)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)


# ── Request / Response models ──────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[Message] = []

class ChatResponse(BaseModel):
    reply: str


# ── Routes (must be defined BEFORE static mount) ───────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        history = [{"role": m.role, "content": m.content} for m in request.history]
        reply = get_chat_response(request.message, history)
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def serve_frontend():
    """Serve the chat UI."""
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# ── Static files mount (after routes) ─────────────────────────────────────────
# Serves CSS, JS at /static/style.css and /static/app.js
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
