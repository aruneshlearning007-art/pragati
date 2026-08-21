"use client";

import { useState } from "react";
import Link from "next/link";
import { UI, type Language } from "@/lib/i18n";

export function LandingPage() {
  const [language, setLanguage] = useState<Language>("en");
  const t = UI[language];

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
      <header className="flex items-center justify-between px-6 sm:px-10 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-lg font-heading font-semibold">
            P
          </div>
          <span className="font-heading text-lg font-semibold">{t.appName}</span>
        </div>
        <div className="flex gap-1.5">
          {(["en", "hi"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{
                background: language === lang ? "var(--color-primary)" : "var(--color-surface)",
                color: language === lang ? "white" : "var(--color-text-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              {lang === "en" ? "EN" : "हिं"}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
        <h1 className="font-heading text-[34px] sm:text-[44px] font-bold leading-tight max-w-2xl mb-4">
          {t.landingHeroTitle}
        </h1>
        <p className="text-base sm:text-lg max-w-xl mb-12" style={{ color: "var(--color-text-muted)" }}>
          {t.landingHeroSubtitle}
        </p>

        <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
          <RoleCard
            icon="🎓"
            title={t.landingStudentTitle}
            description={t.landingStudentDescription}
            href="/onboarding"
            cta={t.landingStudentCta}
          />
          <RoleCard
            icon="🧑‍🏫"
            title={t.landingTeacherTitle}
            description={t.landingTeacherDescription}
            href="/teacher-onboarding"
            cta={t.landingTeacherCta}
          />
        </div>
      </div>

      <footer className="text-center pb-8 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {t.landingFooter}
      </footer>
    </main>
  );
}

function RoleCard({
  icon,
  title,
  description,
  href,
  cta,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center text-center p-8 rounded-card transition-transform duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-heading text-lg font-semibold mb-1.5">{title}</div>
      <div className="text-sm mb-5" style={{ color: "var(--color-text-muted)" }}>
        {description}
      </div>
      <div
        className="w-full py-3 rounded-xl text-white font-heading font-semibold text-sm"
        style={{ background: "var(--color-primary)" }}
      >
        {cta}
      </div>
    </Link>
  );
}
