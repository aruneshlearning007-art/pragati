// Single LLM provider entry point for every agent in the app. Today this
// calls the Gemini API (free tier for the pilot). Swapping providers later
// (e.g. to Claude) means rewriting only this file's body — no call site
// anywhere else in the app needs to change. Prompts will likely need
// re-tuning for a new provider's behavior at that point; that is expected,
// not hidden.

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
  /** Inline file (PDF or image) attached to this message — Gemini reads it natively, no separate OCR step. */
  file?: { base64: string; mimeType: string };
}

export interface GenerateOptions {
  system: string;
  messages: LlmMessage[];
  /** Ask the provider to constrain output to valid JSON. */
  json?: boolean;
}

// gemini-3.6-flash's free tier is capped at 20 requests/DAY (a hard wall
// that doesn't reset until the next day) — trivially exhausted by normal
// use across Notes/Explain/Practice/Doubt-chat. gemini-3.5-flash-lite's
// free tier is 15 requests/MINUTE instead, which recovers continuously and
// is far more usable for a pilot. Verified live against the real API
// before switching (see CLAUDE.md).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

export async function generate(options: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const contents = options.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: m.file
      ? [{ inline_data: { mime_type: m.file.mimeType, data: m.file.base64 } }, { text: m.content }]
      : [{ text: m.content }],
  }));

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: options.system }] },
  };

  if (options.json) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("");
}

// The model is instructed to write LaTeX math like \frac{1}{2} or
// \times inside JSON string values, but routinely forgets that a literal
// backslash must be double-escaped as \\ in JSON — it writes \f/\t instead
// of \\f/\\t. \f, \b, and \t are all valid single-char JSON escapes
// (form-feed, backspace, tab), so JSON.parse silently "succeeds" while
// eating the backslash: \frac{1}{2} decodes to a form-feed character
// followed by "rac{1}{2}", not the literal text "\frac{1}{2}" — and
// \times decodes to a tab followed by "imes". None of these three control
// characters is ever intentionally produced by any agent in this app, so
// it's safe to assume any \f/\b/\t in the raw response is a mis-escaped
// LaTeX command (\frac, \beta, \bmod, \times, \theta, \tan, ...) and
// repair it before parsing — the negative lookbehind avoids double-fixing
// a backslash that was already correctly escaped as \\f/\\b/\\t.
function repairLatexEscapes(jsonStr: string): string {
  return jsonStr.replace(/(?<!\\)\\([fbt])/g, "\\\\$1");
}

/** Pull the first {...} JSON object out of a raw model response and parse it. */
export function extractJson<T>(raw: string): T {
  let jsonStr = raw.trim();
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) {
    jsonStr = jsonStr.slice(start, end + 1);
  }
  return JSON.parse(repairLatexEscapes(jsonStr)) as T;
}
