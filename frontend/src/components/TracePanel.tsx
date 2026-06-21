import { useEffect, useState } from "react";
import { useStore } from "../store";
import { CHIP, RAIL, groupTurns, summary, type Turn } from "../lib/trace";

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

  const turns = groupTurns(rows, turnPrompts);
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
