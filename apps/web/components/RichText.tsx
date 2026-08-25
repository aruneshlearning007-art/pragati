import katex from "katex";
import { renderWithTooltips, type KeyTerm } from "@/lib/richtext";

// Matches $$...$$ (display/block math) or $...$ (inline math). Order
// matters — the $$ alternative must come first so a $$...$$ block isn't
// mistakenly split into two $...$ matches.
const MATH_REGEX = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

// The model reliably wraps math in $...$ inside prose (question stems,
// notes body), but is inconsistent about it when an entire short string
// IS the math — e.g. a quiz option that's just a fraction, written as the
// bare LaTeX command with no $ delimiters at all. Rather than depend on
// prompt compliance for every such case, treat a whole trimmed string as
// math if it looks like nothing but a LaTeX command (starts with a
// backslash, only letters/braces/digits/basic math punctuation after) —
// this only matches short option-like strings, never normal prose.
const BARE_LATEX_REGEX = /^\\[a-zA-Z]+(\{[^{}]*\}|\^|_|[0-9+\-*/., ])*$/;

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
  text: string | null | undefined;
  keyTerms?: KeyTerm[];
  className?: string;
  style?: React.CSSProperties;
}) {
  // Normalize once — text crosses an LLM/JSON boundary at runtime, so it can
  // be undefined/null despite the prop type saying otherwise (a still-live
  // example: the same worked-example step object below the fold on this
  // page can validly omit "work"). Every downstream use (here, and
  // splitSegments' own text.length/text.slice) must see a real string.
  const safeText = text ?? "";
  const trimmed = safeText.trim();
  const segments = BARE_LATEX_REGEX.test(trimmed) ? [{ type: "math" as const, value: trimmed, display: false }] : splitSegments(safeText);
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
