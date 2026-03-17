"""
main.py
-------
FastAPI app with user auth + MongoDB Atlas persistence.

Public endpoints:
  POST /auth/register  - Create account
  POST /auth/login     - Get JWT token

Protected endpoints (require Bearer token):
  POST   /chat                  - Send message, get reply
  GET    /sessions              - List user's sessions
  GET    /sessions/{id}         - Load session messages
  DELETE /sessions/{id}         - Delete session
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from pymongo.errors import DuplicateKeyError

from chat import get_chat_response
from voice import get_voice_response
from auth import hash_password, verify_password, create_token, get_current_user
from database import (
    create_user, get_user_by_username, get_user_by_email,
    create_session, get_session, get_user_sessions,
    append_messages, delete_session
)
import os

app = FastAPI(title="AI Chatbot", version="2.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
# Works both locally (backend/../frontend) and on Render (repo root/frontend)
FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "frontend"))
if not os.path.exists(FRONTEND_DIR):
    FRONTEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "../../frontend"))


# ── Pydantic models ────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    session_id: str
    message: str

class VoiceRequest(BaseModel):
    message: str
    history: list[dict] = []


# ── Auth routes ────────────────────────────────────────────────────────────

@app.post("/auth/register", status_code=201)
def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    try:
        user = create_user(req.username, req.email, hash_password(req.password))
        token = create_token(req.username)
        return {"token": token, "username": req.username}
    except DuplicateKeyError:
        raise HTTPException(400, "Username or email already exists")


@app.post("/auth/login")
def login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid username or password")
    token = create_token(req.username)
    return {"token": token, "username": req.username}


# ── Chat routes (protected) ────────────────────────────────────────────────

@app.get("/sessions")
def list_sessions(username: str = Depends(get_current_user)):
    return get_user_sessions(username)


@app.get("/sessions/{session_id}")
def load_session(session_id: str, username: str = Depends(get_current_user)):
    session = get_session(session_id, username)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@app.delete("/sessions/{session_id}")
def remove_session(session_id: str, username: str = Depends(get_current_user)):
    delete_session(session_id, username)
    return {"status": "deleted"}


@app.post("/voice")
def voice(req: VoiceRequest, username: str = Depends(get_current_user)):
    """Voice assistant endpoint — returns human-like short response + optional lang switch."""
    try:
        result = get_voice_response(req.message, req.history)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/chat")
def chat(req: ChatRequest, username: str = Depends(get_current_user)):
    try:
        session = get_session(req.session_id, username)
        if not session:
            create_session(req.session_id, username)
            history = []
        else:
            history = [
                {"role": m["role"], "content": m["content"]}
                for m in session.get("messages", [])
            ]

        reply = get_chat_response(req.message, history)

        is_first = len(history) == 0
        append_messages(
            req.session_id, username,
            [{"role": "user", "content": req.message},
             {"role": "assistant", "content": reply}],
            title=req.message[:50] if is_first else None,
        )

        return {"reply": reply, "session_id": req.session_id}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Static + frontend ──────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def serve_frontend():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
