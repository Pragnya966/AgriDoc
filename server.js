const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8080);
const ROOT = process.cwd();

const AI_PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify(data));
}

function extractResponseText(data) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const textParts = [];

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function extractGeminiText(data) {
  const parts = data.candidates?.[0]?.content?.parts || [];

  return parts
    .map(part => part.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function fallbackAdvice() {
  return {
    title: "AI Advice",
    summary:
      "Live AI advice could not be formatted perfectly, so showing safe farmer-friendly guidance.",
    actions: [
      "Remove badly infected leaves and keep them away from the field.",
      "Avoid overhead watering because wet leaves can spread disease.",
      "Use crop protection only as recommended by a local agriculture officer."
    ],
    prevention:
      "Use disease-free seed, rotate crops, and keep enough spacing for airflow.",
    warning:
      "Follow local agricultural officer guidance before using any chemical treatment."
  };
}

function normalizeAdvice(parsed, rawText = "") {
  const fallback = fallbackAdvice();

  if (!parsed || typeof parsed !== "object") {
    return {
      ...fallback,
      summary: rawText || fallback.summary
    };
  }

  return {
    title: parsed.title || fallback.title,
    summary: parsed.summary || parsed.description || fallback.summary,
    actions:
      Array.isArray(parsed.actions) && parsed.actions.length
        ? parsed.actions.slice(0, 3).map(String)
        : fallback.actions,
    prevention:
      parsed.prevention ||
      parsed.preventive_measures ||
      parsed.preventiveMeasures ||
      fallback.prevention,
    warning: parsed.warning || fallback.warning
  };
}

function parseJsonText(text) {
  if (!text || typeof text !== "string") {
    return fallbackAdvice();
  }

  let cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    cleaned = match[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeAdvice(parsed, text);
  } catch (error) {
    console.warn("Could not parse AI JSON. Raw response:", text);
    return normalizeAdvice(null, text);
  }
}

function buildAdvicePrompt(disease, confidence, language) {
  return [
    "You are AgriDoctor, an agricultural assistant for tomato farmers.",
    `The local TensorFlow.js model detected: ${disease}.`,
    `Confidence: ${confidence}%.`,
    `Reply in ${language}.`,
    "Keep it practical and short for a farmer in the field.",
    "Return ONLY valid JSON. Do not use markdown. Do not use code fences. Do not write anything outside JSON.",
    "Use double quotes for all keys and string values.",
    "Use this exact JSON structure:",
    "{\"title\":\"string\",\"summary\":\"string\",\"actions\":[\"string\",\"string\",\"string\"],\"prevention\":\"string\",\"warning\":\"string\"}",
    "actions must be an array of exactly 3 short action strings.",
    "Do not recommend restricted chemicals or exact dosages.",
    "Tell the farmer to follow local agricultural officer guidance for chemical use."
  ].join("\n");
}

async function getOpenAiAdvice(prompt) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_api_key_here") {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt
    })
  });

  const data = await openaiResponse.json().catch(() => ({}));

  if (!openaiResponse.ok) {
    throw new Error(data.error?.message || "OpenAI request failed");
  }

  return parseJsonText(extractResponseText(data));
}

async function getGeminiAdvice(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_api_key_here") {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    }
  );

  const data = await geminiResponse.json().catch(() => ({}));

  if (!geminiResponse.ok) {
    throw new Error(data.error?.message || "Gemini request failed");
  }

  return parseJsonText(extractGeminiText(data));
}

async function getOllamaAdvice(prompt) {
  const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      format: "json"
    })
  });

  const data = await ollamaResponse.json().catch(() => ({}));

  if (!ollamaResponse.ok) {
    throw new Error(data.error || "Ollama request failed");
  }

  return parseJsonText(data.response || "");
}

async function handleAdvice(req, res) {
  try {
    const body = await readJsonBody(req);

    const disease = String(body.disease || "").slice(0, 80);
    const confidence = String(body.confidence || "").slice(0, 20);
    const language = body.language === "te" ? "Telugu" : "English";

    if (!disease) {
      sendJson(res, 400, {
        error: "Disease is required"
      });
      return;
    }

    const prompt = buildAdvicePrompt(disease, confidence, language);

    let advice;

    if (AI_PROVIDER === "openai") {
      advice = await getOpenAiAdvice(prompt);
    } else if (AI_PROVIDER === "ollama") {
      advice = await getOllamaAdvice(prompt);
    } else {
      advice = await getGeminiAdvice(prompt);
    }

    sendJson(res, 200, advice);
  } catch (err) {
    console.warn("AI advice generation failed:", err.message || err);

    sendJson(res, 500, {
      error: err.message || "Advice generation failed"
    });
  }
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(req.url.split("?")[0]);

  if (pathname === "/" || pathname === "") {
    pathname = "index.html";
  } else {
    pathname = pathname.replace(/^\/+/, "");
  }

  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const type =
      contentTypes[path.extname(filePath).toLowerCase()] ||
      "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": type
    });

    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/api/advice")) {
    handleAdvice(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`AgriDoctor running at http://localhost:${PORT}`);

  if (
    AI_PROVIDER === "gemini" &&
    GEMINI_API_KEY &&
    GEMINI_API_KEY !== "your_api_key_here"
  ) {
    console.log(`Live AI advice enabled with Gemini model ${GEMINI_MODEL}.`);
  } else if (AI_PROVIDER === "gemini") {
    console.log(
      "Live AI advice disabled. Set GEMINI_API_KEY before starting to enable Gemini."
    );
  } else if (AI_PROVIDER === "ollama") {
    console.log(`Live AI advice enabled with Ollama model ${OLLAMA_MODEL}.`);
    console.log(`Ollama URL: ${OLLAMA_URL}`);
  } else if (
    OPENAI_API_KEY &&
    OPENAI_API_KEY !== "your_api_key_here"
  ) {
    console.log(`Live AI advice enabled with ${OPENAI_MODEL}.`);
  } else {
    console.log(
      "Live AI advice disabled. Set GEMINI_API_KEY, OPENAI_API_KEY, or use AI_PROVIDER=ollama."
    );
  }
});