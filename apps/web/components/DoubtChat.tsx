"use client";

import { useEffect, useRef, useState } from "react";
import { RichText } from "@/components/RichText";
import { UI, type Language } from "@/lib/i18n";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export function DoubtChat({ topicId, language }: { topicId: string; language: Language }) {
  const t = UI[language];
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [mode, setMode] = useState<"direct" | "guide">("direct");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || loaded) return;
    fetch(`/api/topics/${topicId}/doubt`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages ?? []);
        setDisabled(!!data.disabled);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded, topicId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking || disabled) return;
    setInput("");
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", text }]);
    setThinking(true);
    try {
      const res = await fetch(`/api/topics/${topicId}/doubt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, mode }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { id: `local-${Date.now()}-r`, role: "assistant", text: data.reply }]);
      if (data.disabled) setDisabled(true);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `local-${Date.now()}-e`,
          role: "assistant",
          text: language === "hi" ? "क्षमा करें, अभी उत्तर नहीं दे सका।" : "Sorry, I couldn't answer right now.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  const displayMessages: Message[] =
    messages.length === 0 ? [{ id: "greeting", role: "assistant", text: t.doubtGreeting }] : messages;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.doubtTitle}
        className="fixed rounded-full text-white text-xl shadow-lg right-5 bottom-5 sm:right-9 sm:bottom-7 w-14 h-14"
        style={{
          border: "none",
          background: "var(--color-primary)",
          cursor: "pointer",
          zIndex: 20,
        }}
      >
        {open ? "✕" : "?"}
      </button>

      {open && (
        <div
          // Fixed 360px-right-anchored on desktop; on narrow screens (the
          // panel doesn't fit in 390px viewport width otherwise, which was
          // silently clipping the input off-screen) it spans full width
          // minus a small inset instead, and height is viewport-relative
          // rather than a fixed px so it can't overflow a short mobile
          // viewport when the on-screen keyboard is open.
          className="fixed flex flex-col overflow-hidden rounded-2xl shadow-2xl left-3 right-3 bottom-20 max-h-[70vh] sm:left-auto sm:right-9 sm:bottom-24 sm:w-[360px] sm:h-[460px] sm:max-h-[460px]"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            zIndex: 20,
          }}
        >
          <div
            className="px-4.5 py-3.5 flex items-center justify-between gap-2"
            style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-mastered-bg)" }}
          >
            <div className="text-sm font-bold" style={{ color: "var(--color-mastered-fg)" }}>
              {t.doubtTitle}
            </div>
            <div className="flex rounded-full p-[3px]" style={{ background: "white" }}>
              {(["direct", "guide"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-2.5 py-1 rounded-full text-[10.5px] font-bold"
                  style={{
                    background: mode === m ? "var(--color-primary)" : "transparent",
                    color: mode === m ? "white" : "var(--color-mastered-fg)",
                  }}
                >
                  {m === "direct" ? t.doubtModeDirect : t.doubtModeGuide}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-auto p-3.5 flex flex-col gap-2.5">
            {displayMessages.map((m) => (
              <div
                key={m.id}
                className="max-w-[85%] px-3.5 py-2.5 rounded-xl"
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "var(--color-primary)" : "var(--color-bg)",
                  color: m.role === "user" ? "white" : "var(--color-text)",
                }}
              >
                <RichText text={m.text} className="text-[13.5px] leading-relaxed whitespace-pre-wrap" />
              </div>
            ))}
            {thinking && (
              <div
                className="self-start px-3.5 py-2.5 rounded-xl text-[13.5px]"
                style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}
              >
                {t.doubtThinking}
              </div>
            )}
          </div>

          <div className="flex gap-2 p-3" style={{ borderTop: "1px solid var(--color-border)" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={t.doubtPlaceholder}
              disabled={disabled}
              className="flex-1 px-3 py-2.5 rounded-[10px] text-[13.5px]"
              style={{ border: "1px solid var(--color-border)", fontFamily: "inherit" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || thinking || disabled}
              className="px-4 py-2.5 rounded-[10px] text-white font-bold text-[13px] disabled:opacity-40"
              style={{ border: "none", background: "var(--color-primary)" }}
            >
              {t.doubtSend}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
