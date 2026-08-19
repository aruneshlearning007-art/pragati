export type DrillOp = "+" | "-" | "×" | "÷";

export interface DrillProblem {
  a: number;
  b: number;
  op: DrillOp;
  answer: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pure, deterministic-shape problem generator — no LLM call, no DB, so
 * this is free and instant. v1 fact-fluency drill: random problems per
 * session, no persistence or spaced-repetition scheduling (that's an
 * explicit v2 once there's a reason to track per-fact performance).
 */
export function generateDrillProblem(op: DrillOp, maxOperand: number): DrillProblem {
  if (op === "+") {
    const a = randInt(1, maxOperand);
    const b = randInt(1, maxOperand);
    return { a, b, op, answer: a + b };
  }
  if (op === "-") {
    // Always ordered so the result is never negative.
    const x = randInt(1, maxOperand);
    const y = randInt(1, maxOperand);
    const a = Math.max(x, y);
    const b = Math.min(x, y);
    return { a, b, op, answer: a - b };
  }
  if (op === "×") {
    const a = randInt(1, maxOperand);
    const b = randInt(1, maxOperand);
    return { a, b, op, answer: a * b };
  }
  // Division — generated from a whole-number quotient first, so it's
  // always exact (no messy decimal answers to grade with tolerance).
  const b = randInt(1, maxOperand);
  const quotient = randInt(1, maxOperand);
  const a = b * quotient;
  return { a, b, op, answer: quotient };
}
