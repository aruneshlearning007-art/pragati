import Link from "next/link";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import {
  getProgressOverview,
  getWeakAreasForStudent,
  getStudentStreak,
  type SubjectProgress,
  type WeakArea,
} from "@/lib/agents/diagnostic";
import { UI, STATUS_STYLES, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";

export default async function StudentProgressPage() {
  const student = await getCurrentStudent();
  if (!student) return null;
  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  let subjects: SubjectProgress[];
  let weakAreas: WeakArea[];
  let streak: number;
  try {
    const scope = getContentScope({
      studentClass: student.class ?? "Class 6",
      board: student.board ?? "CBSE",
      schoolId: student.schoolId,
    });
    [subjects, weakAreas, streak] = await Promise.all([
      getProgressOverview(student.id, scope, language),
      getWeakAreasForStudent(student.id, language),
      getStudentStreak(student.id),
    ]);
  } catch (err) {
    return <ErrorCard title="Could not load your progress" error={err} />;
  }

  if (subjects.length === 0) {
    return (
      <div>
        <h1 className="font-heading text-[28px] font-semibold mb-6">{t.progressTitle}</h1>
        <div
          className="text-center py-14 px-6 rounded-card"
          style={{ border: "1.5px dashed var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <div className="text-[13px]">{t.noProgressYet}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-[28px] font-semibold mb-6">{t.progressTitle}</h1>

      <div
        className="flex items-center gap-3 p-5 rounded-card mb-7"
        style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
      >
        <span className="text-3xl">🔥</span>
        {streak > 0 ? (
          <span className="font-heading text-xl font-bold">
            {streak} {t.progressStreakSuffix}
          </span>
        ) : (
          <span className="font-semibold text-sm">{t.progressStreakZero}</span>
        )}
      </div>

      <div className="flex flex-col gap-3.5 mb-9">
        {subjects.map((subj) => {
          const style = STATUS_STYLES[subj.overallStatus];
          const label = subj.overallStatus === "mastered" ? t.mastered : subj.overallStatus === "revision" ? t.revision : t.notStarted;
          return (
            <div
              key={subj.subjectId}
              className="flex items-center gap-4 p-5 rounded-card"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-heading text-[16px] font-semibold">{subj.subjectName}</div>
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold w-fit flex-none"
                    style={{ background: style.bg, color: style.fg }}
                  >
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: style.dot }} />
                    {label}
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-notstarted-bg)" }}>
                  <div className="h-full rounded-full" style={{ width: `${subj.overallProgress}%`, background: style.dot }} />
                </div>
              </div>
              <Link
                href={`/student?subject=${subj.subjectId}`}
                className="px-4 py-2.5 rounded-xl text-white font-heading font-semibold text-sm flex-none"
                style={{ background: "var(--color-primary)" }}
              >
                {t.viewSubjectCta}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="font-heading text-lg font-semibold mb-3">{t.weakAreasTitle}</div>
      {weakAreas.length === 0 ? (
        <div
          className="text-center py-10 px-6 rounded-card"
          style={{ border: "1.5px dashed var(--color-border)", color: "var(--color-text-muted)" }}
        >
          <div className="text-[13px]">{t.weakAreasEmpty}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {weakAreas.map((area, i) => (
            <Link
              key={i}
              href={`/student/topics/${area.topicId}?tab=practice`}
              className="flex items-center justify-between gap-3 p-4.5 rounded-card"
              style={{ background: "var(--color-revision-bg)", border: "1px solid var(--color-revision-dot)" }}
            >
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold" style={{ color: "var(--color-revision-fg)" }}>
                  {area.type}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                  {area.subjectName} · {area.topicTitle} · {area.subConceptName}
                </div>
              </div>
              <div
                className="text-xs font-bold px-2.5 py-1 rounded-full flex-none"
                style={{ background: "var(--color-surface)", color: "var(--color-revision-fg)" }}
              >
                ×{area.count}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
