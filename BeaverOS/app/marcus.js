/* MarcusAI — BeaverOS agent powered by Gemini.
   Context-aware chat, actions, and full voice mode:
   mic audio goes straight to Gemini (multimodal), replies are spoken via TTS. */

import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TTS_MODEL, GEMINI_VOICE, isMarcusConfigured } from './marcus-config.js?v=2';

let moduleApi, user, toast;
let history = [];
let busy = false;

let mediaRecorder = null;
let recChunks = [];
let recording = false;

const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SYSTEM_PROMPT = `You are Marcus, the AI ops agent inside BeaverOS — the personal command center of your operator.
Personality: sharp, loyal, a little dry. You call the user "boss" occasionally. Keep answers short and conversational — this is an ops console, and your replies may be read aloud, so no markdown formatting, no bullet symbols, no asterisks.

You receive a CONTEXT block with the operator's live data (school deadlines, projects, hobbies, calendar). Use it to give grounded answers about their week, priorities, and workload.

VOICE MESSAGES: If the user turn is audio, the FIRST line of your reply must be exactly:
[heard] <verbatim transcript of what they said>
Then continue your normal reply on the next line.

ACTIONS: When the operator asks you to add something, append an action block at the VERY END of your reply, formatted exactly like this:

\`\`\`action
{"type":"addSchool","title":"Physics lab report","course":"Physics","due":"2026-07-10"}
\`\`\`

Available actions (one JSON object per block, up to 3 blocks per reply):
- {"type":"addSchool","title":"...","course":"...","due":"YYYY-MM-DD"}
- {"type":"addProject","name":"..."}
- {"type":"addHobby","name":"..."}
- {"type":"addEvent","title":"...","date":"YYYY-MM-DD","time":"HH:MM"}
- {"type":"remember","text":"..."}

MEMORY: When the operator shares durable personal facts, preferences, goals, or context you should recall in future chats, save them with remember. Examples: favorite subjects, work schedule, how they like reminders, long-term goals. Do not remember transient tasks already in CONTEXT. If they say "remember that…" always use remember.

Rules: resolve relative dates ("Friday", "tomorrow") to real YYYY-MM-DD dates using today's date from context. If you are unsure what to add, ask instead of guessing. Never invent data that is not in context.`;

/* ---------- Orb + status ---------- */

function setState(state, label) {
  const orb = $('marcus-orb');
  const stateEl = $('marcus-state');
  if (orb) {
    orb.classList.remove('is-listening', 'is-thinking', 'is-speaking');
    if (state) orb.classList.add('is-' + state);
  }
  if (stateEl) {
    stateEl.textContent = label ||
      (state === 'listening' ? 'Listening…' :
       state === 'thinking' ? 'Processing…' :
       state === 'speaking' ? 'Speaking' : 'Standing by');
  }
}

/* ---------- Chat rendering ---------- */

function appendMessage(who, text, actionNotes) {
  const wrap = $('marcus-messages');
  if (!wrap) return null;

  const div = document.createElement('div');
  div.className = 'beaver-msg ' + (who === 'user' ? 'beaver-msg--user' : 'beaver-msg--ai');
  div.innerHTML =
    '<span class="beaver-msg__who">' + (who === 'user' ? 'YOU' : 'MARCUS') + '</span>' +
    '<p>' + esc(text) + '</p>' +
    (actionNotes || []).map((n) => '<span class="beaver-msg__action">✓ ' + esc(n) + '</span>').join(' ');
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

function appendThinking() {
  const wrap = $('marcus-messages');
  const div = document.createElement('div');
  div.className = 'beaver-msg beaver-msg--ai beaver-msg--thinking';
  div.innerHTML = '<span class="beaver-msg__who">MARCUS</span><p class="beaver-dots"><i></i><i></i><i></i></p>';
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

/* ---------- Natural voice (Gemini TTS) ---------- */

let currentAudio = null;

function voiceEnabled() {
  const toggle = $('marcus-voice-toggle');
  return toggle ? toggle.checked : false;
}

function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function pcmBase64ToWavBlob(b64, sampleRate) {
  const raw = atob(b64);
  const pcm = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) pcm[i] = raw.charCodeAt(i);

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, pcm.length, true);

  return new Blob([header, pcm], { type: 'audio/wav' });
}

async function callGeminiTts(text) {
  const spoken = text.slice(0, 1200);
  const body = {
    contents: [{ parts: [{ text: 'Speak as Marcus, a calm sharp ops agent. Conversational, not theatrical:\n' + spoken }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: GEMINI_VOICE }
        }
      }
    }
  };

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_TTS_MODEL + ':generateContent?key=' + GEMINI_API_KEY,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error && errBody.error.message ? errBody.error.message : 'TTS HTTP ' + res.status);
  }

  const data = await res.json();
  const part = data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0];

  if (!part || !part.inlineData || !part.inlineData.data) {
    throw new Error('No audio in TTS response');
  }

  const mime = part.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000';
  const rateMatch = mime.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
  return pcmBase64ToWavBlob(part.inlineData.data, sampleRate);
}

async function speak(text) {
  if (!voiceEnabled() || !text || !isMarcusConfigured()) return;

  stopSpeaking();
  const clean = text.replace(/\[heard\][^\n]*\n?/g, '').replace(/[*_`#>]/g, '').trim();
  if (!clean) return;

  try {
    const blob = await callGeminiTts(clean);
    const url = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.onplay = () => setState('speaking');
    currentAudio.onended = () => {
      setState(null);
      URL.revokeObjectURL(url);
      currentAudio = null;
    };
    currentAudio.onerror = () => {
      setState(null);
      URL.revokeObjectURL(url);
      currentAudio = null;
    };
    await currentAudio.play();
  } catch (err) {
    setState(null);
    console.warn('Marcus TTS failed:', err.message);
  }
}

/* ---------- Gemini ---------- */

async function callGemini(contents) {
  const context = moduleApi.marcusContext();

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT + '\n\nCONTEXT:\n' + context }]
    },
    contents: contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 800 }
  };

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error && errBody.error.message ? errBody.error.message : 'HTTP ' + res.status);
  }

  const data = await res.json();
  return data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts
    ? data.candidates[0].content.parts.map((p) => p.text || '').join('')
    : 'No response.';
}

async function runActions(reply) {
  const notes = [];
  const regex = /```action\s*([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(reply)) !== null && notes.length < 3) {
    try {
      const action = JSON.parse(match[1].trim());
      const handler = moduleApi.marcusActions[action.type];
      if (handler) notes.push(await handler(action));
    } catch (err) {
      notes.push('Action failed: ' + err.message);
    }
  }

  const cleanText = reply.replace(regex, '').trim();
  return { cleanText, notes };
}

function trimHistory() {
  if (history.length > 20) history = history.slice(-20);
}

async function persistChat() {
  if (!moduleApi.marcusSaveChat) return;
  const messages = history.map((h) => ({
    role: h.role,
    text: h.parts.map((p) => p.text || '').join('')
  }));
  try {
    await moduleApi.marcusSaveChat(messages);
  } catch (err) {
    console.warn('Marcus chat save failed:', err.message);
  }
}

function restoreChatFromSaved(saved) {
  const wrap = $('marcus-messages');
  if (!wrap || !saved.length) return;

  wrap.innerHTML = '';
  history = [];

  saved.forEach((row) => {
    const role = row.role === 'user' ? 'user' : 'model';
    const text = row.text || '';
    if (!text) return;
    history.push({ role: role, parts: [{ text: text }] });
    appendMessage(role === 'user' ? 'user' : 'ai', text);
  });
}

/* ---------- Text flow ---------- */

async function sendText(text) {
  busy = true;
  setState('thinking');
  appendMessage('user', text);
  const thinking = appendThinking();

  history.push({ role: 'user', parts: [{ text: text }] });
  trimHistory();

  try {
    const reply = await callGemini(history);
    history.push({ role: 'model', parts: [{ text: reply }] });
    const { cleanText, notes } = await runActions(reply);
    thinking.remove();
    appendMessage('ai', cleanText || '(done)', notes);
    if (notes.length) toast(notes[0]);
    setState(null);
    await persistChat();
    speak(cleanText);
  } catch (err) {
    thinking.remove();
    setState(null);
    appendMessage('ai', 'Something broke on my end: ' + err.message);
  } finally {
    busy = false;
  }
}

/* ---------- Voice flow ---------- */

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function sendVoice(blob) {
  busy = true;
  setState('thinking');
  const userMsg = appendMessage('user', '🎙 Voice message…');
  const thinking = appendThinking();

  try {
    const b64 = await blobToBase64(blob);

    const contents = history.concat([{
      role: 'user',
      parts: [
        { inlineData: { mimeType: blob.type || 'audio/webm', data: b64 } },
        { text: '(voice message — remember to start your reply with the [heard] transcript line)' }
      ]
    }]);

    const reply = await callGemini(contents);

    // Extract the transcript line
    let transcript = '';
    const heardMatch = reply.match(/^\s*\[heard\]\s*(.*)$/m);
    if (heardMatch) transcript = heardMatch[1].trim();

    if (userMsg && transcript) {
      userMsg.querySelector('p').textContent = transcript;
    }

    // Store as plain text in history (no audio re-sending)
    history.push({ role: 'user', parts: [{ text: transcript || '(voice message)' }] });
    const replyWithoutHeard = reply.replace(/^\s*\[heard\][^\n]*\n?/m, '').trim();
    history.push({ role: 'model', parts: [{ text: replyWithoutHeard }] });
    trimHistory();

    const { cleanText, notes } = await runActions(replyWithoutHeard);
    thinking.remove();
    appendMessage('ai', cleanText || '(done)', notes);
    if (notes.length) toast(notes[0]);
    setState(null);
    await persistChat();
    speak(cleanText);
  } catch (err) {
    thinking.remove();
    setState(null);
    if (userMsg) userMsg.querySelector('p').textContent = '🎙 Voice message (failed)';
    appendMessage('ai', 'I couldn\'t process that audio: ' + err.message);
  } finally {
    busy = false;
  }
}

async function toggleRecording() {
  const micBtn = $('marcus-mic');

  if (recording) {
    recording = false;
    micBtn.classList.remove('is-rec');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    return;
  }

  if (busy) return;

  if (!isMarcusConfigured()) {
    toast('Marcus needs a Gemini API key first', true);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stopSpeaking();

    recChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

    mediaRecorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setState(null);
      const blob = new Blob(recChunks, { type: 'audio/webm' });
      if (blob.size > 2000) sendVoice(blob);
      else toast('Too short — hold the thought a bit longer', true);
    };

    mediaRecorder.start();
    recording = true;
    micBtn.classList.add('is-rec');
    setState('listening');
  } catch (err) {
    toast('Microphone unavailable: ' + err.message, true);
  }
}

/* ---------- Init ---------- */

export async function initMarcus(api, currentUser, showToast) {
  moduleApi = api;
  user = currentUser;
  toast = showToast;

  const form = $('marcus-form');
  const input = $('marcus-input');
  const status = $('marcus-status');
  const micBtn = $('marcus-mic');

  setState(null);

  if (moduleApi.marcusLoadChat) {
    try {
      const saved = await moduleApi.marcusLoadChat();
      if (saved.length) restoreChatFromSaved(saved);
    } catch (err) {
      console.warn('Marcus chat load failed:', err.message);
    }
  }

  if (!isMarcusConfigured()) {
    if (status) status.textContent = 'API key needed';
    setState(null, 'Offline');
    appendMessage('ai',
      'One more step to wake me up, boss: get a free Gemini API key at aistudio.google.com ' +
      '("Get API key" → "Create API key") and paste it into BeaverOS/app/marcus-config.js. Then restart the app.');
  } else if (status) {
    status.textContent = 'AI agent · natural voice';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;

    if (!isMarcusConfigured()) {
      toast('Marcus needs a Gemini API key — see marcus-config.js', true);
      return;
    }

    input.value = '';
    stopSpeaking();
    sendText(text).then(() => input.focus());
  });

  if (micBtn) micBtn.addEventListener('click', toggleRecording);

  const voiceToggle = $('marcus-voice-toggle');
  if (voiceToggle) {
    voiceToggle.addEventListener('change', () => {
      if (!voiceToggle.checked) stopSpeaking();
    });
  }
}
