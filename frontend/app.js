// app.js
// Frontend logic for the AI chatbot UI.
// Manages conversation history, sends requests to the FastAPI backend,
// and renders messages in the chat window.

const messagesEl = document.getElementById("messages");
const inputEl    = document.getElementById("userInput");
const sendBtn    = document.getElementById("sendBtn");
const clearBtn   = document.getElementById("clearBtn");

// Conversation history kept in memory (mirrors what backend receives)
let history = [];

// ── Helpers ────────────────────────────────────────────────────────────────

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role, text) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function showTyping() {
  const wrapper = document.createElement("div");
  wrapper.className = "message bot typing";
  wrapper.innerHTML = `<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function setLoading(loading) {
  sendBtn.disabled = loading;
  inputEl.disabled = loading;
}

// ── Send Message ───────────────────────────────────────────────────────────

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  // Render user message
  appendMessage("user", text);
  inputEl.value = "";
  inputEl.style.height = "auto";

  // Add to history
  history.push({ role: "user", content: text });

  setLoading(true);
  const typingEl = showTyping();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: history.slice(0, -1) }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Server error");
    }

    const data = await res.json();
    const reply = data.reply;

    // Add assistant reply to history
    history.push({ role: "assistant", content: reply });

    typingEl.remove();
    appendMessage("bot", reply);
  } catch (err) {
    typingEl.remove();
    appendMessage("bot", `Error: ${err.message}`);
  } finally {
    setLoading(false);
    inputEl.focus();
  }
}

// ── Event Listeners ────────────────────────────────────────────────────────

sendBtn.addEventListener("click", sendMessage);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea as user types
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
});

// Clear chat
clearBtn.addEventListener("click", () => {
  history = [];
  messagesEl.innerHTML = `
    <div class="message bot">
      <div class="bubble">Chat cleared. Ask me anything!</div>
    </div>`;
});
