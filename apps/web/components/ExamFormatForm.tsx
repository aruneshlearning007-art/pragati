"use client";

import { useEffect, useState } from "react";
import { UI, CLASS_OPTIONS, BOARD_OPTIONS, type Language } from "@/lib/i18n";

interface Subject {
  id: string;
  name: string;
}

interface SectionRow {
  label: string;
  kind: string;
  count: number;
  marksEach: number;
}

const DEFAULT_SECTIONS: SectionRow[] = [{ label: "Fill in the Blanks", kind: "fill_blank", count: 5, marksEach: 1 }];

export function ExamFormatForm({ subjects, language }: { subjects: Subject[]; language: Language }) {
  const t = UI[language];
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [cls, setCls] = useState("Class 6");
  const [board, setBoard] = useState("CBSE");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [sections, setSections] = useState<SectionRow[]>(DEFAULT_SECTIONS);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    setMessage(null);
    fetch(`/api/teacher/exam-templates?subjectId=${subjectId}&class=${encodeURIComponent(cls)}&board=${encodeURIComponent(board)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.template) {
          setDurationMinutes(data.template.durationMinutes);
          setSections(data.template.sections as SectionRow[]);
          setLoadedExisting(true);
        } else {
          setDurationMinutes(60);
          setSections(DEFAULT_SECTIONS);
          setLoadedExisting(false);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [subjectId, cls, board]);

  const totalMarks = sections.reduce((sum, s) => sum + s.count * s.marksEach, 0);

  function updateSection(i: number, patch: Partial<SectionRow>) {
    setSections((secs) => secs.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addSection() {
    setSections((secs) => [...secs, { label: "", kind: "mcq", count: 5, marksEach: 1 }]);
  }
  function removeSection(i: number) {
    setSections((secs) => secs.filter((_, idx) => idx !== i));
  }

  async function save(publish: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/teacher/exam-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId, cls, board, durationMinutes, sections, publish }),
      });
      if (!res.ok) throw new Error("failed");
      setLoadedExisting(true);
      setMessage(publish ? t.examFormatPublished : t.examFormatSaved);
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!subjectId && sections.length > 0 && sections.every((s) => s.label.trim() && s.count > 0 && s.marksEach > 0);

  return (
    <div className="p-8 rounded-card" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
      <h1 className="font-heading text-2xl font-semibold mb-1.5">{t.examFormatTitle}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--color-text-muted)" }}>
        {t.examFormatSubtitle}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <Field label={t.subject}>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
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

      {loadedExisting && (
        <div className="text-xs mb-4 font-semibold" style={{ color: "var(--color-primary)" }}>
          {t.examFormatLoadedExisting}
        </div>
      )}

      <Field label={t.examFormatDurationLabel}>
        <input
          type="number"
          className="input"
          style={{ maxWidth: 160 }}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 0)}
        />
      </Field>

      <div className="font-heading font-semibold text-[15px] mt-6 mb-3">{t.examFormatSectionsTitle}</div>
      <div className="flex flex-col gap-3 mb-3">
        {sections.map((s, i) => (
          <div
            key={i}
            className="p-4 rounded-xl grid gap-2.5 items-end"
            style={{ border: "1px solid var(--color-border)", gridTemplateColumns: "2fr 1.4fr 0.8fr 0.8fr auto" }}
          >
            <Field label={t.examFormatSectionLabel}>
              <input
                className="input"
                value={s.label}
                placeholder={t.examFormatSectionLabelPlaceholder}
                onChange={(e) => updateSection(i, { label: e.target.value })}
              />
            </Field>
            <Field label={t.examFormatKindLabel}>
              <select className="input" value={s.kind} onChange={(e) => updateSection(i, { kind: e.target.value })}>
                <option value="fill_blank">{t.examFormatKindFillBlank}</option>
                <option value="true_false">{t.examFormatKindTrueFalse}</option>
                <option value="mcq">{t.examFormatKindMcq}</option>
                <option value="subjective">{t.examFormatKindSubjective}</option>
              </select>
            </Field>
            <Field label={t.examFormatCountLabel}>
              <input
                type="number"
                className="input"
                value={s.count}
                onChange={(e) => updateSection(i, { count: parseInt(e.target.value, 10) || 0 })}
              />
            </Field>
            <Field label={t.examFormatMarksLabel}>
              <input
                type="number"
                className="input"
                value={s.marksEach}
                onChange={(e) => updateSection(i, { marksEach: parseInt(e.target.value, 10) || 0 })}
              />
            </Field>
            <button
              type="button"
              onClick={() => removeSection(i)}
              className="text-xs font-bold px-2 py-2.5"
              style={{ color: "var(--color-revision-fg)" }}
            >
              {t.examFormatRemoveSection}
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addSection} className="text-sm font-bold mb-5" style={{ color: "var(--color-primary)" }}>
        {t.examFormatAddSection}
      </button>

      <div className="text-sm font-bold mb-5">
        {t.examFormatTotalMarks}: {totalMarks}
      </div>

      {message && (
        <p className="text-sm mb-4 font-semibold" style={{ color: "var(--color-mastered-fg)" }}>
          {message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => save(false)}
          className="px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-40"
          style={{ border: "1px solid var(--color-border)", background: "white" }}
        >
          {t.examFormatSaveDraft}
        </button>
        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => save(true)}
          className="px-5 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
          style={{ background: "var(--color-primary)" }}
        >
          {t.examFormatPublish}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1">{label}</label>
      {children}
    </div>
  );
}
