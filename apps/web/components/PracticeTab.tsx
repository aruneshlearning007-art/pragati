"use client";

import { useEffect, useState } from "react";
import { UI, type Language } from "@/lib/i18n";

interface QuizQuestionView {
  id: string;
  kind: string;
  text: string;
  options: string[];
  imageLabel: string | null;
}

export function PracticeTab({ topicId, language }: { topicId: string; language: Language }) {
  const t = UI[language];
  const [questions, setQuestions] = useState<QuizQuestionView[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; correctByQuestionId: Record<string, boolean> } | null>(null);
  const [loadError, setLoadError] = useState(false);

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
    return (
      <div
        className="max-w-md p-8 rounded-card text-center"
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
    );
  }

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {questions.map((q) => (
        <div key={q.id} className="p-5.5 rounded-card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
            {q.kind === "mcq" ? "Multiple choice" : q.kind === "assertion_reason" ? "Assertion-Reason" : "Picture-based"}
          </div>
          <div className="text-[15px] font-semibold mb-3.5 leading-snug">{q.text}</div>
          {q.kind === "picture" && q.imageLabel && (
            <div
              className="h-28 mb-3.5 rounded-[10px] flex items-center justify-center text-xs font-mono text-center px-3"
              style={{ background: "repeating-linear-gradient(45deg, #ececf5, #ececf5 8px, #e2e2ee 8px, #e2e2ee 16px)", color: "#6b5bb5" }}
            >
              {q.imageLabel}
            </div>
          )}
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
