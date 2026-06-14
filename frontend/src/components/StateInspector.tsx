import { useStore } from "../store";

function render(v: unknown) {
  if (v === null || v === undefined) return <span className="v null">null</span>;
  if (typeof v === "object") return <span className="v">{JSON.stringify(v, null, 2)}</span>;
  return <span className="v">{String(v)}</span>;
}

export function StateInspector() {
  const stateValues = useStore((s) => s.stateValues);
  const flashedKeys = useStore((s) => s.flashedKeys);
  const messagesKey = useStore((s) => s.schemas?.messages_key);

  const keys = Object.keys(stateValues).filter((k) => k !== messagesKey);

  if (keys.length === 0) {
    return <div className="empty">Live graph state appears here as the run progresses.</div>;
  }

  return (
    <div className="state">
      {keys.map((k) => (
        <div key={k} className={"srow" + (flashedKeys.has(k) ? " flash" : "")}>
          <span className="k">{k}</span>
          {render(stateValues[k])}
        </div>
      ))}
    </div>
  );
}
