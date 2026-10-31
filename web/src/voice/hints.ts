// Hint requests are agent messages asking the human for help (DM, prose to Manor, or "@Operator" on #manor);
// derived from the log, no extra state.
import { AGENTS, OPERATOR, agentIdFromRelayName } from "../../../shared/map";
import type { AgentId, World } from "../../../shared/types";
import { asksOperator } from "../lib/replies";

export const MAX_HINTS = 2;

export type HintRequest = { agent: AgentId; text: string; index: number };

export function hintState(world: World) {
  let used = 0;
  let pending: HintRequest | undefined;
  world.log.forEach((e, index) => {
    if (e.kind !== "message") return;
    const agent = agentIdFromRelayName(e.from);
    if (agent && asksOperator(e)) {
      used += 1;
      pending = { agent, text: e.text, index };
    } else if (pending && e.from === OPERATOR && e.to === AGENTS[pending.agent].relayName) {
      pending = undefined;
    }
  });
  return { used, left: Math.max(0, MAX_HINTS - used), pending };
}
