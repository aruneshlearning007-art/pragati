"use client";

import { useState } from "react";
import { RichText } from "@/components/RichText";
import { UI, type Language } from "@/lib/i18n";

export interface WorkedExampleStep {
  explanation: string;
  work: string;
}

export interface WorkedExample {
  problem: string;
  steps: WorkedExampleStep[];
  answer: string;
}

/**
 * Renders a fully-solved, step-by-step example problem — the single most
 * research-validated math teaching technique (the "worked-example
 * effect"). Steps are revealed progressively rather than all at once
 * ("faded worked examples"), so a student can try predicting the next
 * step before seeing it, instead of just reading a finished solution.
 */
export function WorkedExampleView({ example, language }: { example: WorkedExample; language: Language }) {
  const t = UI[language];
  const [revealed, setRevealed] = useState(example.steps.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="p-3.5 rounded-[10px]" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
        <RichText text={example.problem} className="text-[14px] font-semibold leading-relaxed whitespace-pre-wrap" />
      </div>

      <div className="flex flex-col gap-2.5">
        {example.steps.slice(0, revealed).map((step, i) => (
          <div key={i} className="flex gap-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
            >
              {i + 1}
            </div>
            <div className="flex-1">
              <RichText text={step.explanation} className="text-[13.5px] leading-relaxed whitespace-pre-wrap mb-1" />
              <RichText
                text={step.work}
                className="text-[14px] font-semibold px-2.5 py-1.5 rounded-md inline-block"
              />
            </div>
          </div>
        ))}
      </div>

      {revealed < example.steps.length ? (
        <button
          onClick={() => setRevealed((r) => r + 1)}
          className="self-start px-3.5 py-1.5 rounded-lg text-xs font-bold"
          style={{ border: "1px solid var(--color-primary)", color: "var(--color-primary)" }}
        >
          {t.showNextStep}
        </button>
      ) : (
        <div className="p-3 rounded-[10px] text-[14px] font-bold" style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}>
          {t.answer}: <RichText text={example.answer} className="inline" />
        </div>
      )}
    </div>
  );
}
