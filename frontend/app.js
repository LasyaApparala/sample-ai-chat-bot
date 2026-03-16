// app.js - AI Chatbot with user auth + MongoDB session persistence

// ── State ──────────────────────────────────────────────────────────────────
let token            = localStorage.getItem("token") || null;
let currentUser      = localStorage.getItem("username") || null;
let currentSessionId = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const authScreen  = document.getElementById("authScreen");
const chatApp     = document.getElementById("chatApp");
const messagesEl  = document.getElementById("messages");
const emptyState  = document.getElementById("emptyState");
const inputEl     = document.getElementById("userInput");
const sendBtn     = document.getElementById("sendBtn");
const clearBtn    = document.getElementById("clearBtn");
const sidebarHist = document.getElementById("sidebarHistory");

// ── Auth tab switch ────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById("loginForm").classList.toggle("hidden",    tab !== "login");
  document.getElementById("registerForm").classList.toggle("hidden", tab !== "register");
  document.getElementById("tabLogin").classList.toggle("active",     tab === "login");
  document.getElementById("tabReg").classList.toggle("active",       tab === "register");
}

// ── Auth handlers ──────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  const username = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value;

  try {
    const res  = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    saveAuth(data.token, data.username);
    enterChat();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById("registerError");
  errEl.textContent = "";
  const username = document.getElementById("regUser").value.trim();
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPass").value;

  try {
    const res  = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    saveAuth(data.token, data.username);
    enterChat();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function saveAuth(t, u) {
  token = t; currentUser = u;
  localStorage.setItem("token", t);
  localStorage.setItem("username", u);
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  token = null; currentUser = null;
  chatApp.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

// ── Enter chat ─────────────────────────────────────────────────────────────
function enterChat() {
  authScreen.classList.add("hidden");
  chatApp.classList.remove("hidden");
  document.getElementById("usernameLabel").textContent = currentUser;
  document.getElementById("userAvatar").textContent = currentUser[0].toUpperCase();
  startNewSession();
  loadSidebar();
}

// ── Session helpers ────────────────────────────────────────────────────────
function generateId() { return crypto.randomUUID(); }

function startNewSession() {
  currentSessionId = generateId();
  showEmpty();
  inputEl.focus();
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

function hideEmpty() {
  emptyState.style.display = "none";
  messagesEl.style.display = "flex";
}

function showEmpty() {
  emptyState.style.display = "flex";
  messagesEl.style.display = "none";
  messagesEl.innerHTML = "";
}

function appendMessage(role, text) {
  const row    = document.createElement("div");
  row.className = `msg-row ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? currentUser[0].toUpperCase() : "✦";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.innerHTML = `<div class="avatar">✦</div>
    <div class="bubble typing-bubble">
      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
    </div>`;
  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function setLoading(on) { sendBtn.disabled = on; inputEl.disabled = on; }

// ── Sidebar ────────────────────────────────────────────────────────────────
async function loadSidebar() {
  try {
    const res = await fetch("/sessions", { headers: authHeader() });
    if (!res.ok) return;
    const sessions = await res.json();
    sidebarHist.innerHTML = "";
    sessions.forEach(s => renderSidebarItem(s.session_id, s.title));
  } catch (_) {}
}

function renderSidebarItem(sessionId, title) {
  if (document.querySelector(`[data-sid="${sessionId}"]`)) return;
  const item = document.createElement("div");
  item.className = "history-item";
  item.dataset.sid = sessionId;
  item.textContent = (title || "New Chat").slice(0, 40);
  item.addEventListener("click", () => loadSessionMessages(sessionId));
  sidebarHist.prepend(item);
}

async function loadSessionMessages(sessionId) {
  try {
    const res = await fetch(`/sessions/${sessionId}`, { headers: authHeader() });
    if (!res.ok) return;
    const session = await res.json();
    currentSessionId = sessionId;
    messagesEl.innerHTML = "";
    hideEmpty();
    session.messages.forEach(m =>
      appendMessage(m.role === "assistant" ? "bot" : "user", m.content)
    );
  } catch (_) {}
}

// ── Send message ───────────────────────────────────────────────────────────
async function sendMessage(text) {
  text = (text || inputEl.value).trim();
  if (!text || !token) return;

  if (!currentSessionId) currentSessionId = generateId();

  hideEmpty();
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;

  appendMessage("user", text);
  renderSidebarItem(currentSessionId, text);

  setLoading(true);
  const typingEl = showTyping();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ session_id: currentSessionId, message: text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Server error");
    typingEl.remove();
    appendMessage("bot", data.reply);
  } catch (err) {
    typingEl.remove();
    appendMessage("bot", `Error: ${err.message}`);
  } finally {
    setLoading(false);
    inputEl.focus();
  }
}

function authHeader() {
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

// ── Events ─────────────────────────────────────────────────────────────────
sendBtn.addEventListener("click", () => sendMessage());

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

inputEl.addEventListener("input", () => {
  sendBtn.disabled = inputEl.value.trim() === "";
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
});

clearBtn.addEventListener("click", () => startNewSession());

document.querySelectorAll(".suggestion").forEach(btn => {
  btn.addEventListener("click", () => sendMessage(btn.dataset.text));
});

// ── Init ───────────────────────────────────────────────────────────────────
if (token && currentUser) {
  enterChat();   // auto-login if token exists in localStorage
} else {
  authScreen.classList.remove("hidden");
  chatApp.classList.add("hidden");
}
