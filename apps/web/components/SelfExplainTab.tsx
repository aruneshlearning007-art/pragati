"use client";

import { useEffect, useState } from "react";
import { RichText } from "@/components/RichText";
import { UI, type Language } from "@/lib/i18n";

interface HistoryItem {
  id: string;
  explanationText: string;
  feedbackText: string;
  timestamp: string;
}

export function SelfExplainTab({ topicId, language }: { topicId: string; language: Language }) {
  const t = UI[language];
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/topics/${topicId}/self-explain`)
      .then((r) => r.json())
      .then((data) => {
        setHistory(data.history ?? []);
        setDisabled(!!data.disabled);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [topicId]);

  async function submit() {
    const text = input.trim();
    if (!text || thinking || disabled) return;
    setThinking(true);
    setLatestFeedback(null);
    try {
      const res = await fetch(`/api/topics/${topicId}/self-explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ explanation: text }),
      });
      const data = await res.json();
      setLatestFeedback(data.feedback);
      if (data.disabled) setDisabled(true);
      setHistory((h) => [
        { id: `local-${Date.now()}`, explanationText: text, feedbackText: data.feedback, timestamp: new Date().toISOString() },
        ...h,
      ]);
      setInput("");
    } catch {
      setLatestFeedback(language === "hi" ? "क्षमा करें, अभी प्रतिक्रिया नहीं दे सका।" : "Sorry, couldn't get feedback right now.");
    } finally {
      setThinking(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
        {t.selfExplainIntro}
      </p>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t.selfExplainPlaceholder}
        disabled={disabled}
        rows={6}
        className="w-full p-3.5 rounded-card text-[14.5px]"
        style={{ border: "1px solid var(--color-border)", fontFamily: "inherit" }}
      />
      <button
        onClick={submit}
        disabled={!input.trim() || thinking || disabled}
        className="self-start px-4 py-2.5 rounded-[10px] text-white font-bold text-[13px] disabled:opacity-40"
        style={{ border: "none", background: "var(--color-primary)" }}
      >
        {thinking ? t.selfExplainThinking : t.selfExplainSubmit}
      </button>

      {latestFeedback && (
        <div className="p-4.5 rounded-card" style={{ background: "var(--color-mastered-bg)" }}>
          <div className="font-heading font-semibold text-[14px] mb-1.5" style={{ color: "var(--color-mastered-fg)" }}>
            {t.selfExplainFeedbackTitle}
          </div>
          <RichText text={latestFeedback} className="text-[14px] leading-relaxed whitespace-pre-wrap" />
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="text-xs font-bold" style={{ color: "var(--color-text-muted)" }}>
            {t.selfExplainHistoryTitle}
          </div>
          {history.map((h) => (
            <div key={h.id} className="p-3.5 rounded-card" style={{ border: "1px solid var(--color-border)" }}>
              <RichText text={h.explanationText} className="text-[13.5px] mb-2" style={{ color: "var(--color-text-muted)" }} />
              <RichText text={h.feedbackText} className="text-[13.5px] whitespace-pre-wrap" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
