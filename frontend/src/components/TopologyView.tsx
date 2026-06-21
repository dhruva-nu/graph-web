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
  Position,
  type Edge,
  type Node,
} from "@xyflow/react";
import Dagre from "@dagrejs/dagre";
import { useStore } from "../store";

const TERMINALS = new Set(["__start__", "__end__"]);

type Dir = "TB" | "LR";

const NODE_W = 168;
const NODE_H = 40;

function layout(nodes: Node[], edges: Edge[], dir: Dir): Node[] {
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
      // dagre returns center coords; React Flow expects top-left.
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      sourcePosition: dir === "TB" ? Position.Bottom : Position.Right,
      targetPosition: dir === "TB" ? Position.Top : Position.Left,
    };
  });
}

function Flow() {
  const topology = useStore((s) => s.topology);
  const activeNode = useStore((s) => s.activeNode);
  const [dir, setDir] = useStore((s) => [s.topologyDir, s.setTopologyDir]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const relayout = useCallback(() => {
    if (!topology) return;
    const baseNodes: Node[] = topology.nodes.map((n) => ({
      id: n.id,
      position: { x: 0, y: 0 },
      width: NODE_W,
      data: { label: n.label.replace(/^__|__$/g, "") },
      className: "gwnode" + (TERMINALS.has(n.id) ? " terminal" : ""),
    }));
    const baseEdges: Edge[] = topology.edges.map((e, i) => ({
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
      ns.map((n) => ({
        ...n,
        className:
          "gwnode" +
          (TERMINALS.has(n.id) ? " terminal" : "") +
          (n.id === activeNode ? " active" : ""),
      })),
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
