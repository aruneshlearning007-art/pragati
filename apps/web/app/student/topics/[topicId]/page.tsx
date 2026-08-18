import Link from "next/link";
import { prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import { getOrGenerateNotes } from "@/lib/agents/notes";
import { getOrGenerateExplanations } from "@/lib/agents/pedagogy";
import { ExplainTab } from "@/components/ExplainTab";
import { PracticeTab } from "@/components/PracticeTab";
import { UI, type Language } from "@/lib/i18n";

type Tab = "notes" | "explain" | "practice";

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const student = await getCurrentStudent();
  if (!student) return null;
  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  const { topicId } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "explain" || tabParam === "practice" ? tabParam : "notes";

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    include: { chapter: { include: { subject: true } } },
  });
  if (!topic) {
    return <p style={{ color: "var(--color-text-muted)" }}>Topic not found.</p>;
  }

  const scope = getContentScope({
    studentClass: student.class ?? "Class 6",
    board: student.board ?? "CBSE",
    schoolId: student.schoolId,
  });

  const title = language === "hi" ? topic.titleHi || topic.titleEn : topic.titleEn;
  const chapterTitle =
    language === "hi" ? topic.chapter.titleHi || topic.chapter.titleEn : topic.chapter.titleEn;

  const tabs: { key: Tab; label: string }[] = [
    { key: "notes", label: t.tabNotes },
    { key: "explain", label: t.tabExplain },
    { key: "practice", label: t.tabPractice },
  ];

  return (
    <div>
      <div className="mb-1 text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {chapterTitle}
      </div>
      <h1 className="font-heading text-[26px] font-semibold mb-5">{title}</h1>

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        {tabs.map((tb) => (
          <Link
            key={tb.key}
            href={`/student/topics/${topicId}?tab=${tb.key}`}
            className="px-4 py-2.5 text-sm font-bold"
            style={{
              color: tab === tb.key ? "var(--color-primary)" : "var(--color-text-muted)",
              borderBottom: tab === tb.key ? "2px solid var(--color-primary)" : "2px solid transparent",
            }}
          >
            {tb.label}
          </Link>
        ))}
      </div>

      {tab === "notes" && <NotesPane topicId={topicId} scope={scope} language={language} />}
      {tab === "explain" && <ExplainPane topicId={topicId} scope={scope} language={language} />}
      {tab === "practice" && <PracticeTab topicId={topicId} language={language} />}
    </div>
  );
}

async function NotesPane({
  topicId,
  scope,
  language,
}: {
  topicId: string;
  scope: ReturnType<typeof getContentScope>;
  language: Language;
}) {
  const sections = await getOrGenerateNotes(topicId, scope, language);
  return (
    <div className="max-w-3xl flex flex-col gap-4">
      {sections.map((s, i) => (
        <div
          key={i}
          className="p-5.5 rounded-card"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="font-heading font-semibold text-[15px] mb-2">{s.heading}</div>
          <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{s.body}</div>
        </div>
      ))}
    </div>
  );
}

async function ExplainPane({
  topicId,
  scope,
  language,
}: {
  topicId: string;
  scope: ReturnType<typeof getContentScope>;
  language: Language;
}) {
  const variants = await getOrGenerateExplanations(topicId, scope, language);
  return <ExplainTab variants={variants} language={language} />;
}
