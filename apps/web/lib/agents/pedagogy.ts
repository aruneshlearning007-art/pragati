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

export interface WorkedExampleStep {
  explanation: string;
  work: string;
}

export interface WorkedExample {
  problem: string;
  steps: WorkedExampleStep[];
  answer: string;
}

export interface MathGraphPoint {
  x: number;
  y: number;
  label: string;
}

export interface FunctionVisual {
  kind: "function";
  title: string;
  /** mathjs-compatible expression in terms of x, e.g. "x^2 + 2*x - 3". */
  expression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  points?: MathGraphPoint[];
}

export interface NumberLineVisual {
  kind: "numberline";
  title: string;
  min: number;
  max: number;
  /** label is a short descriptive name (e.g. "A", or a fraction/decimal as text) — never the value restated, since the value itself is always shown separately. */
  points: { value: number; label: string }[];
  highlightRange?: { from: number; to: number };
}

export interface FractionBarVisual {
  kind: "fractionbar";
  title: string;
  numerator: number;
  denominator: number;
  /** For comparing/showing equivalence against a second fraction. */
  secondFraction?: { numerator: number; denominator: number };
}

export interface GeometryVisual {
  kind: "geometry";
  title: string;
  shape: "triangle" | "square" | "rectangle" | "parallelogram" | "circle";
  /** Only meaningful when shape is "triangle" — picks which canonical layout to draw. */
  triangleType?: "equilateral" | "isosceles" | "scalene" | "right";
  /** One label per side, in vertex order; empty string/omitted = don't label that side. Not used for "circle". */
  sideLabels?: string[];
  /** One label per interior angle, in vertex order; empty string/omitted = don't label that angle. Not used for "circle". */
  angleLabels?: string[];
  /** Only for "circle". */
  radiusLabel?: string;
  showCenter?: boolean;
}

export type MathVisual = FunctionVisual | NumberLineVisual | FractionBarVisual | GeometryVisual;

export interface ExplainVariant {
  mode: ExplainMode;
  body: string;
  diagram: PictureDiagram | null;
  workedExample: WorkedExample | null;
  visual: MathVisual | null;
}

const MODES: ExplainMode[] = ["story", "picture", "realworld", "gofurther", "worked"];

/**
 * Pedagogy Agent — generates all five explanation modes for a topic in one
 * call, cached per scope+language like Notes. Only the *default selected
 * pane* is personalized per student (via PedagogyPreference/MisconceptionTag,
 * added in Phase 4) — the five explanations themselves are shared content.
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
 * "worked" mode (added for Math, but generated for every subject — same
 * "always attempt" precedent as Notes.keyTerms) is a fully-solved,
 * step-by-step example problem — the single most research-validated math
 * teaching technique. For a non-procedural topic the model is instructed to
 * still produce a short minimal walkthrough rather than we branching on
 * subject in code.
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
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  // "graph" is only ever asked for (and only ever gets its own Explanation
  // row) on Math topics — see practice.ts for the exact same isMath check.
  // Keeping it out of `modes` entirely for every other subject avoids
  // wasting prompt/schema space on a graph instruction that would always
  // come back null anyway.
  const isMath = topic.chapter.subject.nameEn.toLowerCase().includes("math");
  const modes: ExplainMode[] = isMath ? [...MODES, "graph"] : MODES;

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
  if (existing.length === modes.length) {
    return existing.map((e) => ({
      mode: e.mode,
      body: e.body,
      diagram: e.diagram as unknown as PictureDiagram | null,
      workedExample: e.workedExample as unknown as WorkedExample | null,
      visual: e.graph as unknown as MathVisual | null,
    }));
  }

  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;

  const system = withBaseInstructions(
    "You are the Pedagogy Agent. Explain the same topic several different ways so every kind of learner finds " +
      "one that clicks — never just rewordings of the same explanation. There is no real diagram image, so the " +
      "picture mode instead breaks the idea into an ordered sequence of 2-5 steps (like a flow diagram) — each " +
      "step has one emoji icon, a short label, and a one-sentence description, and each arrow between " +
      "consecutive steps has a short label describing that transition (e.g. \"blocks light\", \"heats up\"). " +
      "Make the sequence specific to this exact topic, never generic filler, and order it the way the process " +
      "or idea actually flows. " +
      "For the worked-example mode, write a fully solved, step-by-step example applying this concept to one " +
      "concrete case — each step needs both the reasoning (explanation) and the actual computation (work, " +
      "using $...$ math notation for any calculation). If the topic genuinely has no calculation or procedure " +
      "(e.g. a purely historical or descriptive topic), still produce a short 2-3 step walkthrough of applying " +
      "or identifying the concept once, rather than skipping it. " +
      (options?.sourceText
        ? "The source chapter text provided may cover multiple topics/concepts — ground every explanation " +
          "strictly in the source, but explain ONLY this specific topic, ignoring parts of the source about " +
          "other concepts in the same chapter. Never invent facts beyond the source. "
        : "") +
      (isMath
        ? "Additionally, choose the SINGLE visual that best clarifies this specific topic, or none at all: " +
          "(1) a \"function\" graph — for algebra/functions/coordinate geometry, e.g. y = 2x + 1; (2) a " +
          "\"numberline\" — for comparing or ordering numbers, decimals, fractions, or integers on a line; " +
          "(3) a \"fractionbar\" — for parts-of-a-whole fraction concepts, equivalence, or comparing two " +
          "fractions; (4) a \"geometry\" shape — for identifying shapes, labeling sides/angles, perimeter/area, " +
          "types of triangles, or parts of a circle. For geometry, pick the shape (and triangleType if a " +
          "triangle) that matches what's being taught, and only fill in sideLabels/angleLabels for the sides/" +
          "angles this specific topic actually cares about (e.g. label all 3 angles and no sides for an " +
          "angle-sum lesson; label all sides and no angles for a perimeter lesson) — leave the rest empty. " +
          "If triangleType is \"right\", the 90° corner is drawn and marked automatically — never add its own " +
          "angleLabels entry for it, only label the other two angles if relevant. " +
          "rather than inventing values not in the source. If this topic is plain arithmetic, place value, or " +
          "otherwise not genuinely clarified by any of these (the worked example already covers it), set " +
          "visual to null rather than forcing an irrelevant one. "
        : "") +
      'Respond ONLY with strict JSON, no markdown, no code fences. Shape: {"story":"a short relatable narrative ' +
      'that introduces the idea","picture":"one short sentence introducing what the diagram below shows",' +
      '"pictureSteps":[{"icon":"single emoji","label":"short label","description":"one sentence"}, ...2 to 5],' +
      '"pictureConnectors":["short arrow label", ... exactly one fewer than pictureSteps],' +
      '"realworld":"how the concept shows up in daily life","gofurther":"a deeper insight for curious minds",' +
      '"worked":"one short sentence introducing the example problem below",' +
      '"workedProblem":"the example problem statement, may include $...$ math",' +
      '"workedSteps":[{"explanation":"string","work":"string, may include $...$ math"}, ...3 to 6],' +
      '"workedAnswer":"the final answer, may include $...$ math"' +
      (isMath
        ? ',"visual": exactly one of these four shapes, or null if none fits — ' +
          '{"kind":"function","title":"short label like y = x^2","expression":"a mathjs-compatible expression ' +
          'in terms of x, e.g. x^2 + 2*x - 3","xMin":number,"xMax":number,"yMin":number,"yMax":number,' +
          '"points":[{"x":number,"y":number,"label":"a short DESCRIPTIVE name for this point, e.g. ' +
          '\\"y-intercept\\" or \\"vertex\\" - never the coordinates themselves, since those are shown ' +
          'separately already"}] (optional)} ' +
          'OR {"kind":"numberline","title":"short label","min":number,"max":number,' +
          '"points":[{"value":number,"label":"a short descriptive name, e.g. \\"A\\" or the fraction/decimal ' +
          'as text like \\"3/4\\" - never restate the number, it is shown separately already"}], ' +
          '"highlightRange":{"from":number,"to":number} (optional, e.g. for an inequality or interval)} ' +
          'OR {"kind":"fractionbar","title":"short label","numerator":number,"denominator":number,' +
          '"secondFraction":{"numerator":number,"denominator":number} (optional, for comparing/showing ' +
          'equivalence against a second fraction)} ' +
          'OR {"kind":"geometry","title":"short label","shape":"triangle" or "square" or "rectangle" or ' +
          '"parallelogram" or "circle","triangleType":"equilateral" or "isosceles" or "scalene" or "right" ' +
          '(ONLY if shape is triangle, omit otherwise),"sideLabels":["string", ... one per side, empty string ' +
          'for any side not being labeled] (omit entirely for circle),"angleLabels":["string", ... one per ' +
          'angle/vertex, empty string for any angle not being labeled] (omit entirely for circle),' +
          '"radiusLabel":"string" (only for circle, omit otherwise),"showCenter":boolean (only for circle, ' +
          "omit otherwise)}"
        : "") +
      "}. " +
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
    story?: string;
    picture?: string;
    pictureSteps?: DiagramStep[];
    pictureConnectors?: string[];
    realworld?: string;
    gofurther?: string;
    worked?: string;
    workedProblem?: string;
    workedSteps?: WorkedExampleStep[];
    workedAnswer?: string;
    visual?: MathVisual | null;
  }>(raw);

  // Same defensive fallback as everywhere else this pattern shows up: valid
  // JSON doesn't guarantee every expected key was actually present.
  const bodies: Record<ExplainMode, string> = {
    story: parsed.story ?? "",
    picture: parsed.picture ?? "",
    realworld: parsed.realworld ?? "",
    gofurther: parsed.gofurther ?? "",
    worked: parsed.worked ?? "",
    graph: "",
  };

  const diagram: PictureDiagram = { steps: parsed.pictureSteps ?? [], connectors: parsed.pictureConnectors ?? [] };
  const workedExample: WorkedExample = {
    problem: parsed.workedProblem ?? "",
    steps: parsed.workedSteps ?? [],
    answer: parsed.workedAnswer ?? "",
  };
  const visual: MathVisual | null = parsed.visual ?? null;

  const created = await Promise.all(
    modes.map((mode) =>
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
          workedExample: mode === "worked" ? (workedExample as unknown as object) : undefined,
          graph: mode === "graph" && visual ? (visual as unknown as object) : undefined,
          status: options?.status ?? "published",
        },
      }),
    ),
  );

  return created.map((e) => ({
    mode: e.mode,
    body: e.body,
    diagram: e.diagram as unknown as PictureDiagram | null,
    workedExample: e.workedExample as unknown as WorkedExample | null,
    visual: e.graph as unknown as MathVisual | null,
  }));
}
