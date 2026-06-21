import { create } from "zustand";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { api } from "../lib/api";
import type { ContextField, GwEvent, StateField } from "../lib/types";
import { reduceEvent } from "./eventReducer";
import type { Store } from "./types";

export type { Status, Store } from "./types";

function defaultsFrom(fields: { name: string; default: unknown }[]) {
  const o: Record<string, unknown> = {};
  for (const f of fields) o[f.name] = f.default;
  return o;
}

export const useStore = create<Store>((set, get) => ({
  manifest: null,
  assistants: [],
  graphId: null,
  schemas: null,
  topology: null,
  env: null,
  threadId: null,
  status: "loading",
  bootError: null,
  messages: [],
  events: [],
  turnPrompts: {},
  stateValues: {},
  flashedKeys: new Set(),
  activeNode: null,
  selectedSeq: null,
  contextValues: {},
  seedValues: {},

  async boot() {
    try {
      const [manifest, assistants, env] = await Promise.all([
        api.manifest(),
        api.assistants(),
        api.env().catch(() => null),
      ]);
      set({ manifest, assistants, env, status: "idle" });
      const first = manifest?.ui?.default_graph || assistants[0]?.id;
      if (first) await get().selectGraph(first);
    } catch (e: any) {
      set({ status: "error", bootError: String(e?.message || e) });
    }
  },

  async selectGraph(id) {
    set({ status: "loading", graphId: id });
    const [schemas, topology] = await Promise.all([
      api.schemas(id),
      api.topology(id).catch(() => null),
    ]);
    set({
      schemas,
      topology,
      contextValues: defaultsFrom(schemas.context_fields as ContextField[]),
      seedValues: defaultsFrom(
        (schemas.state_fields as StateField[]).filter((f) => f.seed)
      ),
      status: "idle",
    });
    await get().newThread();
  },

  async newThread() {
    const id = get().graphId;
    if (!id) return;
    const t = await api.createThread(id);
    set({
      threadId: t.id,
      messages: [],
      events: [],
      turnPrompts: {},
      stateValues: {},
      activeNode: null,
      selectedSeq: null,
    });
  },

  setContextValue(name, v) {
    set((s) => ({ contextValues: { ...s.contextValues, [name]: v } }));
  },
  setSeedValue(name, v) {
    set((s) => ({ seedValues: { ...s.seedValues, [name]: v } }));
  },
  select(seq) {
    set({ selectedSeq: seq });
  },

  async send(text) {
    const { graphId, threadId, contextValues, seedValues } = get();
    if (!graphId || !threadId || !text.trim()) return;

    const humanId = "h" + Date.now();
    const aiId = "a" + Date.now();
    set((s) => ({
      status: "running",
      messages: [
        ...s.messages,
        { id: humanId, role: "human", content: text },
        { id: aiId, role: "ai", content: "", streaming: true, tools: [] },
      ],
    }));

    try {
      await fetchEventSource(`/api/threads/${threadId}/runs/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        openWhenHidden: true,
        body: JSON.stringify({
          graph_id: graphId,
          thread_id: threadId,
          message: text,
          context_values: contextValues,
          state_values: seedValues,
        }),
        onmessage(ev) {
          if (!ev.data) return;
          try {
            const parsed = JSON.parse(ev.data) as GwEvent;
            set((s) => reduceEvent(s, parsed, aiId, text) as Store);
          } catch {
            /* ignore */
          }
        },
        onerror(err) {
          throw err;
        },
      });
    } finally {
      set((s) => ({
        status: "idle",
        activeNode: null,
        messages: s.messages.map((m) => (m.id === aiId ? { ...m, streaming: false } : m)),
      }));
    }
  },
}));
