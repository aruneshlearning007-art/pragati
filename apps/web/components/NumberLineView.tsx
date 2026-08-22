export interface NumberLinePoint {
  value: number;
  label: string;
}

export interface NumberLineVisual {
  kind: "numberline";
  title: string;
  min: number;
  max: number;
  points: NumberLinePoint[];
  highlightRange?: { from: number; to: number };
}

const WIDTH = 560;
const HEIGHT = 90;
const PADDING = 24;

export function NumberLineView({ data }: { data: NumberLineVisual }) {
  const span = data.max - data.min || 1;
  const innerWidth = WIDTH - PADDING * 2;
  const xPos = (value: number) => PADDING + ((value - data.min) / span) * innerWidth;
  const lineY = HEIGHT - 32;

  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
        {data.title}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxWidth: WIDTH }}>
        {data.highlightRange && (
          <rect
            x={xPos(data.highlightRange.from)}
            y={lineY - 4}
            width={xPos(data.highlightRange.to) - xPos(data.highlightRange.from)}
            height={8}
            fill="var(--color-mastered-bg)"
          />
        )}
        <line x1={PADDING} y1={lineY} x2={WIDTH - PADDING} y2={lineY} stroke="var(--color-border)" strokeWidth={2} />
        {/* Arrowheads */}
        <path d={`M ${PADDING} ${lineY} l 8 -5 l 0 10 z`} fill="var(--color-border)" />
        <path d={`M ${WIDTH - PADDING} ${lineY} l -8 -5 l 0 10 z`} fill="var(--color-border)" />

        {data.points.map((p, i) => {
          const x = xPos(p.value);
          return (
            <g key={i}>
              {p.label && (
                <text x={x} y={lineY - 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-primary)">
                  {p.label}
                </text>
              )}
              <circle cx={x} cy={lineY} r={5} fill="var(--color-primary)" />
              <text x={x} y={lineY + 20} textAnchor="middle" fontSize={11} fill="var(--color-text-muted)">
                {p.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
