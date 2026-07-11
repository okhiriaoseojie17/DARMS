// src/lib/ai/gemini.ts
//
// Thin wrapper around Google's Gemini API. Requires GEMINI_API_KEY in env.
// Uses gemini-1.5-flash — free tier, large context window, and reads PDFs/
// images natively (no separate OCR step needed).
import type { GeminiPart } from "./fetchUploadContent";

// gemini-1.5-flash and the entire 1.x family are retired (shut down by
// Google in mid-2026). Using flash-lite here rather than the full flash
// model — quiz generation from a document is a structured, format-
// constrained task that doesn't need the extra reasoning depth, and
// flash-lite responds noticeably faster on the free tier.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class GeminiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "GeminiError";
  }
}

interface GenerateOptions {
  // 'json' forces structured output (used by quiz generation).
  // 'text' returns a plain conversational answer (used by ask mode).
  responseFormat?: "json" | "text";
  // Gemini 3.x models do an internal reasoning pass before responding by
  // default, which adds latency. For a structured, format-constrained task
  // like quiz generation, that reasoning buys little — set to 0 to skip it
  // and get a noticeably faster response. Left undefined (default behavior)
  // for cases where reasoning quality actually matters, like "ask" mode.
  thinkingBudget?: number;
}

export async function generateWithGemini(
  parts: GeminiPart[],
  options: GenerateOptions = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }

  const { responseFormat = "json", thinkingBudget } = options;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.7,
        ...(responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
        ...(thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget } } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new GeminiError(`Gemini API error: ${errText}`, response.status);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new GeminiError("Gemini returned no usable content");
  }

  return text;
}
