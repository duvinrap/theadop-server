const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (req, res) => {
  res.send("THE ADOP AI Server is LIVE!");
});

app.get("/api/ai", (req, res) => {
  res.json({
    status: "READY",
    message: "THE ADOP AI Server is running!"
  });
});

app.post("/api/ai", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel"
      });
    }

    const userMessage =
      req.body?.message ||
      req.body?.prompt ||
      req.body?.text;

    if (!userMessage) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: userMessage
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API error"
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return res.status(500).json({
        error: "Gemini returned no response"
      });
    }

    res.json({
      reply: reply
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message || "AI server error"
    });
  }
});

module.exports = app;
