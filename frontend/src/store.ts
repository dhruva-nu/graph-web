import { create } from "zustand";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { api } from "./lib/api";
import type {
  AssistantSummary,
  ChatMessage,
  ContextField,
  GwEvent,
  Schemas,
  StateField,
  Topology,
} from "./lib/types";

type Status = "idle" | "loading" | "running" | "error";

interface Store {
  // bootstrap
  manifest: any | null;
  assistants: AssistantSummary[];
  graphId: string | null;
  schemas: Schemas | null;
  topology: Topology | null;
  env: any | null;
  threadId: string | null;
  status: Status;
  bootError: string | null;

  // run state
  messages: ChatMessage[];
  events: GwEvent[];
  turnPrompts: Record<string, string>;
  stateValues: Record<string, unknown>;
  flashedKeys: Set<string>;
  activeNode: string | null;
  selectedSeq: number | null;

  // topology view layout direction (user-controlled)
  topologyDir: "TB" | "LR";

  // mock editor working values
  contextValues: Record<string, unknown>;
  seedValues: Record<string, unknown>;

  // actions
  boot: () => Promise<void>;
  selectGraph: (id: string) => Promise<void>;
  newThread: () => Promise<void>;
  setContextValue: (name: string, v: unknown) => void;
  setSeedValue: (name: string, v: unknown) => void;
  select: (seq: number | null) => void;
  setTopologyDir: (dir: "TB" | "LR") => void;
  send: (text: string) => Promise<void>;
}

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
  topologyDir: "TB",
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
  setTopologyDir(dir) {
    set({ topologyDir: dir });
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

    const apply = (ev: GwEvent) => {
      set((s) => {
        const next: Partial<Store> = { events: [...s.events, ev] };
        if (ev.type === "run_start") {
          next.turnPrompts = { ...s.turnPrompts, [ev.run_id]: text };
        } else if (ev.type === "message_delta" && ev.delta) {
          next.messages = s.messages.map((m) =>
            m.id === aiId ? { ...m, content: m.content + ev.delta } : m
          );
          if (ev.author) next.activeNode = ev.author;
        } else if (ev.type === "node_end") {
          if (ev.author) next.activeNode = ev.author;
          if (ev.state_delta) {
            const sv = { ...s.stateValues, ...ev.state_delta };
            next.stateValues = sv;
            next.flashedKeys = new Set(Object.keys(ev.state_delta));
          }
        } else if (ev.type === "state_snapshot" && ev.state_snapshot) {
          next.stateValues = ev.state_snapshot;
        } else if (ev.type === "tool_call" && ev.tool) {
          next.messages = s.messages.map((m) =>
            m.id === aiId
              ? { ...m, tools: [...(m.tools || []), { name: ev.tool!.name!, args: ev.tool!.args }] }
              : m
          );
          if (ev.author) next.activeNode = ev.author;
        } else if (ev.type === "tool_result" && ev.tool) {
          next.messages = s.messages.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  tools: (m.tools || []).map((t) =>
                    t.name === ev.tool!.name && t.result === undefined
                      ? { ...t, result: ev.tool!.result, mocked: ev.tool!.mocked }
                      : t
                  ),
                }
              : m
          );
        } else if (ev.type === "message" && ev.message && ev.message.content) {
          next.messages = s.messages.map((m) =>
            m.id === aiId && !m.content ? { ...m, content: ev.message!.content } : m
          );
        }
        return next as Store;
      });
    };

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
            apply(JSON.parse(ev.data) as GwEvent);
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
