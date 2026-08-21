import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentTeacher } from "@/lib/session-server";
import { UI, type Language } from "@/lib/i18n";
import { ErrorCard } from "@/components/ErrorCard";
import { LogoutButton } from "@/components/LogoutButton";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  let teacher: Awaited<ReturnType<typeof getCurrentTeacher>>;
  try {
    teacher = await getCurrentTeacher();
  } catch (err) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <ErrorCard title="Could not load your profile" error={err} />
      </div>
    );
  }

  if (!teacher) redirect("/teacher-onboarding");

  const language = (teacher.language as Language) ?? "en";
  const t = UI[language];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div
        className="flex items-center justify-between px-8 box-border"
        style={{ height: 64, borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <Link href="/teacher" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[11px] bg-primary text-white flex items-center justify-center font-heading font-bold text-lg">
            P
          </div>
          <span className="font-heading font-semibold text-lg">{t.appName}</span>
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
            style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
          >
            {teacher.name.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-bold">{teacher.name}</div>
            <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {teacher.school?.name ?? ""}
            </div>
          </div>
          <LogoutButton language={language} />
        </div>
      </div>
      <div className="px-10 py-9">{children}</div>
    </div>
  );
}
