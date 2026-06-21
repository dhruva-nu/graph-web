import { Position, type Edge, type Node } from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import type { Topology } from "./types";

export const TERMINALS = new Set(["__start__", "__end__"]);

export type Dir = "TB" | "LR";

export const NODE_W = 168;
export const NODE_H = 40;

/** Run dagre auto-layout, converting its centre coords to React Flow top-left. */
export function layout(nodes: Node[], edges: Edge[], dir: Dir): Node[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: dir,
    nodesep: dir === "TB" ? 48 : 36,
    ranksep: dir === "TB" ? 64 : 96,
    marginx: 24,
    marginy: 24,
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  Dagre.layout(g);
  return nodes.map((n) => {
    const { x, y } = g.node(n.id);
    return {
      ...n,
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      sourcePosition: dir === "TB" ? Position.Bottom : Position.Right,
      targetPosition: dir === "TB" ? Position.Top : Position.Left,
    };
  });
}

/** Build the un-positioned React Flow nodes/edges from a topology declaration. */
export function buildGraph(topology: Topology): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = topology.nodes.map((n) => ({
    id: n.id,
    position: { x: 0, y: 0 },
    width: NODE_W,
    data: { label: n.label.replace(/^__|__$/g, "") },
    className: "gwnode" + (TERMINALS.has(n.id) ? " terminal" : ""),
  }));
  const edges: Edge[] = topology.edges.map((e, i) => ({
    id: "e" + i,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    label: typeof e.label === "string" ? e.label : undefined,
    style: {
      stroke: e.conditional ? "var(--c-tool)" : "var(--border-strong)",
      strokeDasharray: e.conditional ? "4 3" : undefined,
    },
  }));
  return { nodes, edges };
}

/** Class name for a node, reflecting terminal status and run-time active state. */
export function nodeClass(id: string, activeNode: string | null): string {
  return (
    "gwnode" +
    (TERMINALS.has(id) ? " terminal" : "") +
    (id === activeNode ? " active" : "")
  );
}
