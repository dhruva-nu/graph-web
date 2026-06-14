import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { ChatMessage } from "../lib/types";

function ToolChip({ t }: { t: NonNullable<ChatMessage["tools"]>[number] }) {
  return (
    <div className={"toolchip" + (t.mocked ? " mocked" : "")}>
      <span style={{ color: "var(--c-tool)" }}>⚙</span>
      <span>{t.name}</span>
      {t.args && <span className="dim2">({Object.values(t.args).join(", ")})</span>}
      {t.mocked && <span className="mocktag">MOCKED</span>}
      {t.result !== undefined && (
        <span className="dim" style={{ marginLeft: 4 }}>
          → {String(t.result).slice(0, 48)}
        </span>
      )}
    </div>
  );
}

function Msg({ m }: { m: ChatMessage }) {
  return (
    <div className={"msg " + m.role}>
      <div className="who">
        <span className={"badge " + m.role} />
        {m.role === "human" ? "you" : "assistant"}
      </div>
      {m.tools?.map((t, i) => <ToolChip key={i} t={t} />)}
      {(m.content || m.role === "ai") && (
        <div className="bubble">
          {m.content || (m.streaming ? <span className="dim2">▍</span> : "")}
        </div>
      )}
    </div>
  );
}

export function ChatPanel() {
  const messages = useStore((s) => s.messages);
  const send = useStore((s) => s.send);
  const status = useStore((s) => s.status);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    const t = text;
    setText("");
    void send(t);
  };

  return (
    <div className="chat">
      <div className="msgs">
        {messages.length === 0 && (
          <div className="empty">
            Set your mock context on the right, then send a message to the agent.
          </div>
        )}
        {messages.map((m) => (
          <Msg key={m.id} m={m} />
        ))}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <textarea
          className="gw"
          placeholder="Message the agent…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          className="gw primary"
          onClick={submit}
          disabled={status === "running" || !text.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
