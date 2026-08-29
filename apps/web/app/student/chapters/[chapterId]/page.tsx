import { redirect } from "next/navigation";
import { prisma } from "@pragati/db";
import { getCurrentStudent } from "@/lib/session-server";
import { getTopicStatusesByChapter, type StatusResult } from "@/lib/agents/diagnostic";
import { UI, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";
import { ConceptMapView } from "@/components/ConceptMapView";
import { SetActiveSubject } from "@/components/SetActiveSubject";
import { MockExamCard } from "@/components/MockExamCard";

export default async function ChapterOverviewPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const student = await getCurrentStudent();
  if (!student) return null;
  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  const { chapterId } = await params;

  let chapter: Awaited<ReturnType<typeof prisma.chapter.findUnique>> & {
    subject: { id: string };
    topics: { id: string; titleEn: string; titleHi: string | null }[];
  };
  let topicCards: { id: string; title: string; status: StatusResult["status"]; progress: number }[];
  try {
    const found = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { subject: true, topics: { orderBy: { createdAt: "asc" } } },
    });
    if (!found) {
      return <p style={{ color: "var(--color-text-muted)" }}>Chapter not found.</p>;
    }
    chapter = found;

    const statusByTopic = await getTopicStatusesByChapter(student.id, chapterId);
    topicCards = chapter.topics.map((topic) => {
      const { status, progress } = statusByTopic.get(topic.id) ?? { status: "not-started" as const, progress: 0 };
      const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;
      return { id: topic.id, title, status, progress };
    });
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
      <SetActiveSubject subjectId={chapter.subject.id} />
      <h1 className="font-heading text-[26px] font-semibold mb-1.5">{chapterTitle}</h1>
      <p className="text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>
        {t.conceptsInChapter}
      </p>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        {topicCards.filter((c) => c.status === "mastered").length} / {topicCards.length} {t.conceptsMasteredSuffix}
      </p>

      <MockExamCard
        chapterId={chapterId}
        subjectId={chapter.subject.id}
        cls={chapter.class}
        board={chapter.board}
        schoolId={chapter.schoolId}
        language={language}
      />

      <ConceptMapView nodes={topicCards.map((t) => ({ id: t.id, title: t.title, status: t.status }))} language={language} />
    </div>
  );
}
