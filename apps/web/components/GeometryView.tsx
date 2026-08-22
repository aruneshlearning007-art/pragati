export interface GeometryVisual {
  kind: "geometry";
  title: string;
  shape: "triangle" | "square" | "rectangle" | "parallelogram" | "circle";
  triangleType?: "equilateral" | "isosceles" | "scalene" | "right";
  sideLabels?: string[];
  angleLabels?: string[];
  radiusLabel?: string;
  showCenter?: boolean;
}

interface Pt {
  x: number;
  y: number;
}

const VIEW = 200;

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(a: Pt, s: number): Pt {
  return { x: a.x * s, y: a.y * s };
}
function len(a: Pt): number {
  return Math.hypot(a.x, a.y);
}
function normalize(a: Pt): Pt {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
function dot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}

// Fixed, hand-verified vertex layouts per shape — the model only ever
// picks which of these to draw, never invents coordinates itself, so
// every shape always actually looks like what it's named (a true
// equilateral triangle, a true square, ...).
function getVertices(shape: GeometryVisual["shape"], triangleType?: GeometryVisual["triangleType"]): Pt[] {
  if (shape === "triangle") {
    switch (triangleType) {
      case "isosceles":
        return [
          { x: 100, y: 30 },
          { x: 180, y: 150 },
          { x: 20, y: 150 },
        ];
      case "scalene":
        return [
          { x: 110, y: 30 },
          { x: 175, y: 140 },
          { x: 30, y: 160 },
        ];
      case "right":
        return [
          { x: 40, y: 50 },
          { x: 40, y: 160 },
          { x: 160, y: 160 },
        ];
      case "equilateral":
      default:
        return [
          { x: 100, y: 25 },
          { x: 165, y: 137 },
          { x: 35, y: 137 },
        ];
    }
  }
  if (shape === "square") {
    return [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ];
  }
  if (shape === "rectangle") {
    const width = 140;
    const height = width / 1.6;
    const left = (VIEW - width) / 2;
    const top = (VIEW - height) / 2;
    return [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height },
    ];
  }
  // parallelogram
  return [
    { x: 80, y: 50 },
    { x: 180, y: 50 },
    { x: 140, y: 150 },
    { x: 40, y: 150 },
  ];
}

function centroidOf(vertices: Pt[]): Pt {
  const sum = vertices.reduce((acc, v) => add(acc, v), { x: 0, y: 0 });
  return scale(sum, 1 / vertices.length);
}

function sideLabelPos(v1: Pt, v2: Pt, centroid: Pt, offset = 16): Pt {
  const mid = scale(add(v1, v2), 0.5);
  const dir = sub(v2, v1);
  let normal = normalize({ x: -dir.y, y: dir.x });
  if (dot(normal, sub(mid, centroid)) < 0) normal = scale(normal, -1);
  return add(mid, scale(normal, offset));
}

function angleLabelPos(vertex: Pt, prev: Pt, next: Pt, offset = 22): Pt {
  const toPrev = normalize(sub(prev, vertex));
  const toNext = normalize(sub(next, vertex));
  const bisector = normalize(add(toPrev, toNext));
  return add(vertex, scale(bisector, offset));
}

function angleArcPath(vertex: Pt, prev: Pt, next: Pt, r = 16): string {
  const toPrev = normalize(sub(prev, vertex));
  const toNext = normalize(sub(next, vertex));
  const p1 = add(vertex, scale(toPrev, r));
  const p2 = add(vertex, scale(toNext, r));
  const cross = toPrev.x * toNext.y - toPrev.y * toNext.x;
  const sweep = cross > 0 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y}`;
}

// The small square corner marker conventionally used for a right angle,
// instead of an arc — also sidesteps a real bug found live-testing: the
// model has no way to know which array index is the right-angle vertex in
// getVertices' fixed "right" layout (it guessed the apex, not the actual
// 90° corner), so this is drawn deterministically at the known vertex
// rather than trusted to the model's angleLabels input at all.
function rightAngleMarkPath(vertex: Pt, prev: Pt, next: Pt, s = 12): string {
  const toPrev = normalize(sub(prev, vertex));
  const toNext = normalize(sub(next, vertex));
  const p1 = add(vertex, scale(toPrev, s));
  const corner = add(p1, scale(toNext, s));
  const p2 = add(vertex, scale(toNext, s));
  return `M ${p1.x} ${p1.y} L ${corner.x} ${corner.y} L ${p2.x} ${p2.y}`;
}

// Index of the right-angle vertex in getVertices' fixed "right" triangle
// layout — see the comment there ([top, RIGHT ANGLE HERE, bottom-right]).
const RIGHT_ANGLE_VERTEX_INDEX = 1;

function PolygonShape({ data }: { data: GeometryVisual }) {
  const vertices = getVertices(data.shape, data.triangleType);
  const centroid = centroidOf(vertices);
  const n = vertices.length;
  const points = vertices.map((v) => `${v.x},${v.y}`).join(" ");

  return (
    <>
      <polygon points={points} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % n];
        const label = data.sideLabels?.[i];
        if (!label) return null;
        const pos = sideLabelPos(v, next, centroid);
        return (
          <text key={`s${i}`} x={pos.x} y={pos.y} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-text)">
            {label}
          </text>
        );
      })}
      {vertices.map((v, i) => {
        const prev = vertices[(i - 1 + n) % n];
        const next = vertices[(i + 1) % n];
        const isFixedRightAngle = data.shape === "triangle" && data.triangleType === "right" && i === RIGHT_ANGLE_VERTEX_INDEX;
        if (isFixedRightAngle) {
          return (
            <path
              key={`a${i}`}
              d={rightAngleMarkPath(v, prev, next)}
              fill="none"
              stroke="var(--color-text-muted)"
              strokeWidth={1.5}
            />
          );
        }
        // The model sometimes labels a second, wrong vertex "90°" too (a
        // duplicate/confused attempt at the right angle) even when told the
        // real one is drawn automatically — since a right triangle can only
        // have one 90° corner and its true location is already guaranteed
        // correct above, drop a stray "90" anywhere else rather than trust
        // it.
        const rawLabel = data.angleLabels?.[i];
        const label =
          data.shape === "triangle" && data.triangleType === "right" && rawLabel && /90/.test(rawLabel) ? "" : rawLabel;
        const arc = <path key={`arc${i}`} d={angleArcPath(v, prev, next)} fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} />;
        if (!label) return arc;
        const pos = angleLabelPos(v, prev, next);
        return (
          <g key={`a${i}`}>
            {arc}
            <text x={pos.x} y={pos.y} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--color-primary)">
              {label}
            </text>
          </g>
        );
      })}
    </>
  );
}

function CircleShape({ data }: { data: GeometryVisual }) {
  const center = { x: 100, y: 100 };
  const radius = 70;
  const angleRad = (-30 * Math.PI) / 180;
  const edge = { x: center.x + radius * Math.cos(angleRad), y: center.y + radius * Math.sin(angleRad) };

  return (
    <>
      <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="var(--color-primary)" strokeWidth={2} />
      {data.showCenter && <circle cx={center.x} cy={center.y} r={3} fill="var(--color-primary)" />}
      {data.radiusLabel && (
        <>
          <line x1={center.x} y1={center.y} x2={edge.x} y2={edge.y} stroke="var(--color-text-muted)" strokeWidth={1.5} />
          <text
            x={(center.x + edge.x) / 2 - 8}
            y={(center.y + edge.y) / 2 - 6}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill="var(--color-text)"
          >
            {data.radiusLabel}
          </text>
        </>
      )}
    </>
  );
}

export function GeometryView({ data }: { data: GeometryVisual }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-muted)" }}>
        {data.title}
      </div>
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="w-full" style={{ maxWidth: 260 }}>
        {data.shape === "circle" ? <CircleShape data={data} /> : <PolygonShape data={data} />}
      </svg>
    </div>
  );
}
