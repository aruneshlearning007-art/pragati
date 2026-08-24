"use client";

import Link from "next/link";
import { useActiveSubjectId } from "@/lib/activeSubjectStore";

export interface SidebarSubjectItem {
  id: string;
  name: string;
  dotColor: string;
}

export function SidebarSubjectList({ subjects }: { subjects: SidebarSubjectItem[] }) {
  const activeId = useActiveSubjectId();

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
