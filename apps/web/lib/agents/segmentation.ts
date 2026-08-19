import { generate, extractJson, withBaseInstructions } from "@pragati/shared";

export interface ConceptSegment {
  title: string;
  subConcepts: string[];
}

const MAX_CONCEPTS = 6;

/**
 * Segmentation Agent — teacher-upload path only. Reads a whole chapter's
 * source text and identifies the distinct concepts inside it, so each one
 * can become its own Topic with its own Notes/Explain/Practice/Video,
 * instead of the whole chapter being generated as one undifferentiated
 * blob. Returns names only (concept titles + a handful of sub-concept
 * names each), never reproduced text excerpts — reproducing large verbatim
 * excerpts is expensive and error-prone, while naming a handful of concepts
 * is cheap and reliable. Each concept's own Notes/Explain/Practice call is
 * given the full source text again plus this concept's title, and finds
 * the relevant part itself (LLMs are reliably good at that).
 */
export async function segmentIntoConcepts(
  sourceText: string,
  subjectName: string,
  cls: string,
  language: string,
): Promise<ConceptSegment[]> {
  const system = withBaseInstructions(
    "You are the Segmentation Agent. You are given the full text of one school chapter. Identify the distinct " +
      "concepts it teaches — each concept should be substantial enough to deserve its own notes, explanation, " +
      "and quiz, not a single sentence or minor aside. Merge small or closely related points into the nearest " +
      "major concept rather than over-splitting; a typical chapter has 2-6 concepts. For each concept, also " +
      "name 2-4 sub-concepts — the finer-grained understanding checkpoints within that concept, used for " +
      "tracking what a student has and hasn't mastered. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"concepts":[{"title":"string",' +
      '"subConcepts":["string", ...2 to 4]}, ...2 to 6]}. ' +
      `Write all titles/names in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const userContent = `Subject: ${subjectName}\nClass: ${cls}\n\nSource chapter text:\n${sourceText.slice(0, 30000)}`;

  const raw = await generate({
    system,
    messages: [{ role: "user", content: userContent }],
    json: true,
  });

  const parsed = extractJson<{ concepts: ConceptSegment[] }>(raw);
  const concepts = parsed.concepts.filter((c) => c.title?.trim()).slice(0, MAX_CONCEPTS);

  return concepts.length > 0 ? concepts : [{ title: "Overview", subConcepts: [] }];
}
