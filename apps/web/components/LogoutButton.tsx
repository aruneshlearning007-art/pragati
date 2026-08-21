"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UI, type Language } from "@/lib/i18n";

export function LogoutButton({ language }: { language: Language }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const t = UI[language];

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="px-3.5 py-1.5 rounded-full text-xs font-bold border disabled:opacity-50"
      style={{ background: "var(--color-bg)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
    >
      {t.logout}
    </button>
  );
}
