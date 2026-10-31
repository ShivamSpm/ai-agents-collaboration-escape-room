// Agents answer a whisper in the DM thread they act in, so plain-language text sent to "Manor" is really
// an answer to the Operator. The UI shows, voices and animates it that way, and hides the Manor's
// "only understands JSON" bounce that follows.
import { agentIdFromRelayName, MANOR, OPERATOR } from "../../../shared/map";
import type { LogEntry } from "../../../shared/types";

type Message = Extract<LogEntry, { kind: "message" }>;

export const isJsonAction = (text: string) => /^\s*\{[\s\S]*"action"/.test(text);

/** Who a message is effectively addressed to. */
export function effectiveTo(m: Message): string {
  return agentIdFromRelayName(m.from) && m.to === MANOR && !isJsonAction(m.text) ? OPERATOR : m.to;
}

/** The Manor's automatic reply to a non-JSON message; noise once the answer is routed to the Operator. */
export const isJsonBounce = (m: Message) => m.from === MANOR && /only understands one JSON action/i.test(m.text);
