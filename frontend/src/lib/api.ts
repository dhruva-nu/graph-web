import type { AssistantSummary, Schemas, Topology } from "./types";

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export const api = {
  manifest: () => j<any>("/api/manifest"),
  env: () => j<any>("/api/env"),
  assistants: () => j<AssistantSummary[]>("/api/assistants"),
  schemas: (id: string) => j<Schemas>(`/api/assistants/${id}/schemas`),
  topology: (id: string) => j<Topology>(`/api/assistants/${id}/graph`),
  createThread: (graph_id: string) =>
    j<{ id: string }>("/api/threads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ graph_id }),
    }),
  state: (tid: string) => j<{ values: Record<string, unknown>; next: string[] }>(`/api/threads/${tid}/state`),
};
