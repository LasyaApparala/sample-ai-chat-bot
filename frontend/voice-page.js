// voice-page.js — Dedicated Voice Assistant Page

// ── Auth check ─────────────────────────────────────────────────────────────
const token       = localStorage.getItem("token");
const currentUser = localStorage.getItem("username");

if (!token || !currentUser) {
  window.location.href = "/";
}

document.getElementById("usernameLabel").textContent = currentUser;
document.getElementById("userAvatar").textContent    = currentUser[0].toUpperCase();

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "/";
}

// ── State ──────────────────────────────────────────────────────────────────
let recognition  = null;
let voiceHistory = [];
let currentLang  = "en-US";
let isSpeaking   = false;
let isListening  = false;
let timerInterval = null;
let seconds      = 0;

const langNames = {
  "en-US": "🇺🇸 English",  "es-ES": "🇪🇸 Spanish",  "fr-FR": "🇫🇷 French",
  "de-DE": "🇩🇪 German",   "hi-IN": "🇮🇳 Hindi",    "te-IN": "🇮🇳 Telugu",
  "ta-IN": "🇮🇳 Tamil",    "ja-JP": "🇯🇵 Japanese", "zh-CN": "🇨🇳 Chinese",
  "ar-SA": "🇸🇦 Arabic",   "pt-BR": "🇧🇷 Portuguese","it-IT": "🇮🇹 Italian",
};

// ── DOM ────────────────────────────────────────────────────────────────────
const vaOrb          = document.getElementById("vaOrb");
const waveRing       = document.getElementById("waveRing");
const vaLabel        = document.getElementById("vaLabel");
const vaSublabel     = document.getElementById("vaSublabel");
const vaBubble       = document.getElementById("vaBubble");
const vaMicBtn       = document.getElementById("vaMicBtn");
const vaEndBtn       = document.getElementById("vaEndBtn");
const vaLangPill     = document.getElementById("vaLangPill");
const vaTimer        = document.getElementById("vaTimer");
const vaTranscriptList = document.getElementById("vaTranscriptList");
const vaHistory      = document.getElementById("vaHistory");

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  seconds = 0;
  timerInterval = setInterval(() => {
    seconds++;
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    vaTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

// ── Speech Recognition ─────────────────────────────────────────────────────
function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setSublabel("Speech recognition not supported in this browser"); return null; }

  const rec = new SR();
  rec.continuous     = false;
  rec.interimResults = true;
  rec.lang           = currentLang;

  rec.onstart = () => {
    isListening = true;
    vaOrb.classList.add("listening");
    waveRing.classList.add("active");
    vaMicBtn.classList.add("active");
    setSublabel("Listening...");
    vaBubble.textContent = "";
    vaBubble.classList.remove("visible");
  };

  rec.onresult = (e) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    const display = final || interim;
    vaBubble.textContent = display;
    vaBubble.classList.add("visible");
    if (final) sendVoiceMessage(final.trim());
  };

  rec.onerror = (e) => {
    if (e.error !== "no-speech") setSublabel(`Error: ${e.error}`);
    else setSublabel("Didn't catch that. Tap to try again.");
    resetOrb();
  };

  rec.onend = () => {
    isListening = false;
    if (!isSpeaking) resetOrb();
  };

  return rec;
}

function startListening() {
  if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; }
  recognition = setupRecognition();
  if (!recognition) return;
  try { recognition.start(); } catch (_) {}
}

function stopListening() {
  if (recognition) { try { recognition.stop(); } catch (_) {} }
  isListening = false;
}

// ── Send to backend ────────────────────────────────────────────────────────
async function sendVoiceMessage(text) {
  stopListening();
  setSublabel("Thinking...");
  vaOrb.classList.remove("listening");
  vaOrb.classList.add("speaking");
  waveRing.classList.add("active");
  vaMicBtn.classList.remove("active");

  addTranscriptTurn("user", text);
  voiceHistory.push({ role: "user", content: text });

  try {
    const res = await fetch("/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ message: text, history: voiceHistory.slice(-16) }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error");

    const reply = data.reply;
    voiceHistory.push({ role: "assistant", content: reply });

    if (data.lang && data.lang !== currentLang) {
      currentLang = data.lang;
      vaLangPill.textContent = langNames[currentLang] || currentLang;
    }

    vaBubble.textContent = reply;
    vaBubble.classList.add("visible");
    addTranscriptTurn("bot", reply);
    addHistoryItem(text);
    speakReply(reply);

  } catch (err) {
    setSublabel(`Error: ${err.message}`);
    resetOrb();
  }
}

// ── TTS ────────────────────────────────────────────────────────────────────
function speakReply(text) {
  window.speechSynthesis.cancel();
  isSpeaking = true;
  setSublabel("Speaking...");

  const utter  = new SpeechSynthesisUtterance(text);
  utter.lang   = currentLang;
  utter.rate   = 1.0;
  utter.pitch  = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const match  = voices.find(v => v.lang.startsWith(currentLang.split("-")[0]) && v.localService)
               || voices.find(v => v.lang.startsWith(currentLang.split("-")[0]));
  if (match) utter.voice = match;

  utter.onend = () => {
    isSpeaking = false;
    setSublabel("Tap to speak again");
    resetOrb();
  };
  utter.onerror = () => { isSpeaking = false; resetOrb(); };

  window.speechSynthesis.speak(utter);
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function setSublabel(t) { vaSublabel.textContent = t; }

function resetOrb() {
  vaOrb.classList.remove("listening", "speaking");
  waveRing.classList.remove("active");
  vaMicBtn.classList.remove("active");
  isListening = false;
}

function addTranscriptTurn(role, text) {
  const row = document.createElement("div");
  row.className = `va-turn ${role}`;
  row.innerHTML = `<span class="turn-role">${role === "user" ? "You" : "Nova"}</span>
                   <span class="turn-text">${text}</span>`;
  vaTranscriptList.appendChild(row);
  vaTranscriptList.scrollTop = vaTranscriptList.scrollHeight;
}

function addHistoryItem(text) {
  const item = document.createElement("div");
  item.className = "va-history-item";
  item.textContent = text.slice(0, 38) + (text.length > 38 ? "…" : "");
  vaHistory.prepend(item);
}

// ── Controls ───────────────────────────────────────────────────────────────
vaMicBtn.addEventListener("click", () => {
  if (isListening) stopListening();
  else startListening();
});

vaEndBtn.addEventListener("click", () => {
  stopListening();
  window.speechSynthesis.cancel();
  stopTimer();
  window.location.href = "/";
});

// Orb click also toggles mic
vaOrb.addEventListener("click", () => {
  if (isListening) stopListening();
  else startListening();
});

// ── Init ───────────────────────────────────────────────────────────────────
startTimer();
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
setSublabel("Tap the orb or mic to start speaking");
