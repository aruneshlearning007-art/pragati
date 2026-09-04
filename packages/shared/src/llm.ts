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
  /**
   * Overrides the default output budget (see the comment below) for a call
   * whose response is genuinely proportional to its input rather than a
   * bounded schema — e.g. transcribing a real multi-page document, where a
   * long chapter can legitimately need far more room than any generated
   * JSON content (Notes/Explain/Practice/beats) ever does.
   */
  maxOutputTokens?: number;
}

// gemini-3.6-flash's free tier is capped at 20 requests/DAY (a hard wall
// that doesn't reset until the next day) — trivially exhausted by normal
// use across Notes/Explain/Practice/Doubt-chat. gemini-3.5-flash-lite's
// free tier is 15 requests/MINUTE instead, which recovers continuously and
// is far more usable for a pilot. Verified live against the real API
// before switching (see CLAUDE.md).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// gemini-3.5-flash-lite's 15-requests/minute free tier recovers fast, but a
// single chapter concept already fires ~3-6 calls back to back (Notes +
// Explain + Practice concurrently, then the Verifier's own follow-up
// calls) — comfortably enough to trip the limit on its own, before
// counting any other student/teacher traffic hitting the same key at the
// same time. Retrying a 429 after a short wait rides out that per-minute
// window instead of surfacing a hard failure to whoever is waiting on a
// generation call (a teacher mid-upload, a student's Doubt-chat message).
const MAX_RETRIES = 3;

function parseRetryDelaySeconds(errText: string): number | null {
  const match = errText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? parseFloat(match[1]) : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // Without an explicit cap, Gemini falls back to a default output budget
  // that has, live, cut a response off mid-array/mid-string well before any
  // of these prompts' JSON would naturally end — surfacing as a cryptic
  // "Expected ',' or ']'"/"Unexpected end of JSON input" parse error with
  // no hint that truncation was the actual cause. None of this app's
  // responses (a chapter's worth of Notes/Explain/Practice, or a handful of
  // concept names) should ever need anywhere near this much room; set high
  // enough that hitting it is a real signal something is wrong, not routine.
  const generationConfig: Record<string, unknown> = { maxOutputTokens: options.maxOutputTokens ?? 8192 };
  if (options.json) {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: options.system }] },
    generationConfig,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  let lastError: Error = new Error("Gemini API call never attempted");
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      };
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new Error(
          "Gemini response was truncated (hit the output token limit) before finishing — the content generated so far is incomplete, not just malformed.",
        );
      }
      const parts = candidate?.content?.parts ?? [];
      return parts.map((p) => p.text ?? "").join("");
    }

    const errText = await response.text();
    lastError = new Error(`Gemini API error ${response.status}: ${errText}`);

    if (response.status !== 429 || attempt === MAX_RETRIES) {
      throw lastError;
    }
    const retryDelay = parseRetryDelaySeconds(errText) ?? 5;
    await sleep((retryDelay + 1) * 1000);
  }

  throw lastError;
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

// The model is instructed to write multi-paragraph text (e.g. self-explain
// feedback, doubt-chat replies) inside a JSON string value, separating
// paragraphs with a blank line — but it sometimes emits a literal newline
// byte instead of the required "\n" escape sequence. Raw control characters
// (anything below 0x20 — newline, carriage return, tab, etc.) are illegal
// inside a JSON string per spec, and JSON.parse rejects them outright
// ("Bad control character in string literal") rather than silently
// misparsing, unlike the \f/\b/\t case above. Walk the string tracking
// whether we're inside a quoted string (mirroring findMatchingBrace's own
// escape-aware scan) and escape any raw control character found there.
const CONTROL_CHAR_ESCAPES: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\b": "\\b",
  "\f": "\\f",
};

function escapeRawControlCharsInStrings(jsonStr: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (!inString) {
      if (ch === '"') inString = true;
      result += ch;
      continue;
    }
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = false;
      result += ch;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      result += CONTROL_CHAR_ESCAPES[ch] ?? "\\u" + code.toString(16).padStart(4, "0");
    } else {
      result += ch;
    }
  }
  return result;
}

// The model sometimes leaves a trailing comma before a closing "}" or "]"
// (e.g. the last item of an array/object followed by ",\n}") — valid in
// permissive parsers but rejected by strict JSON.parse with "Expected
// property name or '}'"/"Expected double-quoted property name" at the
// comma's position. Seen live twice with the identical error text (same
// line/column) on two unrelated chapters, which pointed at a structural
// formatting habit rather than random model noise. Walks the string
// tracking quote/escape state (same scan as escapeRawControlCharsInStrings)
// and drops any comma that — outside a string, skipping only whitespace —
// is immediately followed by "}" or "]".
function repairTrailingCommas(jsonStr: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (inString) {
      result += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < jsonStr.length && /\s/.test(jsonStr[j])) j++;
      if (jsonStr[j] === "}" || jsonStr[j] === "]") continue; // drop the comma
    }
    result += ch;
  }
  return result;
}

// Finds the index of the "}" that closes the object opened at `start`,
// tracking string literals (and escaped characters within them) so a "}"
// that's just part of a quoted string — or, more importantly, part of any
// trailing prose *after* the real JSON object — never gets mistaken for
// the real closing brace. Returns -1 if the braces never balance.
function findMatchingBrace(str: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Pull the first {...} JSON object out of a raw model response and parse
 * it. Despite being told to respond with strict JSON only, the model
 * sometimes wraps it in markdown fences or adds a trailing note — a naive
 * "first { to last }" slice breaks the moment any such trailing text
 * contains its own "}" (pulling in extra, non-JSON content and leaving
 * JSON.parse to choke on it), so this scans for the brace that actually
 * balances the first one instead of just grabbing the last one in the
 * whole string.
 */
export function extractJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  let jsonStr = trimmed;
  if (start >= 0) {
    const end = findMatchingBrace(trimmed, start);
    jsonStr = end > start ? trimmed.slice(start, end + 1) : trimmed.slice(start);
  }
  const repaired = repairLatexEscapes(escapeRawControlCharsInStrings(repairTrailingCommas(jsonStr)));
  try {
    return JSON.parse(repaired) as T;
  } catch (err) {
    // Diagnostic-only: log the raw text around the reported failure
    // position so a real occurrence in production can actually be
    // diagnosed from Vercel's logs instead of guessed at blind — the
    // three repairs above have each been added reactively from a live
    // failure, and guessing wrong twice in a row on the same error text
    // means the next one needs the real evidence, not another guess.
    const message = err instanceof Error ? err.message : String(err);
    const posMatch = message.match(/position (\d+)/);
    const pos = posMatch ? parseInt(posMatch[1], 10) : -1;
    const snippet = pos >= 0 ? repaired.slice(Math.max(0, pos - 120), pos + 120) : repaired.slice(0, 400);
    console.error(`extractJson failed: ${message}\n--- snippet around failure ---\n${snippet}\n--- end snippet ---`);
    throw err;
  }
}
