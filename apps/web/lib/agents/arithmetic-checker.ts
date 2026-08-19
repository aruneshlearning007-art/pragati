export interface ArithmeticFlag {
  quote: string;
  reason: string;
}

// Matches a single binary arithmetic claim written as "A op B = C" — e.g.
// "24 x 3 = 72", "45 - 18 = 27", "12.5 + 3 = 15.5". Deliberately narrow: no
// multi-operator expressions, no fractions, no algebraic variables — those
// are out of scope for v1. Note this never false-positives on algebra like
// "2x = 10": the regex requires a THIRD number directly before "=", and
// "x" alone (no digit before the "=") never satisfies that.
const EXPR_REGEX = /(-?\d[\d,]*(?:\.\d+)?)\s*([+\-×x*÷/])\s*(-?\d[\d,]*(?:\.\d+)?)\s*=\s*(-?\d[\d,]*(?:\.\d+)?)/g;

/**
 * Deterministic, code-based double-check for simple arithmetic claims in
 * generated text — a safety net alongside the LLM Verifier, since the
 * model that writes content can and does make real calculation mistakes
 * (confirmed live: Gemini got a rounding answer wrong, caught only
 * because the Verifier happened to re-derive it correctly). This is not a
 * replacement for the LLM check — it only catches the narrow "A op B = C"
 * shape, not word problems or multi-step reasoning.
 */
export function checkArithmetic(text: string): ArithmeticFlag[] {
  const flags: ArithmeticFlag[] = [];
  for (const m of text.matchAll(EXPR_REGEX)) {
    const [full, aStr, op, bStr, resultStr] = m;
    const a = parseFloat(aStr.replace(/,/g, ""));
    const b = parseFloat(bStr.replace(/,/g, ""));
    const claimed = parseFloat(resultStr.replace(/,/g, ""));

    let actual: number;
    if (op === "+") actual = a + b;
    else if (op === "-") actual = a - b;
    else if (op === "×" || op === "x" || op === "*") actual = a * b;
    else {
      if (b === 0) continue; // "÷" or "/" — skip division by zero silently
      actual = a / b;
    }

    const tolerance = Math.max(0.01, Math.abs(actual) * 0.001);
    if (Math.abs(actual - claimed) > tolerance) {
      flags.push({
        quote: full.trim(),
        reason: `Arithmetic error: ${aStr} ${op} ${bStr} = ${actual}, not ${resultStr}.`,
      });
    }
  }
  return flags;
}
