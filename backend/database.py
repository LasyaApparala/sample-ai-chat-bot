"""
database.py
-----------
MongoDB Atlas connection.

Collections:
  users    - stores registered users (username, hashed_password, email, created_at)
  sessions - stores chat sessions per user (session_id, user_id, title, messages[])
"""

from pymongo import MongoClient, DESCENDING
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["SAMPLE_AI_BOT"]

users_col    = db["users"]
sessions_col = db["sessions"]

# Indexes
users_col.create_index("username", unique=True)
users_col.create_index("email",    unique=True)
sessions_col.create_index("session_id")
sessions_col.create_index("user_id")


# ── User helpers ───────────────────────────────────────────────────────────

def create_user(username: str, email: str, hashed_password: str) -> dict:
    doc = {
        "username": username,
        "email": email,
        "hashed_password": hashed_password,
        "created_at": datetime.now(timezone.utc),
    }
    users_col.insert_one(doc)
    return {"username": username, "email": email}


def get_user_by_username(username: str) -> dict | None:
    return users_col.find_one({"username": username}, {"_id": 0})


def get_user_by_email(email: str) -> dict | None:
    return users_col.find_one({"email": email}, {"_id": 0})


# ── Session helpers ────────────────────────────────────────────────────────

def create_session(session_id: str, user_id: str) -> dict:
    doc = {
        "session_id": session_id,
        "user_id": user_id,
        "title": "New Chat",
        "messages": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    sessions_col.insert_one(doc)
    return doc


def get_session(session_id: str, user_id: str) -> dict | None:
    return sessions_col.find_one(
        {"session_id": session_id, "user_id": user_id}, {"_id": 0}
    )


def get_user_sessions(user_id: str) -> list[dict]:
    return list(
        sessions_col.find(
            {"user_id": user_id},
            {"_id": 0, "session_id": 1, "title": 1, "updated_at": 1}
        ).sort("updated_at", DESCENDING).limit(30)
    )


def append_messages(session_id: str, user_id: str, new_messages: list[dict], title: str = None):
    timestamped = [
        {**m, "timestamp": datetime.now(timezone.utc)} for m in new_messages
    ]
    update = {
        "$push": {"messages": {"$each": timestamped}},
        "$set":  {"updated_at": datetime.now(timezone.utc)},
    }
    if title:
        update["$set"]["title"] = title
    sessions_col.update_one(
        {"session_id": session_id, "user_id": user_id},
        update, upsert=True
    )


def delete_session(session_id: str, user_id: str):
    sessions_col.delete_one({"session_id": session_id, "user_id": user_id})
