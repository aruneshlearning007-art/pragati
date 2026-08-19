import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";
import { PublishButton } from "@/components/PublishButton";
import { UI, type Language } from "@/lib/i18n";

export default async function ChapterReviewPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;
  const language = (teacher.language as Language) ?? "en";
  const t = UI[language];

  const { chapterId } = await params;
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { subject: true, topics: { orderBy: { createdAt: "asc" } } },
  });

  if (!chapter || chapter.teacherId !== teacher.id) notFound();

  const concepts = await Promise.all(
    chapter.topics.map(async (topic) => {
      const [notes, explanations, questions, flags] = await Promise.all([
        prisma.notes.findFirst({ where: { topicId: topic.id }, orderBy: { createdAt: "desc" } }),
        prisma.explanation.findMany({ where: { topicId: topic.id } }),
        prisma.quizQuestion.findMany({ where: { topicId: topic.id } }),
        prisma.verifierFlag.findMany({ where: { topicId: topic.id }, orderBy: { createdAt: "asc" } }),
      ]);
      return {
        topic,
        notes,
        explanations,
        questions,
        flags,
        sections: (notes?.sections as unknown as { heading: string; body: string }[]) ?? [],
        keyTerms: (notes?.keyTerms as unknown as { term: string; meaning: string }[]) ?? [],
      };
    }),
  );

  const sectionLabel: Record<string, string> = { notes: "Notes", explain: "Explain", practice: "Practice" };

  return (
    <div className="max-w-3xl">
      <Link href="/teacher" className="text-sm font-semibold mb-4 inline-block" style={{ color: "var(--color-primary)" }}>
        {t.backToPanel}
      </Link>

      <div className="flex items-center justify-between mb-2">
        <h1 className="font-heading text-[26px] font-semibold">{chapter.titleEn}</h1>
        {chapter.status === "awaiting_review" ? (
          <PublishButton chapterId={chapter.id} language={language} />
        ) : (
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
          >
            {t.statusPublished}
          </span>
        )}
      </div>
      <p className="text-sm mb-8" style={{ color: "var(--color-text-muted)" }}>
        {chapter.subject.nameEn} · {chapter.class} · {chapter.board}
      </p>

      {concepts.map(({ topic, sections, explanations, questions, flags, keyTerms }, i) => (
        <div key={topic.id} className="mb-9">
          {concepts.length > 1 && (
            <div className="font-heading text-[18px] font-bold mb-4" style={{ color: "var(--color-primary)" }}>
              {t.concept} {i + 1}: {topic.titleEn}
            </div>
          )}

          {flags.length > 0 ? (
            <div
              className="p-5 rounded-card mb-5"
              style={{ background: "var(--color-revision-bg)", border: "1px solid var(--color-revision-dot)" }}
            >
              <div className="font-heading font-bold text-[14px] mb-3" style={{ color: "var(--color-revision-fg)" }}>
                AI Verifier — {flags.length} thing{flags.length > 1 ? "s" : ""} checked and corrected
              </div>
              <div className="flex flex-col gap-3">
                {flags.map((f) => (
                  <div key={f.id} className="text-[13px]">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded mr-1.5"
                      style={{ background: "var(--color-surface)", color: "var(--color-revision-fg)" }}
                    >
                      {sectionLabel[f.section] ?? f.section}
                    </span>
                    <span style={{ color: "var(--color-text)" }}>{f.reason}</span>
                    <div className="mt-1 italic" style={{ color: "var(--color-text-muted)" }}>
                      Now reads: &ldquo;{f.quote}&rdquo;
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="p-4 rounded-card mb-5 text-[13.5px] font-semibold"
              style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
            >
              ✓ AI Verifier found no issues — nothing needed correcting.
            </div>
          )}

          <Section title="Notes">
            <div className="flex flex-col gap-3">
              {sections.map((s, si) => (
                <div key={si}>
                  <div className="font-heading font-semibold text-[14px] mb-1">{s.heading}</div>
                  <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>
                    {s.body}
                  </div>
                </div>
              ))}
              {keyTerms.length > 0 && (
                <div className="pt-2 mt-1 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <div className="font-heading font-semibold text-[13px] mb-2">{t.keyTermsTitle}</div>
                  <div className="flex flex-col gap-1.5">
                    {keyTerms.map((kt, ti) => (
                      <div key={ti} className="text-[13px]">
                        <span className="font-bold">{kt.term}</span>
                        <span style={{ color: "var(--color-text-muted)" }}> — {kt.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section title="Explain">
            <div className="flex flex-col gap-4">
              {explanations.map((e) => (
                <div key={e.id}>
                  <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-primary)" }}>
                    {e.mode}
                  </div>
                  <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>
                    {e.body}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Practice">
            <div className="flex flex-col gap-4">
              {questions.map((q) => (
                <div key={q.id}>
                  <div className="text-[13.5px] font-semibold mb-1.5">{q.text}</div>
                  <div className="flex flex-col gap-1">
                    {(q.options as unknown as string[]).map((opt, idx) => (
                      <div
                        key={idx}
                        className="text-[13px] px-2.5 py-1.5 rounded-md"
                        style={
                          idx === q.correctIndex
                            ? { background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }
                            : { color: "var(--color-text-muted)" }
                        }
                      >
                        {opt} {idx === q.correctIndex && "✓"}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-6 rounded-card mb-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="font-heading font-bold text-[15px] mb-4">{title}</div>
      {children}
    </div>
  );
}
