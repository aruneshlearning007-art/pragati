"use client";

import { useEffect, useState } from "react";
import { RichText } from "@/components/RichText";
import { DrillFlashcard } from "@/components/DrillFlashcard";
import { UI, type Language } from "@/lib/i18n";

interface QuizQuestionView {
  id: string;
  kind: string;
  text: string;
  options: string[];
  imageLabel: string | null;
}

const KIND_LABEL: Record<string, string> = {
  mcq: "Multiple choice",
  assertion_reason: "Assertion-Reason",
  picture: "Picture-based",
  numeric: "Numeric answer",
};

export function PracticeTab({ topicId, subjectName, language }: { topicId: string; subjectName?: string; language: Language }) {
  const t = UI[language];
  const [mode, setMode] = useState<"quiz" | "drill">("quiz");
  const [questions, setQuestions] = useState<QuizQuestionView[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    correctByQuestionId: Record<string, boolean>;
    feedbackByQuestionId: Record<string, { correctIndex: number | null; correctValue: number | null; misconception: string | null }>;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  const isMath = (subjectName ?? "").toLowerCase().includes("math");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/topics/${topicId}/quiz`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuestions(data.questions ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  async function handleSubmit() {
    const res = await fetch(`/api/topics/${topicId}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setResult(data);
    setSubmitted(true);
  }

  function retry() {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
  }

  const modeToggle = isMath && (
    <div className="flex gap-2 mb-4">
      {(["quiz", "drill"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold"
          style={{
            background: mode === m ? "var(--color-primary)" : "var(--color-surface)",
            color: mode === m ? "white" : "var(--color-text)",
            border: "1px solid var(--color-border)",
          }}
        >
          {m === "quiz" ? t.practiceModeQuiz : t.practiceModeDrill}
        </button>
      ))}
    </div>
  );

  if (isMath && mode === "drill") {
    return (
      <div>
        {modeToggle}
        <DrillFlashcard language={language} />
      </div>
    );
  }

  if (loadError) {
    return <p style={{ color: "var(--color-text-muted)" }}>Could not load practice questions. Please refresh.</p>;
  }

  if (!questions) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-6 w-2/5 rounded-md animate-pulse" style={{ background: "var(--color-notstarted-bg)" }} />
        <div className="h-20 rounded-xl animate-pulse" style={{ background: "var(--color-surface)" }} />
        <div className="h-20 rounded-xl animate-pulse" style={{ background: "var(--color-surface)" }} />
      </div>
    );
  }

  if (submitted && result) {
    const pct = result.total ? result.score / result.total : 0;
    const message =
      pct >= 0.8
        ? language === "hi"
          ? "शानदार! यह विषय अब पूर्ण निपुणता में है।"
          : "Excellent! This topic is now mastered."
        : language === "hi"
          ? "अच्छी कोशिश। कुछ हिस्से अभी दोहराने लायक हैं।"
          : "Good attempt. A few parts are still worth revisiting.";
    const wrongQuestions = questions.filter((q) => result.correctByQuestionId[q.id] === false);
    return (
      <div className="max-w-md flex flex-col gap-4">
        <div
          className="p-8 rounded-card text-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="text-[13px] font-bold mb-1.5" style={{ color: "var(--color-text-muted)" }}>
            {t.yourScore}
          </div>
          <div className="text-[40px] font-extrabold mb-2.5" style={{ color: "var(--color-primary)" }}>
            {result.score} / {result.total}
          </div>
          <div className="text-sm mb-5">{message}</div>
          <button
            onClick={retry}
            className="px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ border: "1px solid var(--color-border)", background: "white" }}
          >
            {t.retry}
          </button>
        </div>

        {wrongQuestions.length > 0 && (
          <div className="p-5.5 rounded-card" style={{ background: "var(--color-revision-bg)", border: "1px solid var(--color-revision-dot)" }}>
            <div className="font-heading font-bold text-[14px] mb-3" style={{ color: "var(--color-revision-fg)" }}>
              {t.whatWentWrong}
            </div>
            <div className="flex flex-col gap-3.5">
              {wrongQuestions.map((q) => {
                const feedback = result.feedbackByQuestionId[q.id];
                const isNumeric = q.kind === "numeric";
                const yourIndex = answers[q.id];
                const yourAnswerDisplay = isNumeric ? String(yourIndex ?? "—") : (q.options[yourIndex] ?? "—");
                const correctAnswerDisplay = isNumeric
                  ? String(feedback.correctValue ?? "—")
                  : (feedback.correctIndex !== null ? q.options[feedback.correctIndex] : "—");
                return (
                  <div key={q.id} className="text-[13px]">
                    <RichText text={q.text} className="font-semibold mb-1" />
                    <div style={{ color: "var(--color-text-muted)" }}>
                      {isNumeric ? t.yourTypedAnswer : t.yourAnswer}: {yourAnswerDisplay}
                    </div>
                    <div style={{ color: "var(--color-mastered-fg)" }}>
                      {t.correctAnswer}: {correctAnswerDisplay}
                    </div>
                    {feedback.misconception && (
                      <div className="italic mt-0.5" style={{ color: "var(--color-revision-fg)" }}>
                        {t.commonMixup}: {feedback.misconception}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {modeToggle}
      {questions.map((q) => (
        <div key={q.id} className="p-5.5 rounded-card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
            {KIND_LABEL[q.kind] ?? q.kind}
          </div>
          <RichText text={q.text} className="text-[15px] font-semibold mb-3.5 leading-snug" />
          {q.kind === "picture" && q.imageLabel && (
            <div
              className="h-28 mb-3.5 rounded-[10px] flex items-center justify-center text-xs font-mono text-center px-3"
              style={{ background: "repeating-linear-gradient(45deg, #ececf5, #ececf5 8px, #e2e2ee 8px, #e2e2ee 16px)", color: "#6b5bb5" }}
            >
              {q.imageLabel}
            </div>
          )}
          {q.kind === "numeric" ? (
            <input
              type="number"
              inputMode="decimal"
              placeholder={t.numericAnswerPlaceholder}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: parseFloat(e.target.value) }))}
              className="input"
              style={{ maxWidth: 200 }}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {q.options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                  className="text-left px-3.5 py-2.5 rounded-[10px] text-[13.5px]"
                  style={{
                    border: `1.5px solid ${answers[q.id] === idx ? "var(--color-primary)" : "var(--color-border)"}`,
                    background: answers[q.id] === idx ? "var(--color-mastered-bg)" : "white",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={handleSubmit}
        disabled={answeredCount < questions.length}
        className="self-start px-6 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
        style={{ background: "var(--color-primary)" }}
      >
        {t.seeResults}
      </button>
    </div>
  );
}
