import { useStore } from "../store";

export function EnvPanel() {
  const env = useStore((s) => s.env);
  if (!env) return <div className="empty">No env loaded.</div>;

  return (
    <div className="state">
      <div className="dim2 mono" style={{ padding: "4px 7px", wordBreak: "break-all" }}>
        {env.env_file ?? "(no env file)"}
      </div>
      {env.missing?.length > 0 && (
        <div style={{ color: "var(--c-error)", padding: "4px 7px", fontSize: 11 }}>
          missing required: {env.missing.join(", ")}
        </div>
      )}
      {(env.vars ?? []).map((v: any) => (
        <div className="srow" key={v.key}>
          <span className="k" style={{ color: v.redacted ? "var(--c-tool)" : "var(--c-state)" }}>
            {v.key}
          </span>
          <span className="v">{v.value}</span>
        </div>
      ))}
    </div>
  );
}
