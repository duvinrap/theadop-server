const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('THE ADOP AI Server is LIVE! Use POST /api/ai');
});

app.get('/api/ai', (req, res) => {
  res.json({ status: 'READY', message: 'Server is running! Use POST request' });
});

app.post('/api/ai', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API Key not set in Vercel' });
    
    // Gemini call logic here...
    // For test:
    res.json({ reply: 'AI is working bro! 🔥' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = app;
