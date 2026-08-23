import Link from "next/link";
import { STATUS_STYLES, type Language, UI } from "@/lib/i18n";
import type { TopicStatus } from "@/lib/agents/diagnostic";

export interface ConceptMapNode {
  id: string;
  title: string;
  status: TopicStatus;
}

export function ConceptMapView({ nodes, language }: { nodes: ConceptMapNode[]; language: Language }) {
  const t = UI[language];
  return (
    <div className="flex flex-wrap items-stretch gap-1">
      {nodes.map((node, i) => {
        const style = STATUS_STYLES[node.status];
        const label = node.status === "mastered" ? t.mastered : node.status === "revision" ? t.revision : t.notStarted;
        return (
          <div key={node.id} className="flex items-center gap-1">
            <Link
              href={`/student/topics/${node.id}`}
              className="w-40 p-3.5 rounded-[10px] text-center flex flex-col items-center gap-1.5"
              style={{ background: style.bg, border: `1px solid ${style.dot}` }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "var(--color-surface)", color: style.fg }}
              >
                {i + 1}
              </div>
              <div className="text-xs font-bold leading-snug" style={{ color: style.fg }}>
                {node.title}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold" style={{ color: style.fg }}>
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: style.dot }} />
                {label}
              </div>
            </Link>
            {i < nodes.length - 1 && (
              <div className="text-lg px-1" style={{ color: "var(--color-text-muted)" }}>
                →
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
