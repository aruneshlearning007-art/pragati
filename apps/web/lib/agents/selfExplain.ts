import { prisma } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, SAFETY_MODERATION_INSTRUCTION, type ContentScope } from "@pragati/shared";
import { isDoubtChatDisabled } from "./doubt";
import { getOrGenerateNotes } from "./notes";

export interface SelfExplanationView {
  id: string;
  explanationText: string;
  feedbackText: string;
  timestamp: string;
}

export interface SelfExplainResult {
  feedback: string;
  flagged: boolean;
  disabled: boolean;
}

export async function getSelfExplanationHistory(studentId: string, topicId: string): Promise<SelfExplanationView[]> {
  const rows = await prisma.selfExplanation.findMany({
    where: { studentId, topicId },
    orderBy: { timestamp: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    explanationText: r.explanationText,
    feedbackText: r.feedbackText,
    timestamp: r.timestamp.toISOString(),
  }));
}

// Feynman technique: if a student can't explain a concept simply in their
// own words, they don't really understand it yet. Unlike the Practice quiz
// (right/wrong scoring), this agent never scores or grades — it gives
// qualitative feedback on what the student's own explanation got right and
// what's missing or confused, grounded in the topic's real Notes content.
export async function explainAndGetFeedback(
  studentId: string,
  topicId: string,
  explanationText: string,
  language: string,
  scope: ContentScope,
): Promise<SelfExplainResult> {
  // Reuses doubt-chat's safety gate — it already checks every SafetyIncident
  // for this student, not just ones from doubt-chat, so this is the correct
  // single gate rather than a second counter.
  if (await isDoubtChatDisabled(studentId)) {
    return {
      feedback:
        language === "hi"
          ? "यह सुविधा अभी उपलब्ध नहीं है। कृपया अपने शिक्षक या माता-पिता से बात करें।"
          : "This feature isn't available right now. Please talk to your teacher or a parent.",
      flagged: false,
      disabled: true,
    };
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });

  // Cache-first — never a second LLM call once Notes already exist for this scope.
  const { sections, keyTerms } = await getOrGenerateNotes(topicId, scope, language);
  const notesText = sections.map((s) => `${s.heading}: ${s.body}`).join("\n");
  const keyTermsText = keyTerms.map((k) => `${k.term} - ${k.meaning}`).join("; ");

  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;

  const system = withBaseInstructions(
    "You are the Self-Explain Agent, applying the Feynman technique: the student has just tried to " +
      `explain the concept "${title}" (Subject: ${topic.chapter.subject.nameEn}) in their own words, as if ` +
      "teaching it to someone else. Compare what they wrote against the reference notes below and give " +
      "constructive, qualitative feedback — NEVER a score, grade, or right/wrong verdict. Write exactly two " +
      "short paragraphs in the reply: the first names specifically what they explained well or got right " +
      "(be concrete, referencing their own words where you can); the second gently names what is missing, " +
      "unclear, or a misconception, and invites them to try explaining that part again in their own words. If " +
      "the explanation is already strong, the second paragraph can instead suggest one way to go deeper. " +
      "Separate the two paragraphs with a blank line. Do not use markdown formatting (no ** or #) since it " +
      "will render as plain text.\n\n" +
      `Reference notes for this topic:\n${notesText}\n\nKey terms: ${keyTermsText}\n\n` +
      `Write your reply in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.\n\n` +
      SAFETY_MODERATION_INSTRUCTION,
  );

  const raw = await generate({
    system,
    messages: [{ role: "user", content: explanationText }],
    json: true,
  });

  // Same exact 3-field contract as doubt.ts — kept unchanged so moderation stays reliable.
  const parsed = extractJson<{ flagged: boolean; category: string | null; reply: string }>(raw);

  await prisma.selfExplanation.create({
    data: {
      studentId,
      topicId,
      explanationText,
      feedbackText: parsed.reply,
      flagged: parsed.flagged,
    },
  });

  if (parsed.flagged) {
    await prisma.safetyIncident.create({
      data: { studentId, messageText: explanationText, category: parsed.category ?? "other" },
    });
  }

  return { feedback: parsed.reply, flagged: parsed.flagged, disabled: false };
}
