import { useEffect, useState } from "react";
import { useStore } from "./store";
import { CommandBar } from "./components/CommandBar";
import { ChatPanel } from "./components/ChatPanel";
import { TracePanel } from "./components/TracePanel";
import { StateInspector } from "./components/StateInspector";
import { TopologyView } from "./components/TopologyView";
import { MockEditor } from "./components/MockEditor";
import { EnvPanel } from "./components/EnvPanel";

type RightTab = "state" | "topology" | "mocks" | "env";

export function App() {
  const boot = useStore((s) => s.boot);
  const status = useStore((s) => s.status);
  const bootError = useStore((s) => s.bootError);
  const [tab, setTab] = useState<RightTab>("mocks");

  useEffect(() => {
    void boot();
  }, [boot]);

  return (
    <div className="app">
      <CommandBar />
      {bootError ? (
        <div className="empty" style={{ padding: 40 }}>
          <div style={{ color: "var(--c-error)", marginBottom: 8 }}>Failed to load project</div>
          <pre className="json" style={{ textAlign: "left", maxWidth: 700, margin: "0 auto" }}>
            {bootError}
          </pre>
          <div className="dim2" style={{ marginTop: 12 }}>
            Set <span className="mono">GRAPHWEB_MANIFEST</span> to a graph-web.json and restart the backend.
          </div>
        </div>
      ) : (
        <div className="workspace">
          <div className="panel">
            <div className="phead">
              <span>Chat</span>
              <span className="right dim2 mono">{status}</span>
            </div>
            <div className="pbody">
              <ChatPanel />
            </div>
          </div>

          <div className="panel">
            <div className="phead">
              <span>Events · Trace</span>
            </div>
            <div className="pbody">
              <TracePanel />
            </div>
          </div>

          <div className="panel">
            <div className="phead">
              {(["state", "topology", "mocks", "env"] as RightTab[]).map((t) => (
                <span
                  key={t}
                  className={"tab" + (tab === t ? " active" : "")}
                  onClick={() => setTab(t)}
                >
                  {t === "state" ? "State" : t === "topology" ? "Graph" : t === "mocks" ? "Mocks" : "Env"}
                </span>
              ))}
            </div>
            <div className="pbody">
              {tab === "state" && <StateInspector />}
              {tab === "topology" && <TopologyView />}
              {tab === "mocks" && <MockEditor />}
              {tab === "env" && <EnvPanel />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
