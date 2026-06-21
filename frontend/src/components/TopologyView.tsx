import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useStore } from "../store";
import { buildGraph, layout, nodeClass } from "../lib/topology";

function Flow() {
  const topology = useStore((s) => s.topology);
  const activeNode = useStore((s) => s.activeNode);
  const [dir, setDir] = useStore((s) => [s.topologyDir, s.setTopologyDir]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const relayout = useCallback(() => {
    if (!topology) return;
    const { nodes: baseNodes, edges: baseEdges } = buildGraph(topology);
    setNodes(layout(baseNodes, baseEdges, dir));
    setEdges(baseEdges);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 300 }));
  }, [topology, dir, setNodes, setEdges, fitView]);

  // Re-layout when the graph shape or chosen direction changes.
  useEffect(() => {
    relayout();
  }, [relayout]);

  // Reflect run progress (active node + animated edges) without re-layout.
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => ({ ...n, className: nodeClass(n.id, activeNode) })),
    );
    setEdges((es) =>
      es.map((e) => ({ ...e, animated: e.source === activeNode })),
    );
  }, [activeNode, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      nodesDraggable
      nodesConnectable={false}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="var(--border)" gap={18} />
      <Controls showInteractive={false} />
      <Panel position="top-right" className="topo-toolbar">
        <button
          className={"topo-btn" + (dir === "TB" ? " on" : "")}
          onClick={() => setDir("TB")}
          title="Top-to-bottom layout"
        >
          Vertical
        </button>
        <button
          className={"topo-btn" + (dir === "LR" ? " on" : "")}
          onClick={() => setDir("LR")}
          title="Left-to-right layout"
        >
          Horizontal
        </button>
        <button className="topo-btn" onClick={relayout} title="Re-run auto-layout">
          Reset
        </button>
      </Panel>
    </ReactFlow>
  );
}

export function TopologyView() {
  const topology = useStore((s) => s.topology);
  if (!topology) return <div className="empty">No topology available.</div>;
  return (
    <div style={{ height: "100%" }}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
