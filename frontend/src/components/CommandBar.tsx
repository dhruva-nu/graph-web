import { useStore } from "../store";

export function CommandBar() {
  const { manifest, assistants, graphId, threadId, status } = useStore();
  const selectGraph = useStore((s) => s.selectGraph);
  const newThread = useStore((s) => s.newThread);

  const live = status === "running";

  return (
    <div className="cmdbar">
      <div className="brand">
        <div className="logo" />
        <div>
          graph<span style={{ color: "var(--accent)" }}>·</span>web
          <div className="sub">{manifest?.name ?? "no project loaded"}</div>
        </div>
      </div>

      {assistants.length > 0 && (
        <select
          className="gw"
          value={graphId ?? ""}
          onChange={(e) => void selectGraph(e.target.value)}
        >
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      )}

      {threadId && (
        <span className="pill">
          <span className="mono">thread {threadId.slice(0, 6)}</span>
        </span>
      )}

      <div className="spacer" />

      <span className="pill">
        <span className={"dot " + (live ? "live" : status === "error" ? "err" : "")} />
        {live ? "streaming" : status}
      </span>
      <button className="gw" onClick={() => void newThread()} disabled={!graphId}>
        + New thread
      </button>
    </div>
  );
}
