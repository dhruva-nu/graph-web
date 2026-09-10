import type { GwEvent } from "./types";

/** Left-rail accent colour per event type. */
export const RAIL: Record<string, string> = {
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

/** Short chip label per event type. */
export const CHIP: Record<string, string> = {
  run_start: "run",
  run_complete: "done",
  node_end: "node",
  message: "msg",
  tool_call: "call",
  tool_result: "result",
  state_snapshot: "state",
  error: "error",
};

/** One-line human summary of an event for the trace row. */
export function summary(ev: GwEvent): string {
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

export interface Turn {
  runId: string;
  prompt: string;
  rows: GwEvent[];
  done: boolean;
}

/** Group events into turns (one run = one user-message → response cycle). */
export function groupTurns(rows: GwEvent[], turnPrompts: Record<string, string>): Turn[] {
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
  return turns;
}
