import Anthropic from "@anthropic-ai/sdk";
import { embedTexts } from "./embed.js";
import * as store from "./store.js";

const TOP_K = () => Number(process.env.TOP_K) || 6;
const MIN_SCORE = () => Number(process.env.MIN_SCORE) || 0.25;

export const NOT_FOUND_MESSAGE =
  "I couldn't find enough information about this in the provided knowledge base.";

// ---------- LLM provider setup ----------
// LLM_PROVIDER = gemini | ollama | anthropic  (any OpenAI-compatible API via LLM_BASE_URL)
const PROVIDER = () =>
  (
    process.env.LLM_PROVIDER ||
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : "gemini")
  ).toLowerCase();

const PRESETS = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
  },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
};

/** True when the selected provider is usable (ignores empty and placeholder keys). */
export const hasKey = () => {
  const p = PROVIDER();
  if (p === "ollama") return true;
  const k =
    p === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.LLM_API_KEY;
  return Boolean(k) && !k.includes("your_") && !k.includes("paste_");
};

let client;
const anthropic = () => (client ??= new Anthropic()); // reads ANTHROPIC_API_KEY

async function generate(system, messages) {
  if (PROVIDER() === "anthropic") {
    const response = await anthropic().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 1024,
      system,
      messages,
    });
    return response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  // OpenAI-compatible chat completions (Gemini, Ollama, Groq, OpenRouter, ...)
  const preset = PRESETS[PROVIDER()] || {};
  const baseUrl = process.env.LLM_BASE_URL || preset.baseUrl;
  const model = process.env.LLM_MODEL || preset.model;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LLM_API_KEY
        ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2048,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok)
    throw new Error(
      `LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

// ---------- Prompt ----------
const SYSTEM_PROMPT = `You are AI Mentor, a warm, practical mentor who teaches ONLY from the provided knowledge base.

RULES
1. Use ONLY the numbered context passages below. Never use outside knowledge, even if you know the answer.
2. Cite every claim with the passage number in square brackets, e.g. [1] or [2][3].
3. If the passages do not contain enough information to answer, reply with exactly "NOT_IN_KB" on the first line, followed by one short sentence saying what is missing.
4. If the question is only partly covered, answer the covered part and clearly state what the knowledge base does not cover.
5. If the user's situation is vague, you may ask ONE short clarifying question after giving whatever grounded guidance you can.
6. Tone: encouraging and advisory, like a mentor. Be concise. Plain text only, no markdown headings or bullet symbols; short paragraphs.`;

/** For short follow-ups ("give an example"), enrich the retrieval query with the previous question. */
function buildRetrievalQuery(messages) {
  const userTurns = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  const last = userTurns.at(-1) || "";
  const prev = userTurns.at(-2);
  return last.length < 60 && prev ? `${prev} ${last}` : last;
}

const toSource = (h, i) => ({
  n: i + 1,
  docName: h.docName,
  chapter: h.chapter,
  page: h.page,
  score: Number(h.score.toFixed(3)),
  text: h.text,
});

// ---------- Main RAG flow ----------
export async function answerQuestion(messages) {
  if (store.listDocuments().length === 0) {
    return {
      grounded: false,
      answer:
        "The knowledge base is empty. Upload at least one book or document first.",
      sources: [],
    };
  }

  // 1) Retrieve
  const query = buildRetrievalQuery(messages);
  const [queryEmbedding] = await embedTexts([query]);
  const hits = store.search(queryEmbedding, TOP_K());

  // Guardrail 1: retrieval is too weak, so refuse without calling the LLM.
  if (!hits.length || hits[0].score < MIN_SCORE()) {
    return { grounded: false, answer: NOT_FOUND_MESSAGE, sources: [] };
  }

  // Test mode: no usable key, so skip the LLM and show the retrieved passages.
  if (!hasKey()) {
    return {
      grounded: true,
      answer:
        "Test mode (no LLM key configured): showing the most relevant passages from your books. Add a key in server/.env to get written answers.",
      sources: hits.map(toSource),
    };
  }

  // 2) Generate from the retrieved context only
  const context = hits
    .map(
      (h, i) =>
        `[${i + 1}] (Source: ${h.docName} | ${h.chapter}${h.page ? ` | Page ${h.page}` : ""})\n${h.text}`,
    )
    .join("\n\n");

  const text = await generate(
    `${SYSTEM_PROMPT}\n\nCONTEXT PASSAGES\n${context}`,
    // Keep only the last few turns for follow-up context.
    messages.slice(-8).map(({ role, content }) => ({ role, content })),
  );

  // Guardrail 2: the model itself says the context is insufficient.
  if (text.startsWith("NOT_IN_KB")) {
    const reason = text.replace("NOT_IN_KB", "").trim();
    return {
      grounded: false,
      answer: `${NOT_FOUND_MESSAGE}${reason ? " " + reason : ""}`,
      sources: [],
    };
  }

  // 3) Return only the passages the model actually cited (fallback: everything retrieved).
  const cited = new Set(
    [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  );
  const sources = hits
    .map(toSource)
    .filter((s) => cited.size === 0 || cited.has(s.n));

  return { grounded: true, answer: text, sources };
}
