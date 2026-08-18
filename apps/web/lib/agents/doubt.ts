import { prisma } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, SAFETY_MODERATION_INSTRUCTION } from "@pragati/shared";

// After this many logged incidents for a student, doubt-chat stops calling
// the LLM entirely and just points them to a trusted adult — until Phase 5's
// parent dashboard exists to review and re-enable, this is a one-way gate by
// design (a false positive is a much smaller cost than a missed real one).
const AUTO_DISABLE_THRESHOLD = 3;

export interface DoubtMessageView {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface DoubtReplyResult {
  reply: string;
  flagged: boolean;
  disabled: boolean;
}

export async function getDoubtHistory(studentId: string, topicId: string): Promise<DoubtMessageView[]> {
  const messages = await prisma.doubtMessage.findMany({
    where: { studentId, topicId },
    orderBy: { timestamp: "asc" },
  });
  return messages.map((m) => ({ id: m.id, role: m.role, text: m.text }));
}

export async function isDoubtChatDisabled(studentId: string): Promise<boolean> {
  const incidentCount = await prisma.safetyIncident.count({ where: { studentId } });
  return incidentCount >= AUTO_DISABLE_THRESHOLD;
}

export async function answerDoubt(
  studentId: string,
  topicId: string,
  messageText: string,
  language: string,
): Promise<DoubtReplyResult> {
  if (await isDoubtChatDisabled(studentId)) {
    return {
      reply:
        language === "hi"
          ? "यह चैट अभी उपलब्ध नहीं है। कृपया अपने शिक्षक या माता-पिता से बात करें।"
          : "This chat isn't available right now. Please talk to your teacher or a parent.",
      flagged: false,
      disabled: true,
    };
  }

  await prisma.doubtMessage.create({
    data: { studentId, topicId, role: "user", text: messageText },
  });

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });

  const history = await getDoubtHistory(studentId, topicId);
  // Last 10 turns of context is enough continuity without unbounded token growth.
  const recentHistory = history.slice(-10);

  const system = withBaseInstructions(
    "You are the Doubt Chat Agent: a friendly study helper answering one student's question about a " +
      `specific topic they are currently studying. Subject: ${topic.chapter.subject.nameEn}. Topic: ${topic.titleEn}. ` +
      "Keep replies short (2-5 sentences), conversational, and focused on building understanding — not just " +
      "handing over an answer to copy. If the student's message is off-topic but harmless, respond briefly and " +
      "warmly, then gently steer back to the topic. " +
      `Write your reply in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.\n\n` +
      SAFETY_MODERATION_INSTRUCTION,
  );

  const raw = await generate({
    system,
    messages: recentHistory.map((m) => ({ role: m.role, content: m.text })),
    json: true,
  });

  const parsed = extractJson<{ flagged: boolean; category: string | null; reply: string }>(raw);

  await prisma.doubtMessage.create({
    data: { studentId, topicId, role: "assistant", text: parsed.reply, flagged: parsed.flagged },
  });

  if (parsed.flagged) {
    await prisma.safetyIncident.create({
      data: { studentId, messageText, category: parsed.category ?? "other" },
    });
  }

  return { reply: parsed.reply, flagged: parsed.flagged, disabled: false };
}
