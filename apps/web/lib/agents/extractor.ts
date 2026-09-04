import { generate } from "@pragati/shared";

/**
 * Extractor — turns an uploaded PDF or photo of a textbook chapter into
 * plain text, using Gemini's native document/vision input (no separate
 * OCR library or API). Deliberately not "grounded" in anything else, since
 * its whole job is to faithfully transcribe what's already there.
 */
export async function extractSourceText(base64: string, mimeType: string): Promise<string> {
  const system =
    "You are a text-extraction assistant for a school app. You will be given a document or photo — a textbook " +
    "chapter, which may be a clean PDF or a photo of a printed page taken with a phone camera. Transcribe its " +
    "educational content as plain text, as accurately and completely as possible. Preserve headings and " +
    "paragraph breaks using line breaks. Do not add commentary, summaries, opinions, or anything not actually " +
    "in the source — only transcribe what is there. If the image is blurry, rotated, or partly unreadable, " +
    "transcribe what you can and write [unclear] for the parts you can't. If the file has no readable " +
    "educational text at all, respond with exactly: EXTRACTION_FAILED";

  const raw = await generate({
    system,
    messages: [
      {
        role: "user",
        content: "Extract the text content from this file.",
        file: { base64, mimeType },
      },
    ],
    // The default 8192-token budget (packages/shared/src/llm.ts) is sized
    // for a bounded JSON schema (a chapter's worth of Notes/Explain/
    // Practice) — this call's output is a full-document transcription
    // instead, proportional to how long the source actually is, and a real
    // multi-page textbook chapter can legitimately need far more room.
    // Live-reproduced: a real 19-page Class 5 Math chapter PDF hit exactly
    // this ceiling and failed the whole upload with a truncation error.
    maxOutputTokens: 32768,
  });

  return raw.trim();
}
