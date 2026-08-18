import Link from "next/link";
import { prisma, Prisma } from "@pragati/db";
import { getCurrentStudent } from "@/lib/session-server";
import { getChapterStatus, type TopicStatus } from "@/lib/agents/diagnostic";
import { UI, STATUS_STYLES, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";

type ChapterWithTopics = Prisma.ChapterGetPayload<{ include: { topics: true } }>;

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const student = await getCurrentStudent();
  if (!student) return null;
  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  let activeSubject: Awaited<ReturnType<typeof prisma.subject.findMany>>[number] | undefined;
  let chapterCards: { chapter: ChapterWithTopics; status: TopicStatus; progress: number }[];
  try {
    const { subject: subjectIdParam } = await searchParams;
    const subjects = await prisma.subject.findMany({ orderBy: { nameEn: "asc" } });
    activeSubject = subjects.find((s) => s.id === subjectIdParam) ?? subjects[0];

    if (!activeSubject) {
      return <p style={{ color: "var(--color-text-muted)" }}>No subjects yet.</p>;
    }

    const chapters = await prisma.chapter.findMany({
      where: { subjectId: activeSubject.id, class: student.class ?? undefined, board: student.board ?? undefined },
      include: { topics: true },
      orderBy: { createdAt: "asc" },
    });

    chapterCards = await Promise.all(
      chapters.map(async (ch) => {
        const { status, progress } = await getChapterStatus(student.id, ch.id);
        return { chapter: ch, status, progress };
      }),
    );
  } catch (err) {
    return <ErrorCard title="Could not load your subjects" error={err} />;
  }

  return (
    <div>
      <h1 className="font-heading text-[28px] font-semibold mb-6">
        {language === "hi" ? activeSubject.nameHi || activeSubject.nameEn : activeSubject.nameEn}
      </h1>

      {chapterCards.length === 0 ? (
        <div
          className="text-center py-14 px-6 rounded-card"
          style={{ border: "1.5px dashed var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <div className="font-bold text-[15px] mb-1.5" style={{ color: "var(--color-text)" }}>
            Coming soon
          </div>
          <div className="text-[13px]">Chapters for this subject are being prepared.</div>
        </div>
      ) : (
        <div className="grid gap-4.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {chapterCards.map(({ chapter, status, progress }) => {
            const style = STATUS_STYLES[status];
            const label = status === "mastered" ? t.mastered : status === "revision" ? t.revision : t.notStarted;
            const firstTopic = chapter.topics[0];
            return (
              <div
                key={chapter.id}
                className="flex flex-col gap-3 p-5 rounded-card"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}
              >
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit"
                  style={{ background: style.bg, color: style.fg }}
                >
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: style.dot }} />
                  {label}
                </div>
                <div className="font-heading text-[17px] font-semibold leading-snug min-h-11">
                  {language === "hi" ? chapter.titleHi || chapter.titleEn : chapter.titleEn}
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-notstarted-bg)" }}>
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: style.dot }} />
                </div>
                {firstTopic && (
                  <Link
                    href={`/student/topics/${firstTopic.id}`}
                    className="mt-1 text-center py-2.5 rounded-xl text-white font-heading font-semibold text-sm"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {t.startChapterCta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
