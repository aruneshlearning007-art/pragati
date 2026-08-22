export interface FractionBarVisual {
  kind: "fractionbar";
  title: string;
  numerator: number;
  denominator: number;
  secondFraction?: { numerator: number; denominator: number };
}

const TOTAL_WIDTH = 320;

function Bar({ numerator, denominator }: { numerator: number; denominator: number }) {
  const segmentWidth = TOTAL_WIDTH / Math.max(denominator, 1);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex" style={{ width: TOTAL_WIDTH, height: 40 }}>
        {Array.from({ length: denominator }).map((_, i) => (
          <div
            key={i}
            style={{
              width: segmentWidth,
              height: "100%",
              background: i < numerator ? "var(--color-primary)" : "transparent",
              border: "1.5px solid var(--color-border)",
              boxSizing: "border-box",
              marginLeft: i === 0 ? 0 : -1.5,
            }}
          />
        ))}
      </div>
      <div className="text-xs font-semibold text-center" style={{ color: "var(--color-text-muted)" }}>
        {numerator}/{denominator}
      </div>
    </div>
  );
}

export function FractionBarView({ data }: { data: FractionBarVisual }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
        {data.title}
      </div>
      <div className="flex flex-col gap-3">
        <Bar numerator={data.numerator} denominator={data.denominator} />
        {data.secondFraction && (
          <Bar numerator={data.secondFraction.numerator} denominator={data.secondFraction.denominator} />
        )}
      </div>
    </div>
  );
}
