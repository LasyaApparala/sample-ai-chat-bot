// voice-page.js — NovaCognix Voice Assistant with Language & Voice Settings

// ── Auth check ─────────────────────────────────────────────────────────────
const token       = localStorage.getItem("token");
const currentUser = localStorage.getItem("username");
if (!token || !currentUser) window.location.href = "/";

document.getElementById("usernameLabel").textContent = currentUser;
document.getElementById("userAvatar").textContent    = currentUser[0].toUpperCase();

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "/";
}

// ── Language map ───────────────────────────────────────────────────────────
const LANG_MAP = {
  "en-US": "🇺🇸 English",   "es-ES": "🇪🇸 Spanish",
  "fr-FR": "🇫🇷 French",    "de-DE": "🇩🇪 German",
  "hi-IN": "🇮🇳 Hindi",     "te-IN": "🇮🇳 Telugu",
  "ta-IN": "🇮🇳 Tamil",     "ja-JP": "🇯🇵 Japanese",
  "zh-CN": "🇨🇳 Chinese",   "ar-SA": "🇸🇦 Arabic",
  "pt-BR": "🇧🇷 Portuguese","it-IT": "🇮🇹 Italian",
};

// Auto-switch keywords spoken by user
const LANG_KEYWORDS = {
  "english": "en-US", "spanish": "es-ES", "español": "es-ES",
  "french": "fr-FR",  "français": "fr-FR","german": "de-DE",
  "deutsch": "de-DE", "hindi": "hi-IN",   "telugu": "te-IN",
  "tamil": "ta-IN",   "japanese": "ja-JP","chinese": "zh-CN",
  "arabic": "ar-SA",  "portuguese": "pt-BR","italiano": "it-IT","italian": "it-IT",
};

// ── State ──────────────────────────────────────────────────────────────────
let recognition   = null;
let voiceHistory  = [];
let currentLang   = "en-US";
let selectedVoice = null;
let speechRate    = 1.0;
let speechPitch   = 1.0;
let isSpeaking    = false;
let isListening   = false;
let timerInterval = null;
let seconds       = 0;
let allVoices     = [];

// ── DOM ────────────────────────────────────────────────────────────────────
const vaOrb            = document.getElementById("vaOrb");
const waveRing         = document.getElementById("waveRing");
const vaSublabel       = document.getElementById("vaSublabel");
const vaBubble         = document.getElementById("vaBubble");
const vaMicBtn         = document.getElementById("vaMicBtn");
const vaEndBtn         = document.getElementById("vaEndBtn");
const vaLangPill       = document.getElementById("vaLangPill");
const vaTimer          = document.getElementById("vaTimer");
const vaTranscriptList = document.getElementById("vaTranscriptList");
const vaHistory        = document.getElementById("vaHistory");
const vaSettingsBtn    = document.getElementById("vaSettingsBtn");
const vaSettingsPanel  = document.getElementById("vaSettingsPanel");
const vaSettingsClose  = document.getElementById("vaSettingsClose");
const voiceSelect      = document.getElementById("voiceSelect");
const rateRange        = document.getElementById("rateRange");
const pitchRange       = document.getElementById("pitchRange");
const rateVal          = document.getElementById("rateVal");
const pitchVal         = document.getElementById("pitchVal");
const testVoiceBtn     = document.getElementById("testVoiceBtn");

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  seconds = 0;
  timerInterval = setInterval(() => {
    seconds++;
    vaTimer.textContent = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  }, 1000);
}

// ── Voice loading ──────────────────────────────────────────────────────────
function loadVoices() {
  allVoices = window.speechSynthesis.getVoices();
  populateVoiceSelect();
}

function populateVoiceSelect() {
  const filtered = allVoices.filter(v => v.lang.startsWith(currentLang.split("-")[0]));
  voiceSelect.innerHTML = '<option value="">Default voice</option>';
  filtered.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = v.name;
    opt.textContent = `${v.name} ${v.localService ? "⚡" : "🌐"}`;
    voiceSelect.appendChild(opt);
  });
  // Auto-select first local voice
  const local = filtered.find(v => v.localService);
  if (local) { voiceSelect.value = local.name; selectedVoice = local; }
  else selectedVoice = filtered[0] || null;
}

function getSelectedVoice() {
  if (!voiceSelect.value) return allVoices.find(v => v.lang.startsWith(currentLang.split("-")[0])) || null;
  return allVoices.find(v => v.name === voiceSelect.value) || null;
}

// ── Settings panel ─────────────────────────────────────────────────────────
vaSettingsBtn.addEventListener("click", () => vaSettingsPanel.classList.remove("hidden"));
vaSettingsClose.addEventListener("click", () => vaSettingsPanel.classList.add("hidden"));

// Language chips
document.querySelectorAll(".lang-chip").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".lang-chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentLang = btn.dataset.lang;
    vaLangPill.textContent = LANG_MAP[currentLang] || currentLang;
    populateVoiceSelect();
  });
});

// Voice select
voiceSelect.addEventListener("change", () => {
  selectedVoice = getSelectedVoice();
});

// Rate slider
rateRange.addEventListener("input", () => {
  speechRate = parseFloat(rateRange.value);
  rateVal.textContent = speechRate.toFixed(1);
});

// Pitch slider
pitchRange.addEventListener("input", () => {
  speechPitch = parseFloat(pitchRange.value);
  pitchVal.textContent = speechPitch.toFixed(1);
});

// Test voice
testVoiceBtn.addEventListener("click", () => {
  const samples = {
    "en-US": "Hello! I'm Nova, your AI assistant.",
    "es-ES": "¡Hola! Soy Nova, tu asistente de IA.",
    "fr-FR": "Bonjour! Je suis Nova, votre assistante IA.",
    "de-DE": "Hallo! Ich bin Nova, Ihr KI-Assistent.",
    "hi-IN": "नमस्ते! मैं नोवा हूँ, आपकी AI सहायक।",
    "te-IN": "నమస్కారం! నేను నోవా, మీ AI సహాయకుడిని.",
    "ta-IN": "வணக்கம்! நான் நோவா, உங்கள் AI உதவியாளர்.",
    "ja-JP": "こんにちは！私はノバ、あなたのAIアシスタントです。",
    "zh-CN": "你好！我是Nova，您的AI助手。",
    "ar-SA": "مرحباً! أنا نوفا، مساعدك الذكي.",
    "pt-BR": "Olá! Sou Nova, sua assistente de IA.",
    "it-IT": "Ciao! Sono Nova, la tua assistente IA.",
  };
  speakReply(samples[currentLang] || samples["en-US"]);
});

// ── Speech Recognition ─────────────────────────────────────────────────────
function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { setSublabel("Speech recognition not supported"); return null; }

  const rec = new SR();
  rec.continuous = false; rec.interimResults = true; rec.lang = currentLang;

  rec.onstart = () => {
    isListening = true;
    vaOrb.classList.add("listening"); waveRing.classList.add("active");
    vaMicBtn.classList.add("active"); setSublabel("Listening...");
    vaBubble.textContent = ""; vaBubble.classList.remove("visible");
  };

  rec.onresult = (e) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    vaBubble.textContent = final || interim;
    vaBubble.classList.add("visible");
    if (final) sendVoiceMessage(final.trim());
  };

  rec.onerror = (e) => {
    setSublabel(e.error === "no-speech" ? "Didn't catch that. Tap to try again." : `Error: ${e.error}`);
    resetOrb();
  };

  rec.onend = () => { isListening = false; if (!isSpeaking) resetOrb(); };
  return rec;
}

function startListening() {
  if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; }
  recognition = setupRecognition();
  if (recognition) try { recognition.start(); } catch (_) {}
}

function stopListening() {
  if (recognition) try { recognition.stop(); } catch (_) {}
  isListening = false;
}

// ── Send to backend ────────────────────────────────────────────────────────
async function sendVoiceMessage(text) {
  stopListening();
  setSublabel("Thinking...");
  vaOrb.classList.remove("listening"); vaOrb.classList.add("speaking");
  waveRing.classList.add("active"); vaMicBtn.classList.remove("active");

  // Check for spoken language switch
  const lower = text.toLowerCase();
  for (const [kw, code] of Object.entries(LANG_KEYWORDS)) {
    if (lower.includes(kw)) { switchLang(code); break; }
  }

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

    // Backend may also detect a lang switch
    if (data.lang && data.lang !== currentLang) switchLang(data.lang);

    vaBubble.textContent = reply; vaBubble.classList.add("visible");
    addTranscriptTurn("user", text);
    addTranscriptTurn("bot", reply);
    addHistoryItem(text);
    speakReply(reply);
  } catch (err) {
    setSublabel(`Error: ${err.message}`); resetOrb();
  }
}

// ── TTS ────────────────────────────────────────────────────────────────────
function speakReply(text) {
  window.speechSynthesis.cancel();
  isSpeaking = true; setSublabel("Speaking...");

  const utter   = new SpeechSynthesisUtterance(text);
  utter.lang    = currentLang;
  utter.rate    = speechRate;
  utter.pitch   = speechPitch;
  const voice   = getSelectedVoice();
  if (voice) utter.voice = voice;

  utter.onend   = () => { isSpeaking = false; setSublabel("Tap to speak again"); resetOrb(); };
  utter.onerror = () => { isSpeaking = false; resetOrb(); };
  window.speechSynthesis.speak(utter);
}

// ── Language switch ────────────────────────────────────────────────────────
function switchLang(code) {
  if (!LANG_MAP[code]) return;
  currentLang = code;
  vaLangPill.textContent = LANG_MAP[code];
  // Update chip UI
  document.querySelectorAll(".lang-chip").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === code);
  });
  populateVoiceSelect();
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function setSublabel(t) { vaSublabel.textContent = t; }

function resetOrb() {
  vaOrb.classList.remove("listening", "speaking");
  waveRing.classList.remove("active"); vaMicBtn.classList.remove("active");
  isListening = false;
}

function addTranscriptTurn(role, text) {
  const row = document.createElement("div");
  row.className = `va-turn ${role}`;
  row.innerHTML = `<span class="turn-role">${role === "user" ? "You" : "Nova"}</span><span class="turn-text">${text}</span>`;
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
vaMicBtn.addEventListener("click", () => isListening ? stopListening() : startListening());
vaOrb.addEventListener("click",    () => isListening ? stopListening() : startListening());
vaEndBtn.addEventListener("click", () => {
  stopListening(); window.speechSynthesis.cancel();
  clearInterval(timerInterval); window.location.href = "/";
});

// ── Init ───────────────────────────────────────────────────────────────────
startTimer();
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();
setSublabel("Tap the orb or mic to start speaking");
