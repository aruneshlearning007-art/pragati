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
    include: { subject: true, topics: true },
  });

  if (!chapter || chapter.teacherId !== teacher.id) notFound();

  const topicId = chapter.topics[0]?.id;
  const [notes, explanations, questions] = topicId
    ? await Promise.all([
        prisma.notes.findFirst({ where: { topicId }, orderBy: { createdAt: "desc" } }),
        prisma.explanation.findMany({ where: { topicId } }),
        prisma.quizQuestion.findMany({ where: { topicId } }),
      ])
    : [null, [], []];

  const sections = (notes?.sections as unknown as { heading: string; body: string }[]) ?? [];

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

      <Section title="Notes">
        <div className="flex flex-col gap-3">
          {sections.map((s, i) => (
            <div key={i}>
              <div className="font-heading font-semibold text-[14px] mb-1">{s.heading}</div>
              <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--color-text-muted)" }}>
                {s.body}
              </div>
            </div>
          ))}
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
