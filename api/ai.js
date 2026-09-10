// Vercel serverless function: POST /api/ai
// Uses Google's Gemini API, which has a free tier (no credit card needed).
// Get a free key at https://aistudio.google.com/apikey and set it as
// GEMINI_API_KEY in Vercel Project Settings -> Environment Variables.

const roles = {
  gameIdea: 'You are a professional game designer. Create original, practical game concepts with genre, core loop, mechanics, progression, art direction and a short pitch.',
  story: 'You are a game narrative designer. Build an original game story, characters, motivations, world, conflicts and mission hooks.',
  level: 'You are a level designer. Turn the user concept into a playable level/mission with objective, layout idea, encounters, rewards and progression.',
  npc: 'You are a game AI/NPC designer. Create useful NPC concepts including role, personality, behavior, dialogue hooks, AI states and gameplay purpose.',
  code: 'You are a senior game developer fluent in multiple languages and engines — GDScript (Godot), C# (Unity), C++/Blueprint (Unreal Engine), JavaScript (HTML5/Phaser), Python (Pygame), and Lua (LOVE2D). Always write code in the specific language/engine the user requests; if none is stated, default to Godot GDScript and say so. Provide safe, readable, complete code, explain where the script/file belongs, list required nodes/classes/imports, and avoid pretending untested code is guaranteed to work.',
  asset: 'You are a game art director. Create detailed, production-friendly prompts for game assets, characters, environments, UI and VFX.',
  gdd: 'You are a game producer. Turn the user idea into a concise mini Game Design Document covering vision, audience, gameplay, systems, story, levels, art, audio and development roadmap.'
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel may already parse it
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch (_) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    if (!API_KEY) throw new Error('GEMINI_API_KEY is not configured on the server.');

    const body = await readJsonBody(req);
    const tool = body.tool;
    const prompt = body.prompt;
    if (!roles[tool]) throw new Error(`Unknown AI tool: ${tool}`);
    const cleanPrompt = String(prompt || '').trim();
    if (!cleanPrompt) throw new Error('Prompt is empty.');
    if (cleanPrompt.length > 20_000) throw new Error('Prompt is too long.');

    const userText = `${cleanPrompt}\n\nReturn a useful, structured answer. Be original and do not reproduce copyrighted game text.`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: roles[tool] }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed (${response.status}).`);

    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return res.status(200).json({ text: text || 'The AI returned no text.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};
