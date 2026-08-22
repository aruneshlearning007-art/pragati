"use client";

import { Mafs, Coordinates, Plot, Point } from "mafs";
import "mafs/core.css";
import { evaluate } from "mathjs";

export interface MathGraphPoint {
  x: number;
  y: number;
  label: string;
}

export interface FunctionVisual {
  kind: "function";
  title: string;
  expression: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  points?: MathGraphPoint[];
}

export function MathGraphView({ graph }: { graph: FunctionVisual }) {
  function fn(x: number): number {
    try {
      const y = evaluate(graph.expression, { x });
      return typeof y === "number" && Number.isFinite(y) ? y : NaN;
    } catch {
      return NaN;
    }
  }

  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
        {graph.title}
      </div>
      <Mafs viewBox={{ x: [graph.xMin, graph.xMax], y: [graph.yMin, graph.yMax] }}>
        <Coordinates.Cartesian />
        <Plot.OfX y={fn} />
        {graph.points?.map((p, i) => <Point key={i} x={p.x} y={p.y} />)}
      </Mafs>
      {graph.points && graph.points.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-2 text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          {graph.points.map((p, i) => (
            <span key={i}>
              {p.label} ({p.x}, {p.y})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
