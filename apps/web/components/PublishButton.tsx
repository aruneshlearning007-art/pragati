"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UI, type Language } from "@/lib/i18n";

export function PublishButton({ chapterId, language }: { chapterId: string; language: Language }) {
  const router = useRouter();
  const t = UI[language];
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/chapters/${chapterId}/publish`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Something went wrong.");
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPublishing(false);
    }
  }

  if (done) {
    return (
      <div
        className="px-5 py-3 rounded-xl text-sm font-bold"
        style={{ background: "var(--color-mastered-bg)", color: "var(--color-mastered-fg)" }}
      >
        {t.published}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={publishing}
        onClick={handlePublish}
        className="px-5 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40"
        style={{ background: "var(--color-primary)" }}
      >
        {publishing ? "…" : t.publishCta}
      </button>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
