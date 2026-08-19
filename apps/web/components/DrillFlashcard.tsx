"use client";

import { useState } from "react";
import { generateDrillProblem, type DrillOp, type DrillProblem } from "@/lib/drill";
import { UI, type Language } from "@/lib/i18n";

const OPS: { op: DrillOp; labelKey: "drillAdd" | "drillSubtract" | "drillMultiply" | "drillDivide" }[] = [
  { op: "+", labelKey: "drillAdd" },
  { op: "-", labelKey: "drillSubtract" },
  { op: "×", labelKey: "drillMultiply" },
  { op: "÷", labelKey: "drillDivide" },
];
const RANGES = [10, 12, 20, 100];

/**
 * Self-contained, stateless (no DB/LLM) fact-fluency flashcard — picks an
 * operation and range, then one problem at a time with immediate
 * correct/incorrect feedback. Streak resets on navigation away; real
 * spaced-repetition scheduling (re-surfacing facts a student struggles
 * with) is an explicit v2, not built here.
 */
export function DrillFlashcard({ language }: { language: Language }) {
  const t = UI[language];
  const [op, setOp] = useState<DrillOp | null>(null);
  const [maxOperand, setMaxOperand] = useState(12);
  const [problem, setProblem] = useState<DrillProblem | null>(null);
  const [typed, setTyped] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [streak, setStreak] = useState(0);

  function start(chosenOp: DrillOp) {
    setOp(chosenOp);
    setProblem(generateDrillProblem(chosenOp, maxOperand));
    setTyped("");
    setFeedback(null);
    setStreak(0);
  }

  function submit() {
    if (!problem) return;
    const value = parseFloat(typed);
    if (value === problem.answer) {
      setFeedback("correct");
      setStreak((s) => s + 1);
    } else {
      setFeedback("incorrect");
      setStreak(0);
    }
  }

  function next() {
    if (!op) return;
    setProblem(generateDrillProblem(op, maxOperand));
    setTyped("");
    setFeedback(null);
  }

  if (!op || !problem) {
    return (
      <div className="max-w-md flex flex-col gap-4">
        <div className="text-sm font-semibold" style={{ color: "var(--color-text-muted)" }}>
          {t.drillPickOperation}
        </div>
        <div className="flex gap-2 flex-wrap">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setMaxOperand(r)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{
                border: `1.5px solid ${maxOperand === r ? "var(--color-primary)" : "var(--color-border)"}`,
                background: maxOperand === r ? "var(--color-mastered-bg)" : "white",
              }}
            >
              1-{r}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {OPS.map(({ op: o, labelKey }) => (
            <button
              key={o}
              onClick={() => start(o)}
              className="px-4 py-3 rounded-xl font-bold text-sm"
              style={{ background: "var(--color-primary)", color: "white" }}
            >
              {t[labelKey]} ({o})
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOp(null)} className="text-xs font-semibold" style={{ color: "var(--color-primary)" }}>
          ← {t.drillPickOperation}
        </button>
        <div className="text-xs font-bold" style={{ color: "var(--color-text-muted)" }}>
          {t.drillStreak}: {streak}
        </div>
      </div>

      <div className="p-8 rounded-card text-center" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="text-[32px] font-extrabold mb-4">
          {problem.a} {problem.op} {problem.b} = ?
        </div>
        {feedback === null ? (
          <div className="flex gap-2 justify-center">
            <input
              type="number"
              inputMode="decimal"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="input text-center text-lg"
              style={{ maxWidth: 140 }}
              autoFocus
            />
            <button
              onClick={submit}
              disabled={typed === ""}
              className="px-5 py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-40"
              style={{ background: "var(--color-primary)" }}
            >
              {t.seeResults}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="text-base font-bold"
              style={{ color: feedback === "correct" ? "var(--color-mastered-fg)" : "var(--color-revision-fg)" }}
            >
              {feedback === "correct" ? t.drillCorrect : `${t.drillIncorrect} ${problem.answer}`}
            </div>
            <button
              onClick={next}
              className="px-5 py-2.5 rounded-xl text-white font-bold text-sm"
              style={{ background: "var(--color-primary)" }}
            >
              {t.drillNext}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
