"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UI, type Language } from "@/lib/i18n";

export function LandingPage() {
  const [language, setLanguage] = useState<Language>("en");
  const t = UI[language];

  return (
    <main className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--color-bg)" }}>
      <header className="flex items-center justify-between px-6 sm:px-10 py-6 relative z-10">
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

      <div className="flex flex-col items-center px-6 py-10 text-center relative">
        {/* Soft blurred color blobs behind the hero for depth — pure CSS, no images. */}
        <div
          aria-hidden
          className="absolute -z-10 rounded-full"
          style={{ width: 320, height: 320, top: -60, left: "8%", background: "var(--color-primary)", opacity: 0.1, filter: "blur(70px)" }}
        />
        <div
          aria-hidden
          className="absolute -z-10 rounded-full"
          style={{ width: 280, height: 280, top: 40, right: "6%", background: "var(--color-revision-dot)", opacity: 0.12, filter: "blur(70px)" }}
        />

        <Reveal>
          <HeroIllustration />
        </Reveal>

        <Reveal delayMs={100}>
          <h1 className="font-heading text-[34px] sm:text-[44px] font-bold leading-tight max-w-2xl mb-4">
            {t.landingHeroTitle}
          </h1>
        </Reveal>
        <Reveal delayMs={180}>
          <p className="text-base sm:text-lg max-w-xl mb-14" style={{ color: "var(--color-text-muted)" }}>
            {t.landingHeroSubtitle}
          </p>
        </Reveal>

        <Reveal>
          <h2 className="font-heading text-2xl sm:text-[28px] font-semibold mb-7">{t.landingProblemHeading}</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-3xl mb-16">
          <Reveal delayMs={0}>
            <InfoCard tone="neutral" icon="🙋" title={t.landingProblem1Title} description={t.landingProblem1Body} />
          </Reveal>
          <Reveal delayMs={80}>
            <InfoCard tone="neutral" icon="📚" title={t.landingProblem2Title} description={t.landingProblem2Body} />
          </Reveal>
          <Reveal delayMs={160}>
            <InfoCard tone="neutral" icon="🧩" title={t.landingProblem3Title} description={t.landingProblem3Body} />
          </Reveal>
          <Reveal delayMs={240}>
            <InfoCard tone="neutral" icon="💰" title={t.landingProblem4Title} description={t.landingProblem4Body} />
          </Reveal>
        </div>

        <Reveal>
          <h2 className="font-heading text-2xl sm:text-[28px] font-semibold mb-7">{t.landingSolutionHeading}</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-3xl mb-16">
          <Reveal delayMs={0}>
            <InfoCard tone="positive" icon="💬" title={t.landingSolution1Title} description={t.landingSolution1Body} />
          </Reveal>
          <Reveal delayMs={80}>
            <InfoCard tone="positive" icon="🧠" title={t.landingSolution2Title} description={t.landingSolution2Body} />
          </Reveal>
          <Reveal delayMs={160}>
            <InfoCard tone="positive" icon="🎯" title={t.landingSolution3Title} description={t.landingSolution3Body} />
          </Reveal>
          <Reveal delayMs={240}>
            <InfoCard tone="positive" icon="🌱" title={t.landingSolution4Title} description={t.landingSolution4Body} />
          </Reveal>
        </div>

        <Reveal>
          <h2 className="font-heading text-2xl sm:text-[28px] font-semibold mb-1.5">{t.landingReadyHeading}</h2>
        </Reveal>
        <Reveal delayMs={80}>
          <p className="text-sm mb-7" style={{ color: "var(--color-text-muted)" }}>
            {t.landingReadySubtitle}
          </p>
        </Reveal>
        <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
          <Reveal delayMs={0}>
            <RoleCard
              icon="🎓"
              title={t.landingStudentTitle}
              description={t.landingStudentDescription}
              href="/onboarding"
              cta={t.landingStudentCta}
            />
          </Reveal>
          <Reveal delayMs={100}>
            <RoleCard
              icon="🧑‍🏫"
              title={t.landingTeacherTitle}
              description={t.landingTeacherDescription}
              href="/teacher-onboarding"
              cta={t.landingTeacherCta}
            />
          </Reveal>
        </div>
      </div>

      <footer className="text-center py-8 text-xs" style={{ color: "var(--color-text-muted)" }}>
        {t.landingFooter}
      </footer>
    </main>
  );
}

/**
 * Wraps a section/card so it fades + slides up the first time it scrolls
 * into view, instead of everything appearing at once. One IntersectionObserver
 * per instance is cheap at this page's scale (a dozen or so cards); the CSS
 * transition itself is the only cost that matters once revealed, and
 * globals.css disables it entirely under prefers-reduced-motion.
 */
function Reveal({ children, delayMs = 0 }: { children: React.ReactNode; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal${visible ? " reveal-visible" : ""}`} style={{ transitionDelay: `${delayMs}ms` }}>
      {children}
    </div>
  );
}

/** A simple flat-illustration child reading a book, with a few floating
 * "it clicked" sparkles — hand-drawn shapes, not a photo, so there's no
 * licensing question and it matches the app's existing green/warm palette. */
function HeroIllustration() {
  return (
    <svg width="220" height="190" viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6" role="presentation">
      <ellipse cx="110" cy="172" rx="62" ry="9" fill="var(--color-border)" opacity="0.6" />

      {/* sparkles */}
      <g className="float-bob" style={{ animationDelay: "0s" }}>
        <path d="M52 44 L56 54 L66 58 L56 62 L52 72 L48 62 L38 58 L48 54 Z" fill="var(--color-revision-dot)" />
      </g>
      <g className="float-bob" style={{ animationDelay: "0.6s" }}>
        <path d="M172 34 L175 41 L182 44 L175 47 L172 54 L169 47 L162 44 L169 41 Z" fill="var(--color-revision-dot)" />
      </g>
      <g className="float-bob" style={{ animationDelay: "1.1s" }}>
        <circle cx="168" cy="70" r="5" fill="var(--color-mastered-dot)" />
      </g>

      {/* sitting body */}
      <ellipse cx="110" cy="140" rx="54" ry="36" fill="var(--color-primary)" />
      <rect x="80" y="82" width="60" height="62" rx="24" fill="var(--color-primary)" />

      {/* head */}
      <circle cx="110" cy="62" r="30" fill="#C68A5B" />
      <path d="M82 54 Q110 22 138 54 Q138 38 110 34 Q82 38 82 54 Z" fill="#3B2A22" />

      {/* face */}
      <circle cx="100" cy="64" r="3.2" fill="var(--color-text)" />
      <circle cx="120" cy="64" r="3.2" fill="var(--color-text)" />
      <path d="M101 74 Q110 80 119 74" stroke="var(--color-text)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <ellipse cx="90" cy="70" rx="4" ry="3" fill="#E8A07A" opacity="0.6" />
      <ellipse cx="130" cy="70" rx="4" ry="3" fill="#E8A07A" opacity="0.6" />

      {/* book */}
      <path d="M78 120 L110 112 L110 148 L78 156 Z" fill="#FFFDF7" stroke="var(--color-border)" strokeWidth="1.5" />
      <path d="M142 120 L110 112 L110 148 L142 156 Z" fill="#FFFDF7" stroke="var(--color-border)" strokeWidth="1.5" />
      <path d="M85 126 L102 121" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M85 134 L102 129" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M118 121 L135 126" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M118 129 L135 134" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round" />

      {/* hands holding book */}
      <circle cx="80" cy="122" r="7" fill="#C68A5B" />
      <circle cx="140" cy="122" r="7" fill="#C68A5B" />
    </svg>
  );
}

function InfoCard({
  tone,
  icon,
  title,
  description,
}: {
  tone: "neutral" | "positive";
  icon: string;
  title: string;
  description: string;
}) {
  const style =
    tone === "positive"
      ? { background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)", border: "1px solid transparent" }
      : { background: "var(--color-surface)", color: "var(--color-text)", border: "1px solid var(--color-border)" };
  return (
    <div
      className="group flex flex-col items-start text-left gap-2 p-6 rounded-card transition-transform duration-150 hover:-translate-y-1 hover:shadow-md"
      style={style}
    >
      <div className="text-3xl transition-transform duration-150 group-hover:scale-110">{icon}</div>
      <div className="font-heading text-base font-semibold">{title}</div>
      <div className="text-sm leading-relaxed" style={{ color: tone === "positive" ? "var(--color-mastered-fg)" : "var(--color-text-muted)" }}>
        {description}
      </div>
    </div>
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
      className="group flex flex-col items-center text-center p-8 rounded-card transition-transform duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="text-4xl mb-3 transition-transform duration-150 group-hover:scale-110">{icon}</div>
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
