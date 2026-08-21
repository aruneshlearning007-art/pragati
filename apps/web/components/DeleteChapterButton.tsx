"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI, type Language } from "@/lib/i18n";

// Redirect to /teacher after deleting (used on the chapter review page,
// which no longer exists once its chapter is gone) vs. just refreshing
// the current list in place (used on the Content Panel's chapter list).
export function DeleteChapterButton({
  chapterId,
  language,
  redirectAfter = false,
  compact = false,
}: {
  chapterId: string;
  language: Language;
  redirectAfter?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const t = UI[language];
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/chapters/${chapterId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong.");
      }
      if (redirectAfter) {
        router.push("/teacher");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-semibold" style={{ color: "var(--color-revision-fg)" }}>
          {t.deleteConfirmMessage}
        </span>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="px-3 py-1.5 rounded-lg text-white text-xs font-bold disabled:opacity-40"
          style={{ background: "var(--color-revision-fg)" }}
        >
          {deleting ? "…" : t.deleteConfirmYes}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold"
          style={{ background: "var(--color-bg)", color: "var(--color-text-muted)" }}
        >
          {t.cancel}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirming(true);
      }}
      className={compact ? "text-xs font-bold px-3 py-1.5 rounded-lg" : "px-5 py-3 rounded-xl font-bold text-sm"}
      style={{ background: "var(--color-bg)", color: "var(--color-revision-fg)", border: "1px solid var(--color-revision-dot)" }}
    >
      {t.deleteChapterCta}
    </button>
  );
}
