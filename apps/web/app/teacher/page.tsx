import Link from "next/link";
import { prisma } from "@pragati/db";
import { getCurrentTeacher } from "@/lib/session-server";
import { UI, type Language } from "@/lib/i18n";
import { DeleteChapterButton } from "@/components/DeleteChapterButton";

export default async function TeacherPanelPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) return null;
  const language = (teacher.language as Language) ?? "en";
  const t = UI[language];

  const chapters = await prisma.chapter.findMany({
    where: { teacherId: teacher.id },
    include: { subject: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-[26px] font-semibold mb-1">{t.contentPanelTitle}</h1>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Upload a chapter, then generate, verify and review it before it reaches students.
          </p>
        </div>
        <Link
          href="/teacher/upload"
          className="px-5 py-3 rounded-xl text-white font-bold text-sm flex-none"
          style={{ background: "var(--color-primary)" }}
        >
          {t.uploadChapterCta}
        </Link>
      </div>

      {chapters.length === 0 ? (
        <div
          className="p-10 rounded-card text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="font-heading font-bold text-[15px] mb-1.5">{t.noChaptersYet}</div>
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {t.noChaptersHint}
          </div>
        </div>
      ) : (
        <div className="rounded-card overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
          {chapters.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-5 py-4"
              style={{
                background: "var(--color-surface)",
                borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              <Link href={`/teacher/chapters/${c.id}`} className="flex-1 min-w-0">
                <div className="font-semibold text-[14.5px]">{c.titleEn}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {c.subject.nameEn} · {c.class} · {c.board}
                </div>
              </Link>
              <div className="flex items-center gap-2.5 flex-none">
                <span
                  className="text-xs font-bold px-3 py-1.5 rounded-full"
                  style={
                    c.status === "published"
                      ? { background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }
                      : { background: "var(--color-revision-bg)", color: "var(--color-revision-fg)" }
                  }
                >
                  {c.status === "published" ? t.statusPublished : t.statusAwaitingReview}
                </span>
                <DeleteChapterButton chapterId={c.id} language={language} compact />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
