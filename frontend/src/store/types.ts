import type {
  AssistantSummary,
  ChatMessage,
  GwEvent,
  Schemas,
  Topology,
} from "../lib/types";

export type Status = "idle" | "loading" | "running" | "error";

export interface Store {
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
