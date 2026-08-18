// Deliberately shows the raw error message/stack in the browser. Safe only
// because this app has no real users yet (pilot/founder testing only) — it
// exists so failures are self-diagnosing without needing to fetch Vercel
// logs for every issue. Must be removed/gated before real launch.
export function ErrorCard({ title, error }: { title: string; error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  return (
    <div
      style={{
        background: "#fef2f2",
        border: "1px solid #fca5a5",
        borderRadius: 12,
        padding: 20,
        color: "#7f1d1d",
        maxWidth: 720,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>{title}</div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, fontFamily: "monospace", margin: 0 }}>{message}</pre>
      {stack && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Stack trace</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, fontFamily: "monospace", marginTop: 6 }}>{stack}</pre>
        </details>
      )}
    </div>
  );
}
