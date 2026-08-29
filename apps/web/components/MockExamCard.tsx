import { prisma } from "@pragati/db";
import { UI, type Language } from "@/lib/i18n";

const SETS: {
  difficulty: "easy" | "medium" | "hard";
  labelKey: "mockExamSetBeginner" | "mockExamSetIntermediate" | "mockExamSetAdvance";
}[] = [
  { difficulty: "easy", labelKey: "mockExamSetBeginner" },
  { difficulty: "medium", labelKey: "mockExamSetIntermediate" },
  { difficulty: "hard", labelKey: "mockExamSetAdvance" },
];

/**
 * Shown on the chapter overview page and (for single-topic chapters, which
 * redirect past that page) the topic page. Renders nothing at all — not an
 * empty state — when the teacher hasn't published an exam format for this
 * subject/class/scope yet, same precedent as hiding the Explain Visual tab
 * for non-Math topics.
 */
export async function MockExamCard({
  chapterId,
  subjectId,
  cls,
  board,
  schoolId,
  language,
}: {
  chapterId: string;
  subjectId: string;
  cls: string;
  board: string;
  schoolId: string | null;
  language: Language;
}) {
  const t = UI[language];
  // findFirst rather than findUnique — the compound-key lookup requires a
  // definite string for the nullable schoolId column, which a student/
  // teacher with no school (should not normally happen) wouldn't have.
  const template = await prisma.examTemplate.findFirst({
    where: { subjectId, class: cls, board, schoolId },
  });
  if (!template || !template.isPublished) return null;

  return (
    <div
      className="p-5.5 rounded-card mb-6"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="font-heading font-semibold text-[15px] mb-1">{t.mockExamTitle}</div>
      <div className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
        {t.mockExamSubtitle}
      </div>
      <div className="flex flex-col gap-2.5">
        {SETS.map(({ difficulty, labelKey }) => (
          <div
            key={difficulty}
            className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-xl"
            style={{ background: "var(--color-bg)" }}
          >
            <div className="text-sm font-semibold">{t[labelKey]}</div>
            <div className="flex gap-2">
              <a
                href={`/api/chapters/${chapterId}/exam/${difficulty}?type=question`}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: "var(--color-primary)", color: "white" }}
              >
                {t.mockExamQuestionPaper}
              </a>
              <a
                href={`/api/chapters/${chapterId}/exam/${difficulty}?type=answerkey`}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ border: "1px solid var(--color-border)", background: "white" }}
              >
                {t.mockExamAnswerKey}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
