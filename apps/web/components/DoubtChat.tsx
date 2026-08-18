"use client";

import { useEffect, useRef, useState } from "react";
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
        body: JSON.stringify({ message: text }),
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
        className="fixed rounded-full text-white text-xl shadow-lg"
        style={{
          bottom: 28,
          right: 36,
          width: 56,
          height: 56,
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
          className="fixed flex flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{
            bottom: 96,
            right: 36,
            width: 360,
            height: 460,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            zIndex: 20,
          }}
        >
          <div
            className="px-4.5 py-3.5"
            style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-mastered-bg)" }}
          >
            <div className="text-sm font-bold" style={{ color: "var(--color-mastered-fg)" }}>
              {t.doubtTitle}
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-auto p-3.5 flex flex-col gap-2.5">
            {displayMessages.map((m) => (
              <div
                key={m.id}
                className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13.5px] leading-relaxed whitespace-pre-wrap"
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "var(--color-primary)" : "var(--color-bg)",
                  color: m.role === "user" ? "white" : "var(--color-text)",
                }}
              >
                {m.text}
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
