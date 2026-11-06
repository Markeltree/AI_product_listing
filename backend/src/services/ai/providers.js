// HTTP clients for the AI providers. Each vision call takes a prompt plus base64 images
// ({ mediaType, data }) and returns the model's raw text.
import fs from 'node:fs/promises';
import { config } from '../../config/index.js';
import { fetchWithRetry } from '../../utils/http.js';
import { SYSTEM_PROMPT } from './prompts.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENAI_URL = 'https://api.openai.com/v1';
const TIMEOUT_MS = 180_000;

async function postJson(provider, url, headers, body) {
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, { service: provider, timeoutMs: TIMEOUT_MS });
  if (!res.ok) throw new Error(`${provider} API error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export async function callAnthropic(prompt, images, { maxTokens = 2500 } = {}) {
  const content = [
    ...images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } })),
    { type: 'text', text: prompt },
  ];
  const json = await postJson(
    'Anthropic',
    ANTHROPIC_URL,
    { 'x-api-key': config.anthropic.apiKey, 'anthropic-version': '2023-06-01' },
    { model: config.anthropic.model, max_tokens: maxTokens, system: SYSTEM_PROMPT, messages: [{ role: 'user', content }] },
  );
  return json.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

export async function callOpenAI(prompt, images) {
  const content = [
    ...images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.data}` } })),
    { type: 'text', text: prompt },
  ];
  const json = await postJson(
    'OpenAI',
    `${OPENAI_URL}/chat/completions`,
    { Authorization: `Bearer ${config.openai.apiKey}` },
    {
      model: config.openai.model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content }],
    },
  );
  return json.choices?.[0]?.message?.content || '';
}

// Voice note -> text with OpenAI Whisper. Returns null when OpenAI is not configured or nothing was said.
export async function transcribeAudio(filePath, filename, mime) {
  if (!config.openai.apiKey) return null;
  const form = new FormData();
  form.append('file', new Blob([await fs.readFile(filePath)], { type: mime || 'audio/webm' }), filename || 'voice-note.webm');
  form.append('model', config.openai.transcribeModel);
  const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.openai.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
  const json = await res.json();
  return String(json.text || '').trim() || null;
}
