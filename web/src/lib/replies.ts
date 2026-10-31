// Agents answer a whisper in the DM thread they act in, so plain-language text sent to "Manor" is really
// an answer to the Operator. The UI shows, voices and animates it that way, and hides the Manor's
// "only understands JSON" bounce that follows.
import { agentIdFromRelayName, CHANNEL, MANOR, OPERATOR } from "../../../shared/map";
import type { LogEntry } from "../../../shared/types";

type Message = Extract<LogEntry, { kind: "message" }>;

export const isJsonAction = (text: string) => /^\s*\{[\s\S]*"action"/.test(text);

/** Who a message is effectively addressed to. */
export function effectiveTo(m: Message): string {
  return agentIdFromRelayName(m.from) && m.to === MANOR && !isJsonAction(m.text) ? OPERATOR : m.to;
}

/** The Manor's automatic reply to a non-JSON message; noise once the answer is routed to the Operator. */
export const isJsonBounce = (m: Message) => m.from === MANOR && /only understands one JSON action/i.test(m.text);

/**
 * True when an agent is talking to the human: a DM to Operator, prose sent to Manor (agents reply in their
 * action thread), or a #manor post that names the Operator ("@Operator, still waiting for the code").
 */
export function addressesOperator(m: Message): boolean {
  if (!agentIdFromRelayName(m.from)) return false;
  if (effectiveTo(m) === OPERATOR) return true;
  return m.to === CHANNEL && /\boperator\b/i.test(m.text);
}

/** A request the human should answer, not just a status line that mentions them. */
export const asksOperator = (m: Message) =>
  addressesOperator(m) && /\?|\b(need|code|help|waiting|tell us|what is|what are|please)\b/i.test(m.text);
