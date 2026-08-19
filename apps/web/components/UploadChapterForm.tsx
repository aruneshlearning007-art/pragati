"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI, CLASS_OPTIONS, BOARD_OPTIONS, type Language } from "@/lib/i18n";

interface Subject {
  id: string;
  name: string;
}

const NEW_SUBJECT_VALUE = "__new__";

export function UploadChapterForm({ subjects, language }: { subjects: Subject[]; language: Language }) {
  const router = useRouter();
  const t = UI[language];

  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? NEW_SUBJECT_VALUE);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [cls, setCls] = useState("Class 6");
  const [board, setBoard] = useState("CBSE");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewSubject = subjectId === NEW_SUBJECT_VALUE;
  const canSubmit =
    title.trim() && sourceText.trim() && (isNewSubject ? newSubjectName.trim() : subjectId) && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: isNewSubject ? null : subjectId,
          newSubjectName: isNewSubject ? newSubjectName : null,
          cls,
          board,
          title,
          sourceText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Something went wrong generating this chapter. Please try again.");
      router.push(`/teacher/chapters/${data.chapterId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div
        className="p-10 rounded-card text-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="font-heading font-bold text-[15px] mb-1.5">{t.generating}</div>
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Notes, explanations and a quiz are being generated from your chapter — this can take up to a minute.
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-8 rounded-card"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h1 className="font-heading text-2xl font-semibold mb-6">{t.uploadChapterCta}</h1>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label={t.subject}>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SUBJECT_VALUE}>+ {t.subjectNew}</option>
          </select>
        </Field>
        {isNewSubject && (
          <Field label={t.subjectNew}>
            <input
              className="input"
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="e.g. Social Studies"
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Field label={t.cls}>
          <select className="input" value={cls} onChange={(e) => setCls(e.target.value)}>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.board}>
          <select className="input" value={board} onChange={(e) => setBoard(e.target.value)}>
            {BOARD_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t.chapterTitle}>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.chapterTitlePlaceholder}
        />
      </Field>

      <Field label={t.pasteSourceLabel}>
        <textarea
          className="input"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder={t.pasteSourcePlaceholder}
          rows={8}
          style={{ resize: "vertical" }}
        />
      </Field>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full py-3.5 rounded-2xl text-white font-heading font-semibold text-base disabled:opacity-40 mt-2"
        style={{ background: "var(--color-primary)" }}
      >
        {t.generateAndVerify}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-ink mb-1.5">{label}</label>
      {children}
    </div>
  );
}
