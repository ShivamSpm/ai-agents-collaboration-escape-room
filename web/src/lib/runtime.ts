// Which CLI and model each live agent runs on, shown to viewers on the agent cards.
// The orchestrator doesn't report this, so keep it in sync with how server/run.sh is started
// (MEDIUM_CLI / *_MODEL). Override per run with ?medium=Claude%20Code:Sonnet style URL params.
import type { AgentId } from "../../../shared/types";

export type Runtime = { cli: string; model: string };

// Demo Mac: Medium on Claude Code with MEDIUM_MODEL=haiku; the other two on Codex's default model
// (GPT-6.1 Sol, seen in the agents' worker logs).
const DEFAULTS: Record<AgentId, Runtime> = {
  medium: { cli: "Claude Code", model: "Haiku" },
  electrician: { cli: "Codex", model: "GPT-6.1 Sol" },
  locksmith: { cli: "Codex", model: "GPT-6.1 Sol" },
};

export function runtimeFor(agent: AgentId): Runtime {
  const override = new URLSearchParams(location.search).get(agent);
  if (override) {
    const [cli, model = ""] = override.split(":");
    return { cli, model };
  }
  return DEFAULTS[agent];
}
