import { prisma, ExplainMode, ContentStatus } from "@pragati/db";
import { generate, extractJson, withBaseInstructions, type ContentScope } from "@pragati/shared";

export interface DiagramStep {
  icon: string;
  label: string;
  description: string;
}

export interface PictureDiagram {
  steps: DiagramStep[];
  /** connectors[i] labels the arrow from steps[i] to steps[i+1]; length is always steps.length - 1. */
  connectors: string[];
}

export interface ExplainVariant {
  mode: ExplainMode;
  body: string;
  diagram: PictureDiagram | null;
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
 * CLAUDE.md), and a follow-up "grid of cards" attempt didn't actually look
 * like a picture. The model instead writes an ordered sequence of 2-5 steps
 * (icon + label + one-sentence description) with a short label on each
 * arrow between them, which the UI renders as a real labeled flow diagram.
 * This is always accurate, since it's exactly what the model intends to
 * teach rather than a search result gambled on keyword overlap.
 *
 * `options.sourceText` grounds generation in a teacher-uploaded chapter
 * instead of the topic title alone (Phase 3); `options.status` lets that
 * path create content as `awaiting_review` instead of immediately
 * `published`. The existing-content lookup always filters to `published`
 * regardless, so an in-review draft can never leak to a student browsing
 * the same topic/scope.
 */
export async function getOrGenerateExplanations(
  topicId: string,
  scope: ContentScope,
  language: string,
  options?: { sourceText?: string; status?: ContentStatus },
): Promise<ExplainVariant[]> {
  const existing = await prisma.explanation.findMany({
    where: {
      topicId,
      board: scope.board,
      class: scope.class,
      schoolId: scope.schoolId,
      language,
      status: "published",
    },
  });
  if (existing.length === MODES.length) {
    return existing.map((e) => ({ mode: e.mode, body: e.body, diagram: e.diagram as unknown as PictureDiagram | null }));
  }

  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;

  const system = withBaseInstructions(
    "You are the Pedagogy Agent. Explain the same topic four different ways so every kind of learner finds one " +
      "that clicks — never just four rewordings of the same explanation. There is no real diagram image, so the " +
      "picture mode instead breaks the idea into an ordered sequence of 2-5 steps (like a flow diagram) — each " +
      "step has one emoji icon, a short label, and a one-sentence description, and each arrow between " +
      "consecutive steps has a short label describing that transition (e.g. \"blocks light\", \"heats up\"). " +
      "Make the sequence specific to this exact topic, never generic filler, and order it the way the process " +
      "or idea actually flows. " +
      (options?.sourceText
        ? "The source chapter text provided may cover multiple topics/concepts — ground every explanation " +
          "strictly in the source, but explain ONLY this specific topic, ignoring parts of the source about " +
          "other concepts in the same chapter. Never invent facts beyond the source. "
        : "") +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"story":"a short relatable narrative ' +
      'that introduces the idea","picture":"one short sentence introducing what the diagram below shows",' +
      '"pictureSteps":[{"icon":"single emoji","label":"short label","description":"one sentence"}, ...2 to 5],' +
      '"pictureConnectors":["short arrow label", ... exactly one fewer than pictureSteps],' +
      '"realworld":"how the concept shows up in daily life","gofurther":"a deeper insight for curious minds"}. ' +
      `Write all text in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.`,
  );

  const userContent = options?.sourceText
    ? `Topic: ${title}\n\nSource chapter text:\n${options.sourceText.slice(0, 30000)}`
    : `Topic: ${title}`;

  const raw = await generate({
    system,
    messages: [{ role: "user", content: userContent }],
    json: true,
  });

  const parsed = extractJson<{
    story: string;
    picture: string;
    pictureSteps: DiagramStep[];
    pictureConnectors: string[];
    realworld: string;
    gofurther: string;
  }>(raw);

  const bodies: Record<ExplainMode, string> = {
    story: parsed.story,
    picture: parsed.picture,
    realworld: parsed.realworld,
    gofurther: parsed.gofurther,
  };

  const diagram: PictureDiagram = { steps: parsed.pictureSteps, connectors: parsed.pictureConnectors };

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
          diagram: mode === "picture" ? (diagram as unknown as object) : undefined,
          status: options?.status ?? "published",
        },
      }),
    ),
  );

  return created.map((e) => ({ mode: e.mode, body: e.body, diagram: e.diagram as unknown as PictureDiagram | null }));
}
