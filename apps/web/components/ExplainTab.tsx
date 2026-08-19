"use client";

import { useState } from "react";
import { UI, type Language } from "@/lib/i18n";

interface PicturePanel {
  icon: string;
  title: string;
  description: string;
}

interface ExplainVariant {
  mode: string;
  body: string;
  panels: PicturePanel[] | null;
}

const MODE_LABEL: Record<string, { en: string; hi: string }> = {
  story: { en: "Story", hi: "कहानी" },
  picture: { en: "Picture", hi: "चित्र" },
  realworld: { en: "Real-world", hi: "वास्तविक जीवन" },
  gofurther: { en: "Go further", hi: "और आगे" },
};

function VariantCard({ variant, language }: { variant: ExplainVariant; language: Language }) {
  return (
    <div className="p-5.5 rounded-card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--color-primary)" }}>
        {MODE_LABEL[variant.mode]?.[language] ?? variant.mode}
      </div>
      <div className="text-[14.5px] leading-relaxed whitespace-pre-wrap mb-3.5">{variant.body}</div>
      {variant.mode === "picture" && variant.panels && variant.panels.length > 0 && (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.min(variant.panels.length, 2)}, 1fr)` }}
        >
          {variant.panels.map((p, i) => (
            <div
              key={i}
              className="p-4 rounded-[10px] text-center"
              style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
            >
              <div className="text-3xl mb-2">{p.icon}</div>
              <div className="text-[13px] font-bold mb-1">{p.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {p.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExplainTab({ variants, language }: { variants: ExplainVariant[]; language: Language }) {
  const t = UI[language];
  const [activeMode, setActiveMode] = useState(variants[0]?.mode ?? "story");
  const [compare, setCompare] = useState(false);
  const [compareMode, setCompareMode] = useState(variants[1]?.mode ?? variants[0]?.mode);

  const active = variants.find((v) => v.mode === activeMode) ?? variants[0];
  const secondary = variants.find((v) => v.mode === compareMode) ?? variants[1];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {variants.map((v) => (
            <button
              key={v.mode}
              onClick={() => setActiveMode(v.mode)}
              className="px-3.5 py-2 rounded-xl text-[13px] font-bold"
              style={{
                background: activeMode === v.mode ? "var(--color-primary)" : "var(--color-surface)",
                color: activeMode === v.mode ? "white" : "var(--color-text)",
                border: "1px solid var(--color-border)",
              }}
            >
              {MODE_LABEL[v.mode]?.[language] ?? v.mode}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer select-none">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          {t.compareToggle}
        </label>
      </div>

      {!compare && active && <VariantCard variant={active} language={language} />}

      {compare && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
              {MODE_LABEL[activeMode]?.[language] ?? activeMode}
            </div>
            {active && <VariantCard variant={active} language={language} />}
          </div>
          <div>
            <select
              className="input mb-2 text-xs font-semibold"
              value={compareMode}
              onChange={(e) => setCompareMode(e.target.value)}
            >
              {variants
                .filter((v) => v.mode !== activeMode)
                .map((v) => (
                  <option key={v.mode} value={v.mode}>
                    {MODE_LABEL[v.mode]?.[language] ?? v.mode}
                  </option>
                ))}
            </select>
            {secondary && <VariantCard variant={secondary} language={language} />}
          </div>
        </div>
      )}
    </div>
  );
}
