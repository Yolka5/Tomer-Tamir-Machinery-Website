// ============================================================
// MarcusAI — Gemini API configuration
//
// 1. Copy this file to marcus-config.js
// 2. Go to https://aistudio.google.com and sign in with Google
// 3. Click "Get API key" → "Create API key"
// 4. Paste the key below
//
// The free tier is plenty for personal use.
// ============================================================

export const GEMINI_API_KEY = "PASTE_YOUR_GEMINI_API_KEY_HERE";
export const GEMINI_MODEL = "gemini-flash-latest";

// Natural voice via Gemini native TTS (not browser robot TTS).
export const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const GEMINI_VOICE = "Charon"; // calm, informative — see Google TTS voice list

export function isMarcusConfigured() {
  return !String(GEMINI_API_KEY).includes("PASTE");
}
