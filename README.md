# NovaCognix — AI Chatbot & Voice Assistant

A full-stack AI assistant with text chat and a multilingual voice assistant, powered by **Groq LLaMA 3.3 70B**, **HuggingFace Sentence Transformers**, and **MongoDB Atlas**. Users can register, log in, chat, and speak to Nova in 12 languages with adjustable voice settings.

---

## Features

- User authentication (register/login) with JWT tokens
- Persistent chat history per user stored in MongoDB Atlas
- Semantic context retrieval using HuggingFace `all-MiniLM-L6-v2` for high accuracy
- Dedicated voice assistant page with animated floating orb
- 12 language support with voice picker, speed and pitch controls
- Auto language detection — say "switch to Spanish" mid-conversation
- Clean dark UI with sidebar, suggestion chips, and conversation transcript

---

## Architecture

```
Browser
  │
  ├── Text Chat  ──► POST /chat         ──► chat.py  ──► embeddings.py (HuggingFace)
  │                                                  └──► Groq LLaMA 3.3 70B
  │
  ├── Voice Page ──► POST /voice        ──► voice.py ──► Groq LLaMA 3.3 70B
  │   (Web Speech API STT + TTS)
  │
  └── Auth       ──► POST /auth/register
                 ──► POST /auth/login
                          └──► auth.py ──► MongoDB Atlas (users collection)

MongoDB Atlas (SAMPLE_AI_BOT)
  ├── users    — username, email, hashed_password, created_at
  └── sessions — session_id, user_id, title, messages[], timestamps
```

---

## Project Structure

```
ai-chatbot/
├── backend/
│   ├── main.py           # FastAPI app — all routes, auth middleware, static serving
│   ├── chat.py           # Text chat — semantic retrieval + Groq LLaMA
│   ├── voice.py          # Voice assistant — human-like, multilingual responses
│   ├── embeddings.py     # HuggingFace Sentence Transformer — picks relevant history
│   ├── auth.py           # JWT creation/verification, bcrypt password hashing
│   ├── database.py       # MongoDB Atlas — users + sessions CRUD
│   ├── .python-version   # Pins Python 3.11 for Render deployment
│   └── requirements.txt
├── frontend/
│   ├── index.html        # App shell — auth screen + chat UI
│   ├── style.css         # Dark theme, chat bubbles, auth card, responsive layout
│   ├── app.js            # Text chat logic, session management, auth flow
│   ├── voice.html        # Dedicated voice assistant page
│   ├── voice.css         # Voice page styles — orb, wave rings, settings panel
│   └── voice-page.js     # Voice assistant logic — STT, API, TTS, settings
├── render.yaml           # Render deployment config
├── .env.example          # Environment variable template
├── .gitignore
└── README.md
```

---

## File Explanations

### Backend

`main.py` — FastAPI entry point. Defines all routes: auth, chat, voice, sessions. Serves the frontend as static files at `/static`. All chat/voice routes require a valid JWT Bearer token.

`chat.py` — Text chat handler. Uses `embeddings.py` to find the most semantically relevant past messages via cosine similarity, then sends a focused prompt to Groq LLaMA 3.3 70B at temperature 0.8 for accurate, factual, creative answers.

`voice.py` — Voice assistant handler. Uses a conversational system prompt tuned for natural, human-like spoken responses (short sentences, no markdown). Temperature 0.7 for more natural speech. Detects language switch commands and returns the new language code to the frontend.

`embeddings.py` — Loads `all-MiniLM-L6-v2` from HuggingFace. Encodes the user query and all history messages into vectors, ranks by cosine similarity, and returns the top-k most relevant messages as context — ensuring the LLM always gets the most useful history.

`auth.py` — bcrypt password hashing via `passlib`. JWT tokens (72hr expiry) via `python-jose`. `get_current_user` is a FastAPI dependency injected into all protected routes.

`database.py` — MongoDB Atlas connection via `pymongo`. Two collections: `users` (account data with unique indexes on username and email) and `sessions` (full message history per user, sorted by recency).

### Frontend

`index.html` — App shell with two screens: auth (login/register) and chat. Auth state is managed via JWT in `localStorage` for auto-login on return visits.

`style.css` — Full dark theme. Covers auth card, chat bubbles (user = indigo gradient, bot = dark card), sidebar, suggestion chips, typing indicator, and responsive mobile layout.

`app.js` — Text chat frontend. Manages JWT in `localStorage`. Sends messages with a UUID session ID to `/chat`, renders message bubbles, loads sidebar history from `/sessions`, handles auto-login.

`voice.html` — Dedicated voice assistant page at `/voice-assistant`. Contains the sidebar with navigation, animated orb area, live transcript bubble, conversation panel, mic/end controls, and a slide-in settings panel.

`voice.css` — All styles for the voice page. Includes the floating orb animation, expanding wave rings, listening/speaking state transitions (purple → cyan), settings panel slide-in animation, language chips, voice dropdown, and range sliders.

`voice-page.js` — Full voice assistant logic:
- Web Speech API (`SpeechRecognition`) for speech-to-text
- POSTs to `/voice` with conversation history
- `SpeechSynthesis` for text-to-speech with selected voice, rate, and pitch
- Settings panel: 12 language chips, voice dropdown (auto-populated per language), speed/pitch sliders, test voice button
- Spoken language switching: say "switch to Hindi" and it updates recognition + TTS instantly

---

## Setup & Running Locally

### 1. Clone
```bash
git clone https://github.com/LasyaApparala/sample-ai-chat-bot.git
cd sample-ai-chat-bot/ai-chatbot
```

### 2. Create `.env`
```bash
cp .env.example .env
```
```
GROQ_API_KEY=your_groq_api_key
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/SAMPLE_AI_BOT?retryWrites=true&w=majority
JWT_SECRET=your-random-secret
```
- Free Groq key: [console.groq.com](https://console.groq.com)
- Free MongoDB Atlas: [cloud.mongodb.com](https://cloud.mongodb.com)

### 3. Install dependencies
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 4. Run
```bash
uvicorn main:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000)

---

## Voice Assistant Usage

1. Log in and click "Voice Assistant" in the sidebar
2. Click the orb or mic button and speak
3. Orb pulses purple while listening, shifts cyan while Nova speaks
4. Click ⚙ (top right) to open the settings panel:
   - Select from 12 languages
   - Pick a specific voice from your system
   - Adjust speed (0.5x–2x) and pitch
   - Click "Test Voice" to preview
5. Switch language mid-conversation by saying:
   - "Switch to Spanish" / "Habla español"
   - "Speak Hindi" / "Speak Telugu"
   - "Parle français" / "Speak Japanese"

### Supported Languages
English · Spanish · French · German · Hindi · Telugu · Tamil · Japanese · Chinese · Arabic · Portuguese · Italian

---

## Deployment on Render

Settings:
- Language: `Python 3`
- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Environment variables:
```
GROQ_API_KEY
MONGO_URI
JWT_SECRET
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Get JWT token |
| POST | `/chat` | Yes | Send message, get reply (persisted) |
| POST | `/voice` | Yes | Voice query, get spoken reply |
| GET | `/sessions` | Yes | List user's chat sessions |
| GET | `/sessions/{id}` | Yes | Load session messages |
| DELETE | `/sessions/{id}` | Yes | Delete a session |
| GET | `/health` | No | Health check |
| GET | `/` | No | Serve chat UI |
| GET | `/voice-assistant` | No | Serve voice assistant page |
