import { prisma, ExplainMode } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, type ContentScope } from "@pragati/shared";

export interface PicturePanel {
  icon: string;
  title: string;
  description: string;
}

export interface ExplainVariant {
  mode: ExplainMode;
  body: string;
  panels: PicturePanel[] | null;
}

const MODES: ExplainMode[] = ["story", "picture", "realworld", "gofurther"];

/**
 * Pedagogy Agent — generates all four explanation modes for a topic in one
 * call, cached per scope+language like Notes. Only the *default selected
 * pane* is personalized per student (via PedagogyPreference/MisconceptionTag,
 * added in Phase 4) — the four explanations themselves are shared content.
 *
 * Picture mode has no real diagram image — an earlier attempt to source one
 * from Wikimedia Commons couldn't reliably return something *relevant* (see
 * CLAUDE.md), so the model instead writes 2-4 structured panels (an emoji
 * icon, a short title, a short description each) that the UI renders as
 * cards. This is always accurate, since it's exactly what the model intends
 * to teach rather than a search result gambled on keyword overlap.
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
    return existing.map((e) => ({ mode: e.mode, body: e.body, panels: e.panels as unknown as PicturePanel[] | null }));
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;

  const system = withBaseInstructions(
    "You are the Pedagogy Agent. Explain the same topic four different ways so every kind of learner finds one " +
      "that clicks — never just four rewordings of the same explanation. There is no real diagram image, so the " +
      "picture mode instead breaks the idea into 2-4 short labeled panels (like a simple infographic) — each " +
      "with one emoji icon, a short title, and a one-sentence description. Make the panels specific to this " +
      "exact topic, never generic filler. " +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"story":"a short relatable narrative ' +
      'that introduces the idea","picture":"one short sentence introducing what the panels below show",' +
      '"picturePanels":[{"icon":"single emoji","title":"short label","description":"one sentence"}, ...2 to 4 of these],' +
      '"realworld":"how the concept shows up in daily life","gofurther":"a deeper insight for curious minds"}. ' +
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
    picturePanels: PicturePanel[];
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
          panels: mode === "picture" ? (parsed.picturePanels as unknown as object) : undefined,
        },
      }),
    ),
  );

  return created.map((e) => ({ mode: e.mode, body: e.body, panels: e.panels as unknown as PicturePanel[] | null }));
}
