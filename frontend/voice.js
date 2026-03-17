// voice.js — NovaCognix Voice Assistant
// Uses Web Speech API for STT + Groq LLaMA 3.3 70B for response + Web Speech Synthesis for TTS

const voiceOverlay  = document.getElementById("voiceOverlay");
const voiceClose    = document.getElementById("voiceClose");
const voiceNavBtn   = document.getElementById("voiceNavBtn");
const voiceOrb      = document.getElementById("voiceOrb");
const voiceStatus   = document.getElementById("voiceStatus");
const voiceTranscript = document.getElementById("voiceTranscript");
const voiceReply    = document.getElementById("voiceReply");
const voiceMicBtn   = document.getElementById("voiceMicBtn");
const langCurrent   = document.getElementById("langCurrent");

let recognition     = null;
let voiceHistory    = [];
let currentLang     = "en-US";
let isSpeaking      = false;
let isListening     = false;

const langNames = {
  "en-US": "English", "es-ES": "Spanish", "fr-FR": "French",
  "de-DE": "German",  "hi-IN": "Hindi",   "te-IN": "Telugu",
  "ta-IN": "Tamil",   "ja-JP": "Japanese","zh-CN": "Chinese",
  "ar-SA": "Arabic",  "pt-BR": "Portuguese", "it-IT": "Italian",
};

// ── Open / Close ───────────────────────────────────────────────────────────

voiceNavBtn.addEventListener("click", () => {
  voiceOverlay.classList.remove("hidden");
  setStatus("Tap the mic to start");
});

voiceClose.addEventListener("click", () => {
  stopListening();
  window.speechSynthesis.cancel();
  voiceOverlay.classList.add("hidden");
});

// ── Speech Recognition setup ───────────────────────────────────────────────

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus("Speech recognition not supported in this browser");
    return null;
  }

  const rec = new SpeechRecognition();
  rec.continuous      = false;
  rec.interimResults  = true;
  rec.lang            = currentLang;

  rec.onstart = () => {
    isListening = true;
    voiceOrb.classList.add("listening");
    voiceMicBtn.classList.add("active");
    setStatus("Listening...");
    voiceTranscript.textContent = "";
    voiceReply.classList.remove("visible");
  };

  rec.onresult = (e) => {
    let interim = "", final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    voiceTranscript.textContent = final || interim;
    if (final) sendVoiceMessage(final.trim());
  };

  rec.onerror = (e) => {
    if (e.error === "no-speech") setStatus("No speech detected. Try again.");
    else setStatus(`Error: ${e.error}`);
    resetOrbState();
  };

  rec.onend = () => {
    isListening = false;
    if (!isSpeaking) resetOrbState();
  };

  return rec;
}

// ── Start / Stop listening ─────────────────────────────────────────────────

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

voiceMicBtn.addEventListener("click", () => {
  if (isListening) stopListening();
  else startListening();
});

// ── Send to backend ────────────────────────────────────────────────────────

async function sendVoiceMessage(text) {
  stopListening();
  setStatus("Thinking...");
  voiceOrb.classList.remove("listening");
  voiceOrb.classList.add("speaking");
  voiceMicBtn.classList.remove("active");

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

    // Handle language switch
    if (data.lang && data.lang !== currentLang) {
      currentLang = data.lang;
      langCurrent.textContent = langNames[currentLang] || currentLang;
    }

    voiceReply.textContent = reply;
    voiceReply.classList.add("visible");
    speakReply(reply);

  } catch (err) {
    setStatus(`Error: ${err.message}`);
    resetOrbState();
  }
}

// ── Text to Speech ─────────────────────────────────────────────────────────

function speakReply(text) {
  window.speechSynthesis.cancel();
  isSpeaking = true;
  setStatus("Speaking...");

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang  = currentLang;
  utter.rate  = 1.0;
  utter.pitch = 1.05;

  // Pick best available voice for the language
  const voices = window.speechSynthesis.getVoices();
  const match  = voices.find(v => v.lang.startsWith(currentLang.split("-")[0]) && v.localService)
               || voices.find(v => v.lang.startsWith(currentLang.split("-")[0]));
  if (match) utter.voice = match;

  utter.onend = () => {
    isSpeaking = false;
    setStatus("Tap the mic to speak again");
    resetOrbState();
  };

  utter.onerror = () => {
    isSpeaking = false;
    resetOrbState();
  };

  window.speechSynthesis.speak(utter);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function setStatus(msg) { voiceStatus.textContent = msg; }

function resetOrbState() {
  voiceOrb.classList.remove("listening", "speaking");
  voiceMicBtn.classList.remove("active");
  isListening = false;
}

// Voices load async in some browsers
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
