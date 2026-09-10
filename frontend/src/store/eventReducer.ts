import type { ChatMessage, GwEvent } from "../lib/types";
import type { Store } from "./types";

/** Apply `fn` to the streaming AI message identified by `aiId`, leave others untouched. */
function mapAi(
  messages: ChatMessage[],
  aiId: string,
  fn: (m: ChatMessage) => ChatMessage
): ChatMessage[] {
  return messages.map((m) => (m.id === aiId ? fn(m) : m));
}

/**
 * Fold one streamed event into a partial state update for the run identified by
 * `aiId` (the placeholder AI message) and `text` (the prompt that started it).
 */
export function reduceEvent(
  s: Store,
  ev: GwEvent,
  aiId: string,
  text: string
): Partial<Store> {
  const next: Partial<Store> = { events: [...s.events, ev] };

  if (ev.type === "run_start") {
    next.turnPrompts = { ...s.turnPrompts, [ev.run_id]: text };
  } else if (ev.type === "message_delta" && ev.delta) {
    next.messages = mapAi(s.messages, aiId, (m) => ({ ...m, content: m.content + ev.delta }));
    if (ev.author) next.activeNode = ev.author;
  } else if (ev.type === "node_end") {
    if (ev.author) next.activeNode = ev.author;
    if (ev.state_delta) {
      next.stateValues = { ...s.stateValues, ...ev.state_delta };
      next.flashedKeys = new Set(Object.keys(ev.state_delta));
    }
  } else if (ev.type === "state_snapshot" && ev.state_snapshot) {
    next.stateValues = ev.state_snapshot;
  } else if (ev.type === "tool_call" && ev.tool) {
    next.messages = mapAi(s.messages, aiId, (m) => ({
      ...m,
      tools: [...(m.tools || []), { name: ev.tool!.name!, args: ev.tool!.args }],
    }));
    if (ev.author) next.activeNode = ev.author;
  } else if (ev.type === "tool_result" && ev.tool) {
    next.messages = mapAi(s.messages, aiId, (m) => ({
      ...m,
      tools: (m.tools || []).map((t) =>
        t.name === ev.tool!.name && t.result === undefined
          ? { ...t, result: ev.tool!.result, mocked: ev.tool!.mocked }
          : t
      ),
    }));
  } else if (ev.type === "message" && ev.message && ev.message.content) {
    next.messages = mapAi(s.messages, aiId, (m) =>
      !m.content ? { ...m, content: ev.message!.content } : m
    );
  }

  return next;
}
