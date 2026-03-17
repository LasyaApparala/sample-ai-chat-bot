"""
voice.py
--------
Voice assistant logic using Groq LLaMA 3.3 70B.
Tuned for human-like, conversational, multilingual responses.
Language is auto-detected and can be switched mid-conversation.
"""

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

VOICE_SYSTEM_PROMPT = """You are Nova, a warm, intelligent, and highly conversational AI voice assistant.

PERSONALITY:
- Speak naturally like a real human friend — use contractions, casual phrasing, and natural flow
- Keep responses concise and conversational (2-4 sentences max unless asked for detail)
- Show empathy, curiosity, and personality — not robotic or formal
- Use filler transitions like "Sure!", "Great question!", "Absolutely!" sparingly and naturally
- Never use bullet points or markdown — speak in flowing sentences only

LANGUAGE:
- Detect the language the user is speaking and ALWAYS respond in that same language
- If the user says anything like "switch to Spanish", "habla español", "speak French", etc., immediately switch to that language and confirm the switch naturally
- Maintain the switched language for all future responses in this conversation

ACCURACY:
- Be factually accurate and honest
- If unsure, say so naturally: "Hmm, I'm not 100% sure about that, but..."
- Never make up facts

Remember: you are a VOICE assistant — your responses will be spoken aloud, so write as you would speak."""


def get_voice_response(user_message: str, history: list[dict]) -> dict:
    """
    Generate a human-like voice response.
    Returns the reply text and detected/switched language.
    """
    # Keep last 8 exchanges for voice context (enough without being too long)
    recent_history = history[-16:] if len(history) > 16 else history

    messages = [{"role": "system", "content": VOICE_SYSTEM_PROMPT}]
    messages.extend(recent_history)
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.7,       # Higher temp = more natural, human-like
        max_tokens=300,        # Keep voice responses short
        top_p=0.9,
    )

    reply = response.choices[0].message.content

    # Detect language switch instruction to pass back to frontend
    switch_keywords = {
        "spanish": "es-ES", "español": "es-ES", "espanol": "es-ES",
        "french": "fr-FR", "français": "fr-FR", "francais": "fr-FR",
        "german": "de-DE", "deutsch": "de-DE",
        "hindi": "hi-IN", "हिंदी": "hi-IN",
        "telugu": "te-IN", "తెలుగు": "te-IN",
        "tamil": "ta-IN", "தமிழ்": "ta-IN",
        "japanese": "ja-JP", "日本語": "ja-JP",
        "chinese": "zh-CN", "中文": "zh-CN",
        "arabic": "ar-SA", "عربي": "ar-SA",
        "portuguese": "pt-BR", "português": "pt-BR",
        "italian": "it-IT", "italiano": "it-IT",
        "english": "en-US",
    }

    detected_lang = None
    msg_lower = user_message.lower()
    for keyword, lang_code in switch_keywords.items():
        if keyword in msg_lower:
            detected_lang = lang_code
            break

    return {"reply": reply, "lang": detected_lang}
