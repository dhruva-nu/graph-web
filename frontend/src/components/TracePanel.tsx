import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { GwEvent } from "../lib/types";

const RAIL: Record<string, string> = {
  run_start: "var(--text-2)",
  run_complete: "var(--text-2)",
  node_start: "var(--c-node)",
  node_end: "var(--c-node)",
  message: "var(--c-ai)",
  message_delta: "var(--c-ai)",
  tool_call: "var(--c-tool)",
  tool_result: "var(--c-tool)",
  state_snapshot: "var(--c-state)",
  state_delta: "var(--c-state)",
  error: "var(--c-error)",
};

const CHIP: Record<string, string> = {
  run_start: "run",
  run_complete: "done",
  node_end: "node",
  message: "msg",
  tool_call: "call",
  tool_result: "result",
  state_snapshot: "state",
  error: "error",
};

function summary(ev: GwEvent): string {
  switch (ev.type) {
    case "node_end":
      return ev.state_delta ? `→ ${Object.keys(ev.state_delta).join(", ")}` : "(no change)";
    case "tool_call":
      return `${ev.tool?.name}(${Object.values(ev.tool?.args ?? {}).join(", ")})`;
    case "tool_result":
      return String(ev.tool?.result ?? "").slice(0, 80);
    case "message":
      return String(ev.message?.content ?? "").slice(0, 80) || "(empty)";
    case "state_snapshot":
      return Object.keys(ev.state_snapshot ?? {}).join(", ");
    case "error":
      return ev.content ?? "error";
    default:
      return "";
  }
}

interface Turn {
  runId: string;
  prompt: string;
  rows: GwEvent[];
  done: boolean;
}

export function TracePanel() {
  const events = useStore((s) => s.events);
  const selectedSeq = useStore((s) => s.selectedSeq);
  const select = useStore((s) => s.select);
  const turnPrompts = useStore((s) => s.turnPrompts);
  const running = useStore((s) => s.status === "running");

  // Per-turn open/close: undefined = use default (collapsed, except the live turn).
  const [manual, setManual] = useState<Record<string, boolean>>({});

  // Hide raw message_delta tokens from the trace list (noisy); keep them for the count.
  const rows = events.filter((e) => e.type !== "message_delta");
  const selected = events.find((e) => e.seq === selectedSeq) ?? null;

  // Group rows into turns (one run = one user-message → response cycle).
  const turns: Turn[] = [];
  const byRun = new Map<string, Turn>();
  for (const ev of rows) {
    let t = byRun.get(ev.run_id);
    if (!t) {
      t = { runId: ev.run_id, prompt: turnPrompts[ev.run_id] ?? "", rows: [], done: false };
      byRun.set(ev.run_id, t);
      turns.push(t);
    }
    t.rows.push(ev);
    if (ev.type === "run_complete") t.done = true;
  }
  const lastRunId = turns.length ? turns[turns.length - 1].runId : null;

  const isOpen = (t: Turn) => {
    if (t.runId in manual) return manual[t.runId];
    // Default: collapsed — except the turn that's currently streaming.
    return running && t.runId === lastRunId && !t.done;
  };
  const toggle = (runId: string, open: boolean) =>
    setManual((m) => ({ ...m, [runId]: open }));

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, select]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="trace" style={{ flex: 1, overflow: "auto" }}>
        {turns.length === 0 && <div className="empty">Events from each run appear here.</div>}
        {turns.map((t, i) => {
          const open = isOpen(t);
          const mocked = t.rows.some((r) => r.tool?.mocked);
          return (
            <div className="turn" key={t.runId}>
              <div className="turn-head" onClick={() => toggle(t.runId, !open)}>
                <span className={"chev" + (open ? " open" : "")}>▸</span>
                <span className="turn-n">Turn {i + 1}</span>
                <span className="turn-prompt">{t.prompt || "(no prompt)"}</span>
                {!t.done && <span className="turn-live">live</span>}
                {mocked && <span className="mocktag">MOCK</span>}
                <span className="turn-count">{t.rows.length}</span>
              </div>
              {open &&
                t.rows.map((ev) => (
                  <div
                    key={ev.seq}
                    className={"erow" + (ev.seq === selectedSeq ? " sel" : "")}
                    onClick={() => select(ev.seq === selectedSeq ? null : ev.seq)}
                  >
                    <span className="rail" style={{ background: RAIL[ev.type] ?? "var(--text-2)" }} />
                    <span className="chip">{CHIP[ev.type] ?? ev.type}</span>
                    <span className="etext">
                      {ev.author && <span className="author">{ev.author} </span>}
                      {summary(ev)}
                    </span>
                    {ev.tool?.mocked && <span className="mocktag">MOCK</span>}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      {selected && (
        <div className="detail" style={{ borderTop: "1px solid var(--border)", maxHeight: "45%", overflow: "auto" }}>
          <h4 style={{ display: "flex", alignItems: "center" }}>
            <span>{selected.type} {selected.author ? `· ${selected.author}` : ""}</span>
            <button
              className="detail-close"
              title="Close (Esc)"
              onClick={() => select(null)}
            >
              ✕
            </button>
          </h4>
          <pre className="json">{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
