const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const ROOT = path.resolve(__dirname, 'public');

const roles = {
  gameIdea: 'You are a professional game designer. Create original, practical game concepts with genre, core loop, mechanics, progression, art direction and a short pitch.',
  story: 'You are a game narrative designer. Build an original game story, characters, motivations, world, conflicts and mission hooks.',
  level: 'You are a level designer. Turn the user concept into a playable level/mission with objective, layout idea, encounters, rewards and progression.',
  npc: 'You are a game AI/NPC designer. Create useful NPC concepts including role, personality, behavior, dialogue hooks, AI states and gameplay purpose.',
  code: 'You are a senior game developer fluent in multiple languages and engines — GDScript (Godot), C# (Unity), C++/Blueprint (Unreal Engine), JavaScript (HTML5/Phaser), Python (Pygame), and Lua (LOVE2D). Always write code in the specific language/engine the user requests; if none is stated, default to Godot GDScript and say so. Provide safe, readable, complete code, explain where the script/file belongs, list required nodes/classes/imports, and avoid pretending untested code is guaranteed to work.',
  asset: 'You are a game art director. Create detailed, production-friendly prompts for game assets, characters, environments, UI and VFX.',
  gdd: 'You are a game producer. Turn the user idea into a concise mini Game Design Document covering vision, audience, gameplay, systems, story, levels, art, audio and development roadmap.'
};

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon'
};

function send(res, status, data, type='application/json') {
  res.writeHead(status, {
    'Content-Type': type.includes('charset') ? type : `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function ai(tool, prompt) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY is not configured on the server.');
  if (!roles[tool]) throw new Error(`Unknown AI tool: ${tool}`);
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new Error('Prompt is empty.');
  if (cleanPrompt.length > 20_000) throw new Error('Prompt is too long.');

  const userText = `${cleanPrompt}\n\nReturn a useful, structured answer. Be original and do not reproduce copyrighted game text.`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-goog-api-key': API_KEY},
    body: JSON.stringify({
      system_instruction: { parts: [{ text: roles[tool] }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed (${response.status}).`);
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return text || 'The AI returned no text.';
}

function safeFile(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const absolute = path.resolve(ROOT, `.${requested}`);
  if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) return null;
  return absolute;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');

    if (req.method === 'GET' && req.url === '/api/health') {
      return send(res, 200, {ok: true, aiConfigured: Boolean(API_KEY), model: MODEL});
    }

    if (req.method === 'POST' && req.url === '/api/ai') {
      const body = JSON.parse(await readBody(req) || '{}');
      const text = await ai(body.tool, body.prompt);
      return send(res, 200, {text});
    }

    if (req.method === 'GET') {
      const file = safeFile(req.url);
      if (!file) return send(res, 403, {error: 'Forbidden'});
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, {error: 'Not found'});
      const ext = path.extname(file).toLowerCase();
      return send(res, 200, fs.readFileSync(file), mime[ext] || 'application/octet-stream');
    }

    return send(res, 405, {error: 'Method not allowed'});
  } catch (error) {
    console.error(error);
    return send(res, 500, {error: error.message || 'Server error'});
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`The Adop V4 running on http://localhost:${PORT}`);
});
