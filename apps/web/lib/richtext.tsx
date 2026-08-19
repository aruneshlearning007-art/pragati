export interface KeyTerm {
  term: string;
  meaning: string;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps whole-word, case-insensitive matches of any key term in a tooltip
 * span. Explain text is written freely by the model and often uses the
 * plain-English plural of a glossary term ("cotyledons") rather than the
 * exact singular listed ("Cotyledon") — matching allows one optional
 * trailing "s" so simple plurals still tooltip, without loosening the
 * match enough to catch unrelated words that merely start the same way
 * (e.g. "seed" must not match inside "seedling").
 */
export function renderWithTooltips(text: string, keyTerms: KeyTerm[]) {
  if (keyTerms.length === 0) return text;
  const sorted = [...keyTerms].sort((a, b) => b.term.length - a.term.length);
  const pattern = sorted.map((kt) => `${escapeRegExp(kt.term)}s?`).join("|");
  const regex = new RegExp(`\\b(${pattern})\\b`, "gi");
  const meaningByLower = new Map(keyTerms.map((kt) => [kt.term.toLowerCase(), kt.meaning]));

  return text.split(regex).map((part, i) => {
    const lower = part.toLowerCase();
    const meaning = meaningByLower.get(lower) ?? (lower.endsWith("s") ? meaningByLower.get(lower.slice(0, -1)) : undefined);
    if (!meaning) return part;
    return (
      <span key={i} title={meaning} style={{ borderBottom: "1.5px dotted var(--color-primary)", cursor: "help" }}>
        {part}
      </span>
    );
  });
}
