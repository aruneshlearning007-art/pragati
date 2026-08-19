import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@pragati/db";
import { getCurrentStudent } from "@/lib/session-server";
import { getTopicStatus } from "@/lib/agents/diagnostic";
import { UI, STATUS_STYLES, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";

export default async function ChapterOverviewPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return null;
  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  const { chapterId } = await params;

  let chapter: Awaited<ReturnType<typeof prisma.chapter.findUnique>> & { topics: { id: string; titleEn: string; titleHi: string | null }[] };
  let topicCards: { id: string; title: string; status: Awaited<ReturnType<typeof getTopicStatus>>["status"]; progress: number }[];
  try {
    const found = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { topics: { orderBy: { createdAt: "asc" } } },
    });
    if (!found) {
      return <p style={{ color: "var(--color-text-muted)" }}>Chapter not found.</p>;
    }
    chapter = found;

    topicCards = await Promise.all(
      chapter.topics.map(async (topic) => {
        const { status, progress } = await getTopicStatus(student.id, topic.id);
        const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;
        return { id: topic.id, title, status, progress };
      }),
    );
  } catch (err) {
    return <ErrorCard title="Could not load this chapter" error={err} />;
  }

  // redirect() throws internally to signal Next's router — must stay
  // outside the try/catch above, or it gets swallowed as a fetch error.
  if (chapter.topics.length === 1) {
    redirect(`/student/topics/${chapter.topics[0].id}`);
  }

  const chapterTitle = language === "hi" ? chapter.titleHi || chapter.titleEn : chapter.titleEn;

  return (
    <div>
      <h1 className="font-heading text-[26px] font-semibold mb-1.5">{chapterTitle}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        {t.conceptsInChapter}
      </p>

      <div className="flex flex-col gap-3 max-w-2xl">
        {topicCards.map((topic, i) => {
          const style = STATUS_STYLES[topic.status];
          const label = topic.status === "mastered" ? t.mastered : topic.status === "revision" ? t.revision : t.notStarted;
          return (
            <Link
              key={topic.id}
              href={`/student/topics/${topic.id}`}
              className="flex items-center justify-between gap-3 p-4.5 rounded-card"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}
                >
                  {i + 1}
                </div>
                <div className="font-heading font-semibold text-[15px]">{topic.title}</div>
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit shrink-0"
                style={{ background: style.bg, color: style.fg }}
              >
                <span className="w-[7px] h-[7px] rounded-full" style={{ background: style.dot }} />
                {label}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
