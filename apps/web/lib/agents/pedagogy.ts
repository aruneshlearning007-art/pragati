import { prisma, ExplainMode } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, type ContentScope } from "@pragati/shared";

export interface ExplainVariant {
  mode: ExplainMode;
  body: string;
  imageLabel: string | null;
}

const MODES: ExplainMode[] = ["story", "picture", "realworld", "gofurther"];

/**
 * Pedagogy Agent — generates all four explanation modes for a topic in one
 * call, cached per scope+language like Notes. Only the *default selected
 * pane* is personalized per student (via PedagogyPreference/MisconceptionTag,
 * added in Phase 4) — the four explanations themselves are shared content.
 */
export async function getOrGenerateExplanations(
  topicId: string,
  scope: ContentScope,
  language: string,
): Promise<ExplainVariant[]> {
  const existing = await prisma.explanation.findMany({
    where: { topicId, board: scope.board, class: scope.class, schoolId: scope.schoolId, language },
  });
  if (existing.length === MODES.length) {
    return existing.map((e) => ({ mode: e.mode, body: e.body, imageLabel: e.imageLabel }));
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;

  const system = withBaseInstructions(
    "You are the Pedagogy Agent. Explain the same topic four different ways so every kind of learner finds one " +
      "that clicks — never just four rewordings of the same explanation. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"story":"a short relatable narrative ' +
      'that introduces the idea","picture":"a description of a labeled diagram for visual learners, plus a short ' +
      'imageLabel caption for the diagram placeholder","realworld":"how the concept shows up in daily life",' +
      '"gofurther":"a deeper insight for curious minds"}. ' +
      `Write all text in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const raw = await generate({
    system,
    messages: [{ role: "user", content: `Topic: ${title}` }],
    json: true,
  });

  const parsed = extractJson<{
    story: string;
    picture: string;
    realworld: string;
    gofurther: string;
  }>(raw);

  const bodies: Record<ExplainMode, string> = {
    story: parsed.story,
    picture: parsed.picture,
    realworld: parsed.realworld,
    gofurther: parsed.gofurther,
  };

  const created = await Promise.all(
    MODES.map((mode) =>
      prisma.explanation.create({
        data: {
          topicId,
          board: scope.board,
          class: scope.class,
          schoolId: scope.schoolId,
          language,
          mode,
          body: bodies[mode],
          imageLabel: mode === "picture" ? "diagram illustrating the concept" : null,
        },
      }),
    ),
  );

  return created.map((e) => ({ mode: e.mode, body: e.body, imageLabel: e.imageLabel }));
}
