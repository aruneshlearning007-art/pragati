import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@pragati/db";
import { getCurrentStudent } from "@/lib/session-server";
import { UI, type Language } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ErrorCard } from "@/components/ErrorCard";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  let student: Awaited<ReturnType<typeof getCurrentStudent>>;
  let subjects: Awaited<ReturnType<typeof prisma.subject.findMany>>;
  try {
    student = await getCurrentStudent();
    subjects = student ? await prisma.subject.findMany({ orderBy: { nameEn: "asc" } }) : [];
  } catch (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <ErrorCard title="Could not load your profile" error={err} />
      </div>
    );
  }

  if (!student) redirect("/onboarding");

  const language = (student.language as Language) ?? "en";
  const t = UI[language];

  return (
    <div className="pg-shell flex h-screen" style={{ background: "var(--color-bg)" }}>
      <aside
        className="pg-sidebar flex flex-col box-border"
        style={{ width: 250, flex: "0 0 250px", background: "var(--color-surface)", borderRight: "1px solid var(--color-border)", padding: "22px 16px" }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div className="w-9 h-9 rounded-[11px] bg-primary text-white flex items-center justify-center font-heading font-bold text-lg">
            P
          </div>
          <span className="font-heading font-semibold text-lg">{t.appName}</span>
        </div>

        <div className="text-[11px] font-bold tracking-wide uppercase px-2 mb-2" style={{ color: "var(--color-text-muted)" }}>
          {t.subjectsLabel}
        </div>
        {subjects.map((sub) => (
          <Link
            key={sub.id}
            href={`/student?subject=${sub.id}`}
            className="flex items-center gap-2.5 w-full text-left px-2.5 py-2.5 rounded-[10px] text-sm font-medium mb-0.5"
          >
            <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: "var(--color-primary)" }} />
            {language === "hi" ? sub.nameHi || sub.nameEn : sub.nameEn}
          </Link>
        ))}

        <div className="h-px my-4 mx-2" style={{ background: "var(--color-border)" }} />
        <Link href="/student/progress" className="w-full text-left px-2.5 py-2.5 rounded-[10px] text-sm font-semibold mb-0.5">
          {t.navProgress}
        </Link>

        <div className="flex-1" />
        <div className="text-xs px-2" style={{ color: "var(--color-text-muted)" }}>
          {student.board} · {student.class}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div
          className="flex items-center justify-between px-8 box-border"
          style={{ height: 64, flex: "0 0 64px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
            >
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-bold">{student.name}</div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {student.class} · {student.board}
              </div>
            </div>
          </div>
          <LanguageToggle current={language} />
        </div>

        <div className="flex-1 overflow-auto px-10 py-9">{children}</div>
      </div>
    </div>
  );
}
