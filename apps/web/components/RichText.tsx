import katex from "katex";
import { renderWithTooltips, type KeyTerm } from "@/lib/richtext";

// Matches $$...$$ (display/block math) or $...$ (inline math). Order
// matters — the $$ alternative must come first so a $$...$$ block isn't
// mistakenly split into two $...$ matches.
const MATH_REGEX = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

interface Segment {
  type: "text" | "math";
  value: string;
  display: boolean;
}

function splitSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  MATH_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MATH_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index), display: false });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "math", value: match[1], display: true });
    } else {
      segments.push({ type: "math", value: match[2], display: false });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex), display: false });
  }
  return segments;
}

/**
 * Renders plain text with two things layered on top: $...$/$$...$$ math
 * notation (rendered via KaTeX — the model is instructed to use these
 * delimiters, see withBaseInstructions), and key-term tooltips (via the
 * existing renderWithTooltips, applied only to the non-math segments).
 * KaTeX's own output is escaped/self-generated markup — trust:false (the
 * default) blocks its dangerous commands, so dangerouslySetInnerHTML here
 * is safe even though the source TeX comes from an LLM, not a human.
 */
export function RichText({
  text,
  keyTerms = [],
  className,
  style,
}: {
  text: string;
  keyTerms?: KeyTerm[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const segments = splitSegments(text);
  return (
    <div className={className} style={style}>
      {segments.map((seg, i) => {
        if (seg.type === "math") {
          const html = katex.renderToString(seg.value, { throwOnError: false, trust: false, displayMode: seg.display });
          return seg.display ? (
            <div key={i} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
          );
        }
        return <span key={i}>{renderWithTooltips(seg.value, keyTerms)}</span>;
      })}
    </div>
  );
}
