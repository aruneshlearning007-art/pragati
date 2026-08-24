"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export interface SidebarSubjectItem {
  id: string;
  name: string;
  dotColor: string;
}

// A small client component so the sidebar can read the current ?subject=
// query param for active-state highlighting — layouts can't receive
// searchParams directly in the App Router, only page.tsx can, so just this
// interactive slice is split out while the rest of the sidebar stays in the
// server-rendered layout.
export function SidebarSubjectList({ subjects }: { subjects: SidebarSubjectItem[] }) {
  const searchParams = useSearchParams();
  const activeId = searchParams.get("subject") ?? subjects[0]?.id;

  return (
    <>
      {subjects.map((sub) => {
        const active = sub.id === activeId;
        return (
          <Link
            key={sub.id}
            href={`/student?subject=${sub.id}`}
            className="flex items-center gap-2.5 w-full text-left px-2.5 py-2.5 rounded-[10px] text-sm font-medium mb-0.5 transition-colors duration-150 hover:bg-[var(--color-bg)]"
            style={
              active
                ? { background: "var(--color-primary)", color: "white" }
                : { color: "var(--color-text)" }
            }
          >
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: active ? "white" : sub.dotColor }} />
            {sub.name}
          </Link>
        );
      })}
    </>
  );
}
