# AI Chatbot

A fully functional AI chatbot powered by **OpenAI GPT-4o** for response generation and **HuggingFace Sentence Transformers** for semantic context retrieval. It features a clean, dark-themed chat UI served directly from the backend.

---

## Architecture

```
User Browser
     │
     │  HTTP (REST)
     ▼
┌─────────────────────────────────────┐
│         FastAPI Backend             │
│                                     │
│  main.py  ──►  chat.py              │
│                   │                 │
│                   ├──► embeddings.py│
│                   │    (HuggingFace │
│                   │  Sentence       │
│                   │  Transformers)  │
│                   │                 │
│                   └──► OpenAI API   │
│                        (GPT-4o)     │
└─────────────────────────────────────┘
     │
     │  Serves static files
     ▼
┌─────────────────────────────────────┐
│         Frontend (Static)           │
│  index.html + style.css + app.js    │
└─────────────────────────────────────┘
```

### How it achieves high accuracy

1. The user sends a message along with the full conversation history.
2. `embeddings.py` uses the `all-MiniLM-L6-v2` Sentence Transformer model to compute semantic similarity between the new query and all past messages.
3. Only the most relevant past messages (top 6 by cosine similarity) are selected as context — not just the last N messages. This avoids irrelevant context polluting the prompt.
4. The focused context + system prompt + user message is sent to **GPT-4o** with a low temperature (0.3) for precise, factual answers.

---

## Project Structure

```
ai-chatbot/
├── backend/
│   ├── main.py          # FastAPI app — routes, CORS, static file serving
│   ├── chat.py          # Core logic: builds prompt, calls OpenAI
│   ├── embeddings.py    # HuggingFace Sentence Transformer — semantic retrieval
│   └── requirements.txt # Python dependencies
├── frontend/
│   ├── index.html       # Chat UI markup
│   ├── style.css        # Dark-themed responsive styles
│   └── app.js           # Fetch API calls, message rendering, history management
├── .env.example         # Template for environment variables
├── .gitignore           # Ignores .env, __pycache__, venv, model cache, etc.
└── README.md            # This file
```

---

## File Explanations

### `backend/main.py`
The FastAPI entry point. It:
- Defines `POST /chat` — receives `{ message, history }`, returns `{ reply }`
- Defines `GET /health` — simple health check
- Mounts the `frontend/` folder as static files at `/static`
- Serves `index.html` at the root `/`

### `backend/chat.py`
The brain of the chatbot. It:
- Loads the OpenAI client using your API key from `.env`
- Defines a system prompt that instructs GPT to be accurate and honest
- Calls `get_relevant_history()` from `embeddings.py` to select the best context
- Sends the assembled messages to `gpt-4o` with `temperature=0.3` for accuracy

### `backend/embeddings.py`
Handles semantic similarity using HuggingFace. It:
- Loads `all-MiniLM-L6-v2` — a fast, accurate sentence embedding model
- Encodes the user query and all history messages into vectors
- Computes cosine similarity to rank history by relevance
- Returns the top-k most relevant messages in chronological order

### `frontend/index.html`
The chat UI shell. Contains the header, scrollable message area, and input box with send button.

### `frontend/style.css`
Dark-themed responsive CSS. Styles the chat bubbles (user = indigo, bot = dark card), typing indicator animation, and auto-resizing textarea.

### `frontend/app.js`
All frontend JavaScript. It:
- Maintains `history[]` array in memory
- On send: appends user bubble, shows typing indicator, POSTs to `/chat`
- On response: removes typing indicator, appends bot bubble
- Supports Enter to send, Shift+Enter for newline, and clear chat button

---

## Setup & Running

### 1. Clone and navigate

```bash
git clone <your-repo-url>
cd ai-chatbot
```

### 2. Set up your API key

```bash
cp .env.example .env
```

Open `.env` and replace `your_openai_api_key_here` with your actual key from [platform.openai.com](https://platform.openai.com/api-keys).

### 3. Create a Python virtual environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

> The first run will download the `all-MiniLM-L6-v2` model (~90MB) from HuggingFace automatically.

### 5. Run the server

```bash
uvicorn main:app --reload --port 8000
```

### 6. Open the chatbot

Visit [http://localhost:8000](http://localhost:8000) in your browser.

---

## API Reference

### `POST /chat`

**Request body:**
```json
{
  "message": "What is the capital of France?",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Response:**
```json
{
  "reply": "The capital of France is Paris."
}
```

### `GET /health`
Returns `{ "status": "ok" }` — useful for uptime checks.

---

## Requirements

- Python 3.10+
- An OpenAI API key with access to `gpt-4o`
- Internet connection (for OpenAI API calls and initial model download)

---

## Notes

- Conversation history is stored in the browser's memory only — it resets on page refresh. For persistence, a database layer (e.g., SQLite or Redis) can be added to `main.py`.
- The HuggingFace model is cached locally after the first download in `~/.cache/huggingface/`.
- To use a different OpenAI model (e.g., `gpt-3.5-turbo`), change the `model` parameter in `chat.py`.
