"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModeToggle } from "@/components/AuthModeToggle";
import { UI, type Language } from "@/lib/i18n";

export default function TeacherOnboardingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [language, setLanguage] = useState<Language>("en");
  const [form, setForm] = useState({ name: "", email: "", school: "", state: "", city: "" });
  const [loginEmail, setLoginEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = UI[language];

  const canSubmitSignup =
    form.name.trim() && form.email.trim() && form.school.trim() && form.state.trim() && form.city.trim() && !submitting;
  const canSubmitLogin = loginEmail.trim() && !submitting;

  async function handleSignup() {
    if (!canSubmitSignup) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, language }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }
      router.push("/teacher");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function handleLogin() {
    if (!canSubmitLogin) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, role: "teacher" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }
      router.push("/teacher");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="max-w-md w-full bg-surface border border-border rounded-card p-10 shadow-sm">
        <div className="w-13 h-13 mb-5 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-heading font-semibold w-[52px] h-[52px]">
          P
        </div>

        <AuthModeToggle mode={mode} onChange={(m) => { setMode(m); setError(null); }} language={language} />

        {mode === "signup" ? (
          <>
            <h1 className="font-heading text-2xl font-semibold mb-1">{t.teacherOnboardingTitle}</h1>
            <p className="text-ink-muted text-sm mb-7">{t.onboardingSubtitle}</p>

            <Field label={t.name}>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Priya Sharma"
              />
            </Field>

            <Field label={t.email} hint={t.emailHintTeacher}>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="e.g. priya@example.com"
              />
            </Field>

            <Field label={t.school}>
              <input
                className="input"
                value={form.school}
                onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
                placeholder="e.g. Delhi Public School"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.state}>
                <input
                  className="input"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="e.g. Maharashtra"
                />
              </Field>
              <Field label={t.city}>
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="e.g. Pune"
                />
              </Field>
            </div>

            <label className="block text-sm font-semibold text-ink mb-2 mt-1">{t.language}</label>
            <div className="flex gap-2 mb-7">
              {(["en", "hi"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className="flex-1 py-2.5 rounded-[10px] border font-semibold text-sm"
                  style={{
                    borderColor: "var(--color-border)",
                    background: language === lang ? "var(--color-primary)" : "white",
                    color: language === lang ? "white" : "var(--color-text)",
                  }}
                >
                  {lang === "en" ? "English" : "हिंदी"}
                </button>
              ))}
            </div>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <button
              type="button"
              disabled={!canSubmitSignup}
              onClick={handleSignup}
              className="w-full py-3.5 rounded-2xl text-white font-heading font-semibold text-base disabled:opacity-40"
              style={{ background: "var(--color-primary)" }}
            >
              {submitting ? "…" : t.getStarted}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-semibold mb-1">{t.loginTitleTeacher}</h1>
            <p className="text-ink-muted text-sm mb-7">{t.loginSubtitle}</p>

            <Field label={t.email}>
              <input
                type="email"
                className="input"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. priya@example.com"
              />
            </Field>

            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

            <button
              type="button"
              disabled={!canSubmitLogin}
              onClick={handleLogin}
              className="w-full py-3.5 rounded-2xl text-white font-heading font-semibold text-base disabled:opacity-40"
              style={{ background: "var(--color-primary)" }}
            >
              {submitting ? "…" : t.loginCta}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      {children}
      {hint && (
        <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}
