import Link from "next/link";
import { prisma, Prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import { getChapterStatusesByIds, getRevisionReminders, type TopicStatus, type RevisionReminder } from "@/lib/agents/diagnostic";
import { UI, STATUS_STYLES, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";
import { SetActiveSubject } from "@/components/SetActiveSubject";

type ChapterWithTopics = Prisma.ChapterGetPayload<{ include: { topics: true } }>;

const NOTE_COLORS = 6;

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
  let subjectAccentColor = "var(--color-primary)";
  let chapterCards: { chapter: ChapterWithTopics; status: TopicStatus; progress: number }[];
  let reminders: RevisionReminder[];
  try {
    const { subject: subjectIdParam } = await searchParams;
    const subjects = await prisma.subject.findMany({ orderBy: { nameEn: "asc" } });
    activeSubject = subjects.find((s) => s.id === subjectIdParam) ?? subjects[0];
    if (activeSubject) {
      const subjectIndex = subjects.findIndex((s) => s.id === activeSubject!.id);
      // Same index-into-the-alphabetical-list rotation the sidebar uses for
      // its subject dots, so navigating in feels visually continuous rather
      // than coincidentally matching.
      subjectAccentColor = `var(--color-note-${(subjectIndex % NOTE_COLORS) + 1}-fg)`;
    }

    if (!activeSubject) {
      return <p style={{ color: "var(--color-text-muted)" }}>No subjects yet.</p>;
    }

    const scope = getContentScope({
      studentClass: student.class ?? "Class 6",
      board: student.board ?? "CBSE",
      schoolId: student.schoolId,
    });

    const chapters = await prisma.chapter.findMany({
      where: {
        subjectId: activeSubject.id,
        class: student.class ?? undefined,
        board: student.board ?? undefined,
        schoolId: scope.schoolId,
        status: "published",
      },
      include: { topics: true },
      orderBy: { createdAt: "asc" },
    });

    const [statusByChapter, remindersResult] = await Promise.all([
      getChapterStatusesByIds(
        student.id,
        chapters.map((ch) => ch.id),
      ),
      getRevisionReminders(student.id, scope, language),
    ]);
    chapterCards = chapters.map((chapter) => {
      const { status, progress } = statusByChapter.get(chapter.id) ?? { status: "not-started" as const, progress: 0 };
      return { chapter, status, progress };
    });
    reminders = remindersResult;
  } catch (err) {
    return <ErrorCard title="Could not load your subjects" error={err} />;
  }

  return (
    <div>
      <SetActiveSubject subjectId={activeSubject.id} />
      {reminders.length > 0 && (
        <div
          className="p-5 rounded-card mb-6"
          style={{ background: "var(--color-revision-bg)", border: "1px solid var(--color-revision-dot)" }}
        >
          <div className="font-heading text-[15px] font-semibold mb-3" style={{ color: "var(--color-revision-fg)" }}>
            {t.revisionRemindersTitle}
          </div>
          <div className="flex flex-col gap-2.5">
            {reminders.map((r) => (
              <Link
                key={r.subConceptId}
                href={`/student/topics/${r.topicId}?tab=practice`}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl"
                style={{ background: "var(--color-surface)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: "var(--color-text)" }}>
                    {r.subConceptName}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {r.subjectName} · {r.topicTitle} · {r.reason === "weak" ? t.revisionReasonWeak : t.revisionReasonRefresh} ·{" "}
                    {r.daysSincePractice} {t.daysAgoSuffix}
                  </div>
                </div>
                <div
                  className="px-3 py-2 rounded-lg text-white font-heading font-semibold text-xs flex-none"
                  style={{ background: "var(--color-primary)" }}
                >
                  {t.practiceNowCta}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: subjectAccentColor }} />
        <h1 className="font-heading text-[28px] font-semibold">
          {language === "hi" ? activeSubject.nameHi || activeSubject.nameEn : activeSubject.nameEn}
        </h1>
      </div>

      {chapterCards.length > 0 && (
        <div className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
          {chapterCards.filter((c) => c.status === "mastered").length} / {chapterCards.length} {t.chaptersMasteredSuffix}
        </div>
      )}

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
                className="flex flex-col gap-3 p-5 rounded-card transition-transform duration-150 hover:-translate-y-1 hover:shadow-md"
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
                    href={`/student/chapters/${chapter.id}`}
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
