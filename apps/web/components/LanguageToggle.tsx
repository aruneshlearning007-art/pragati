"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Language } from "@/lib/i18n";

export function LanguageToggle({ current }: { current: Language }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setLanguage(lang: Language) {
    if (lang === current || pending) return;
    setPending(true);
    await fetch("/api/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <div
      className="flex rounded-full p-[3px] border"
      style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}
    >
      {(["en", "hi"] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold"
          style={{
            background: current === lang ? "var(--color-primary)" : "transparent",
            color: current === lang ? "white" : "var(--color-text)",
          }}
        >
          {lang === "en" ? "EN" : "हिं"}
        </button>
      ))}
    </div>
  );
}
