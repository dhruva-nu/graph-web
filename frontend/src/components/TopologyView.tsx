import { useMemo } from "react";
import { ReactFlow, Background, type Edge, type Node } from "@xyflow/react";
import { useStore } from "../store";

const TERMINALS = new Set(["__start__", "__end__"]);

export function TopologyView() {
  const topology = useStore((s) => s.topology);
  const activeNode = useStore((s) => s.activeNode);

  const { nodes, edges } = useMemo(() => {
    if (!topology) return { nodes: [] as Node[], edges: [] as Edge[] };
    // Simple vertical layered layout.
    const order = topology.nodes.map((n) => n.id);
    const nodes: Node[] = topology.nodes.map((n, i) => ({
      id: n.id,
      position: { x: 60 + (i % 2) * 30, y: i * 86 },
      data: { label: n.label.replace(/^__|__$/g, "") },
      className:
        "gwnode" +
        (TERMINALS.has(n.id) ? " terminal" : "") +
        (n.id === activeNode ? " active" : ""),
      sourcePosition: "bottom" as any,
      targetPosition: "top" as any,
    }));
    const edges: Edge[] = topology.edges.map((e, i) => ({
      id: "e" + i,
      source: e.source,
      target: e.target,
      animated: e.source === activeNode,
      style: {
        stroke: e.conditional ? "var(--c-tool)" : "var(--border-strong)",
        strokeDasharray: e.conditional ? "4 3" : undefined,
      },
    }));
    return { nodes, edges };
  }, [topology, activeNode]);

  if (!topology) return <div className="empty">No topology available.</div>;

  return (
    <div style={{ height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--border)" gap={18} />
      </ReactFlow>
    </div>
  );
}
