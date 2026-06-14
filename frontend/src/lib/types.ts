export interface AssistantSummary {
  id: string;
  title: string;
  kind: string;
  entrypoint: string;
}

export type FieldType = "string" | "integer" | "number" | "boolean" | "json";

export interface StateField {
  name: string;
  type: FieldType;
  default: unknown;
  editable: boolean;
  seed: boolean;
  nullable: boolean;
  title?: string | null;
}

export interface Inject {
  target: "configurable" | "context" | "contextvar";
  key?: string | null;
  import?: string | null;
}

export interface ContextField {
  name: string;
  type: FieldType;
  default: unknown;
  editable: boolean;
  title?: string | null;
  inject: Inject[];
}

export interface ToolMock {
  mode: "static" | "arg_matched" | "passthrough";
  default: unknown;
  matches: { when: Record<string, unknown>; return: unknown }[];
}

export interface ToolDecl {
  name: string;
  title: string;
  description?: string | null;
  signature: { name: string; type: FieldType }[];
  returns?: string | null;
  mock: ToolMock;
}

export interface Schemas {
  id: string;
  title: string;
  messages_key: string;
  state_fields: StateField[];
  context_fields: ContextField[];
  tools: ToolDecl[];
  external_mocks: { id: string; patch: string; mode: string; description?: string }[];
}

export interface Topology {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string; conditional: boolean; label?: unknown }[];
}

export interface GwEvent {
  type: string;
  seq: number;
  ts: number;
  thread_id: string;
  run_id: string;
  author?: string | null;
  role?: string;
  delta?: string;
  content?: string;
  detail?: string;
  state_delta?: Record<string, unknown>;
  state_snapshot?: Record<string, unknown>;
  message?: { role: string; content: string; tool_calls?: unknown[] };
  tool?: {
    name?: string;
    args?: Record<string, unknown>;
    call_id?: string;
    result?: unknown;
    mocked?: boolean;
  };
}

export interface ChatMessage {
  id: string;
  role: "human" | "ai";
  content: string;
  streaming?: boolean;
  tools?: { name: string; args?: Record<string, unknown>; result?: unknown; mocked?: boolean }[];
}
