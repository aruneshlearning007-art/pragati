import Link from "next/link";
import { prisma } from "@pragati/db";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import { getOrGenerateNotes } from "@/lib/agents/notes";
import { getOrGenerateExplanations } from "@/lib/agents/pedagogy";
import { getOrCurateVideos } from "@/lib/agents/video";
import { ExplainTab } from "@/components/ExplainTab";
import { PracticeTab } from "@/components/PracticeTab";
import { VideosTab } from "@/components/VideosTab";
import { DoubtChat } from "@/components/DoubtChat";
import { RichText } from "@/components/RichText";
import { UI, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";

type Tab = "notes" | "explain" | "practice" | "videos";

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
  const tab: Tab =
    tabParam === "explain" || tabParam === "practice" || tabParam === "videos" ? tabParam : "notes";

  let topic: Awaited<ReturnType<typeof prisma.topic.findUnique>> & {
    chapter: {
      titleEn: string;
      titleHi: string | null;
      subject: { nameEn: string };
      topics: { id: string; titleEn: string; titleHi: string | null }[];
    };
  };
  try {
    const found = await prisma.topic.findUnique({
      where: { id: topicId },
      include: { chapter: { include: { subject: true, topics: { orderBy: { createdAt: "asc" } } } } },
    });
    if (!found) {
      return <p style={{ color: "var(--color-text-muted)" }}>Topic not found.</p>;
    }
    topic = found;
  } catch (err) {
    return <ErrorCard title="Could not load this topic" error={err} />;
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
    { key: "videos", label: t.tabVideos },
  ];

  return (
    <div>
      <div className="mb-1 text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
        {chapterTitle}
      </div>
      <h1 className="font-heading text-[26px] font-semibold mb-3">{title}</h1>

      {topic.chapter.topics.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {topic.chapter.topics.map((sibling, i) => {
            const siblingTitle = language === "hi" ? sibling.titleHi || sibling.titleEn : sibling.titleEn;
            const active = sibling.id === topicId;
            return (
              <Link
                key={sibling.id}
                href={`/student/topics/${sibling.id}`}
                className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={
                  active
                    ? { background: "var(--color-primary)", color: "white" }
                    : { background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                }
              >
                {i + 1}. {siblingTitle}
              </Link>
            );
          })}
        </div>
      )}

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
      {tab === "practice" && <PracticeTab topicId={topicId} subjectName={topic.chapter.subject.nameEn} language={language} />}
      {tab === "videos" && (
        <VideosPane
          topicId={topicId}
          subjectName={topic.chapter.subject.nameEn}
          topicTitle={topic.titleEn}
          studentClass={student.class ?? "Class 6"}
          language={language}
        />
      )}

      <DoubtChat topicId={topicId} language={language} />
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
  const t = UI[language];
  let sections: Awaited<ReturnType<typeof getOrGenerateNotes>>["sections"];
  let keyTerms: Awaited<ReturnType<typeof getOrGenerateNotes>>["keyTerms"];
  try {
    ({ sections, keyTerms } = await getOrGenerateNotes(topicId, scope, language));
  } catch (err) {
    return <ErrorCard title="Could not generate notes for this topic" error={err} />;
  }
  const NOTE_COLORS = 6;
  return (
    <div className="max-w-3xl flex flex-col gap-4">
      {sections.map((s, i) => {
        const c = (i % NOTE_COLORS) + 1;
        const bg = `var(--color-note-${c}-bg)`;
        const fg = `var(--color-note-${c}-fg)`;
        return (
          <div
            key={i}
            className="p-5.5 rounded-card flex gap-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
            style={{ background: bg, border: `1px solid ${fg}22` }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "white", color: fg }}
            >
              {i + 1}
            </div>
            <div>
              <div className="font-heading font-semibold text-[15px] mb-1.5" style={{ color: fg }}>
                {s.heading}
              </div>
              <RichText
                text={s.body}
                className="text-[14.5px] leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--color-text)" }}
              />
            </div>
          </div>
        );
      })}
      {keyTerms.length > 0 && (
        <div
          className="p-5.5 rounded-card"
          style={{ background: "var(--color-keyterm-bg)", border: "1px solid var(--color-keyterm-border)" }}
        >
          <div className="font-heading font-semibold text-[15px] mb-3" style={{ color: "var(--color-keyterm-fg)" }}>
            📘 {t.keyTermsTitle}
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {keyTerms.map((kt, i) => (
              <div
                key={i}
                className="p-3 rounded-xl text-[13.5px] transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm"
                style={{ background: "white", border: "1px solid var(--color-keyterm-border)" }}
              >
                <span className="font-bold" style={{ color: "var(--color-keyterm-fg)" }}>
                  {kt.term}
                </span>
                <span style={{ color: "var(--color-text-muted)" }}> — {kt.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  let variants: Awaited<ReturnType<typeof getOrGenerateExplanations>>;
  let keyTerms: Awaited<ReturnType<typeof getOrGenerateNotes>>["keyTerms"];
  try {
    // getOrGenerateNotes is cache-first (a cheap DB read once Notes exist,
    // not a second LLM call) — reused here purely to grab the same
    // glossary for inline tooltips in Explain text.
    [variants, { keyTerms }] = await Promise.all([
      getOrGenerateExplanations(topicId, scope, language),
      getOrGenerateNotes(topicId, scope, language),
    ]);
  } catch (err) {
    return <ErrorCard title="Could not generate explanations for this topic" error={err} />;
  }
  return <ExplainTab variants={variants} keyTerms={keyTerms} language={language} />;
}

async function VideosPane({
  topicId,
  subjectName,
  topicTitle,
  studentClass,
  language,
}: {
  topicId: string;
  subjectName: string;
  topicTitle: string;
  studentClass: string;
  language: Language;
}) {
  let videos: Awaited<ReturnType<typeof getOrCurateVideos>>;
  try {
    videos = await getOrCurateVideos(topicId, subjectName, topicTitle, studentClass);
  } catch (err) {
    return <ErrorCard title="Could not load videos for this topic" error={err} />;
  }
  return <VideosTab videos={videos} language={language} />;
}
