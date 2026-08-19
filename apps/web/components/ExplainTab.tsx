"use client";

import { useState } from "react";
import { RichText } from "@/components/RichText";
import { WorkedExampleView, type WorkedExample } from "@/components/WorkedExampleView";
import { UI, type Language } from "@/lib/i18n";
import type { KeyTerm } from "@/lib/richtext";

interface DiagramStep {
  icon: string;
  label: string;
  description: string;
}

interface PictureDiagram {
  steps: DiagramStep[];
  connectors: string[];
}

interface ExplainVariant {
  mode: string;
  body: string;
  diagram: PictureDiagram | null;
  workedExample: WorkedExample | null;
}

function DiagramView({ diagram }: { diagram: PictureDiagram }) {
  return (
    <div className="flex flex-wrap items-stretch gap-1">
      {diagram.steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className="w-32 p-3 rounded-[10px] text-center flex flex-col"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
          >
            <div className="text-2xl mb-1.5">{step.icon}</div>
            <div className="text-xs font-bold mb-1">{step.label}</div>
            <div className="text-[11px] leading-snug" style={{ color: "var(--color-text-muted)" }}>
              {step.description}
            </div>
          </div>
          {i < diagram.connectors.length && (
            <div className="flex flex-col items-center px-1" style={{ width: 56 }}>
              <div className="text-lg" style={{ color: "var(--color-primary)" }}>
                →
              </div>
              <div className="text-[10px] text-center leading-tight" style={{ color: "var(--color-text-muted)" }}>
                {diagram.connectors[i]}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const MODE_LABEL: Record<string, { en: string; hi: string }> = {
  story: { en: "Story", hi: "कहानी" },
  picture: { en: "Picture", hi: "चित्र" },
  realworld: { en: "Real-world", hi: "वास्तविक जीवन" },
  gofurther: { en: "Go further", hi: "और आगे" },
  worked: { en: "Worked example", hi: "हल किया उदाहरण" },
};

function VariantCard({ variant, keyTerms, language }: { variant: ExplainVariant; keyTerms: KeyTerm[]; language: Language }) {
  return (
    <div className="p-5.5 rounded-card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--color-primary)" }}>
        {MODE_LABEL[variant.mode]?.[language] ?? variant.mode}
      </div>
      <RichText
        text={variant.body}
        keyTerms={keyTerms}
        className="text-[14.5px] leading-relaxed whitespace-pre-wrap mb-3.5"
      />
      {variant.mode === "picture" && variant.diagram && variant.diagram.steps.length > 0 && (
        <div className="overflow-x-auto">
          <DiagramView diagram={variant.diagram} />
        </div>
      )}
      {variant.mode === "worked" && variant.workedExample && (
        <WorkedExampleView example={variant.workedExample} language={language} />
      )}
    </div>
  );
}

export function ExplainTab({
  variants,
  keyTerms,
  language,
}: {
  variants: ExplainVariant[];
  keyTerms: KeyTerm[];
  language: Language;
}) {
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

      {!compare && active && <VariantCard variant={active} keyTerms={keyTerms} language={language} />}

      {compare && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
              {MODE_LABEL[activeMode]?.[language] ?? activeMode}
            </div>
            {active && <VariantCard variant={active} keyTerms={keyTerms} language={language} />}
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
            {secondary && <VariantCard variant={secondary} keyTerms={keyTerms} language={language} />}
          </div>
        </div>
      )}
    </div>
  );
}
