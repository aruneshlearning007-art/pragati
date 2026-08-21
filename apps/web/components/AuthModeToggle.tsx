"use client";

import { UI, type Language } from "@/lib/i18n";

export function AuthModeToggle({
  mode,
  onChange,
  language,
}: {
  mode: "signup" | "login";
  onChange: (mode: "signup" | "login") => void;
  language: Language;
}) {
  const t = UI[language];
  return (
    <div className="flex gap-2 mb-6 p-1 rounded-xl" style={{ background: "var(--color-bg)" }}>
      {(["signup", "login"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className="flex-1 py-2 rounded-lg font-semibold text-sm"
          style={{
            background: mode === m ? "var(--color-primary)" : "transparent",
            color: mode === m ? "white" : "var(--color-text-muted)",
          }}
        >
          {m === "signup" ? t.authTabSignup : t.authTabLogin}
        </button>
      ))}
    </div>
  );
}
