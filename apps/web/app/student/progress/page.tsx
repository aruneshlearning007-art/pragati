import Link from "next/link";
import { getContentScope } from "@pragati/shared";
import { getCurrentStudent } from "@/lib/session-server";
import {
  getProgressOverview,
  getWeakAreasForStudent,
  getStudentStreak,
  getLongestStreak,
  getMasteredTopicCount,
  getTotalQuizAttempts,
  type SubjectProgress,
  type WeakArea,
} from "@/lib/agents/diagnostic";
import { UI, STATUS_STYLES, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";
import { SetActiveSubject } from "@/components/SetActiveSubject";

const NOTE_COLORS = 6;

interface BadgeInputs {
  longestStreak: number;
  masteredTopicCount: number;
  masteredSubjectCount: number;
  totalQuizAttempts: number;
}

const BADGE_DEFS: { id: string; icon: string; titleKey: keyof (typeof UI)["en"]; earned: (p: BadgeInputs) => boolean }[] = [
  { id: "streak3", icon: "🔥", titleKey: "badgeStreak3Title", earned: (p) => p.longestStreak >= 3 },
  { id: "streak7", icon: "🔥", titleKey: "badgeStreak7Title", earned: (p) => p.longestStreak >= 7 },
  { id: "firstMastery", icon: "🌟", titleKey: "badgeFirstMasteryTitle", earned: (p) => p.masteredTopicCount >= 1 },
  { id: "fiveMastery", icon: "🏆", titleKey: "badgeFiveMasteryTitle", earned: (p) => p.masteredTopicCount >= 5 },
  { id: "subjectMaster", icon: "📚", titleKey: "badgeSubjectMasterTitle", earned: (p) => p.masteredSubjectCount >= 1 },
  { id: "practicePro", icon: "✍️", titleKey: "badgePracticeProTitle", earned: (p) => p.totalQuizAttempts >= 50 },
];

export default async function StudentProgressPage() {
  const student = await getCurrentStudent();
  if (!student) return null;
  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  let subjects: SubjectProgress[];
  let weakAreas: WeakArea[];
  let streak: number;
  let badgeInputs: BadgeInputs;
  try {
    const scope = getContentScope({
      studentClass: student.class ?? "Class 6",
      board: student.board ?? "CBSE",
      schoolId: student.schoolId,
    });
    const [subjectsResult, weakAreasResult, streakResult, longestStreak, masteredTopicCount, totalQuizAttempts] = await Promise.all([
      getProgressOverview(student.id, scope, language),
      getWeakAreasForStudent(student.id, language),
      getStudentStreak(student.id),
      getLongestStreak(student.id),
      getMasteredTopicCount(student.id, scope),
      getTotalQuizAttempts(student.id),
    ]);
    subjects = subjectsResult;
    weakAreas = weakAreasResult;
    streak = streakResult;
    badgeInputs = {
      longestStreak,
      masteredTopicCount,
      masteredSubjectCount: subjectsResult.filter((s) => s.overallStatus === "mastered").length,
      totalQuizAttempts,
    };
  } catch (err) {
    return <ErrorCard title="Could not load your progress" error={err} />;
  }

  if (subjects.length === 0) {
    return (
      <div>
        <SetActiveSubject subjectId={null} />
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
      <SetActiveSubject subjectId={null} />
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

      <div className="font-heading text-lg font-semibold mb-3">{t.badgesTitle}</div>
      <div className="grid gap-3 mb-9" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
        {BADGE_DEFS.map((badge) => {
          const earned = badge.earned(badgeInputs);
          return (
            <div
              key={badge.id}
              className="flex flex-col items-center text-center gap-1.5 p-4 rounded-card transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
              style={{
                background: earned ? "var(--color-mastered-bg)" : "var(--color-surface)",
                border: `1px solid ${earned ? "var(--color-mastered-dot)" : "var(--color-border)"}`,
                opacity: earned ? 1 : 0.5,
              }}
            >
              <span className="text-3xl" style={{ filter: earned ? "none" : "grayscale(1)" }}>
                {badge.icon}
              </span>
              <span
                className="text-xs font-bold leading-tight"
                style={{ color: earned ? "var(--color-mastered-fg)" : "var(--color-text-muted)" }}
              >
                {t[badge.titleKey]}
              </span>
            </div>
          );
        })}
      </div>

      {(() => {
        // Same note-color rotation the sidebar/home page use, indexed by
        // alphabetical position — computed independently here (not shared
        // state) since this is a decorative accent, not something that
        // needs to be pixel-identical across pages.
        const sortedNames = [...subjects.map((s) => s.subjectName)].sort();
        return (
          <div className="flex flex-col gap-3.5 mb-9">
            {subjects.map((subj) => {
              const style = STATUS_STYLES[subj.overallStatus];
              const label = subj.overallStatus === "mastered" ? t.mastered : subj.overallStatus === "revision" ? t.revision : t.notStarted;
              const colorIndex = sortedNames.indexOf(subj.subjectName);
              const accentColor = `var(--color-note-${(colorIndex % NOTE_COLORS) + 1}-fg)`;
              return (
                <div
                  key={subj.subjectId}
                  className="flex items-center gap-4 p-5 rounded-card transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: accentColor }} />
                      <div className="font-heading text-[16px] font-semibold">{subj.subjectName}</div>
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-none whitespace-nowrap"
                        style={{ background: style.bg, color: style.fg }}
                      >
                        <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: style.dot }} />
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
        );
      })()}

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
              className="flex items-center justify-between gap-3 p-4.5 rounded-card transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: "var(--color-revision-bg)", border: "1px solid var(--color-revision-dot)" }}
            >
              <div className="flex-1 min-w-0">
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
