import { Hono } from "hono";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const chatRoutes = new Hono();

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama3-8b-8192";
function readGroqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;

  const root = process.cwd();
  const candidates = [
    path.join(root, "apikey"),
    path.join(root, "backend", "apikey"),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      return readFileSync(file, "utf-8").trim();
    }
  }
  return "";
}

const SYSTEM_PROMPT = [
  "Kamu adalah asisten AI (Copilot) untuk platform manajemen agensi konten kreator.",
  "Kamu membantu admin mengelola pengguna, tim, proyek, konten, akses, dan backup database.",
  "Jawab dengan ringkas, jelas, dan dalam bahasa Indonesia.",
].join(" ");

chatRoutes.post("/", async (c) => {
  try {
    const apiKey = readGroqKey();
    if (!apiKey) {
      return c.json(
        { status: "error", message: "Groq API key belum dikonfigurasi. Tambahkan ke file 'apikey' di root proyek." },
        500
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content) {
      return c.json({ status: "error", message: "Tidak ada pesan yang dikirim" }, 400);
    }

    const payload = {
      model: MODEL,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    };

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      return c.json(
        { status: "error", message: `Groq API error (${upstream.status}): ${errText.slice(0, 300)}` },
        upstream.status
      );
    }

    c.header("Content-Type", "text/event-stream");
    c.header("Cache-Control", "no-cache");
    c.header("Connection", "keep-alive");

    const reader = upstream.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") continue;

              let json;
              try {
                json = JSON.parse(data);
              } catch {
                continue;
              }

              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return c.body(stream);
  } catch (error) {
    return c.json({ status: "error", message: error.message }, 500);
  }
});

chatRoutes.get("/health", async (c) => {
  return c.json({ status: hasKey() ? "ok" : "missing-key" });
});

function hasKey() {
  return Boolean(readGroqKey());
}
