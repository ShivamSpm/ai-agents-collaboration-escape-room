import { expect, test } from "bun:test";
import { appendMessage, apply, operator } from "./engine";
import { createWorld } from "./map";
import { runScript, SCRIPT, type ScriptSink } from "./scripted";

test("the scripted run escapes with every action succeeding", async () => {
  let world = operator(createWorld("scripted"), "start").world;
  const failures: string[] = [];
  const sink: ScriptSink = {
    async act(agent, action) {
      const r = apply(world, agent, action);
      world = r.world;
      if (!r.ok) failures.push(`${agent} ${JSON.stringify(action)}: ${r.text}`);
      return r;
    },
    async message(from, to, text, isPrivate) {
      world = appendMessage(world, { from, to, text, private: isPrivate });
    },
    async operator(op) {
      const r = operator(world, op);
      world = r.world;
      return { announce: r.announce ?? null };
    },
  };
  await runScript(sink, { delayMs: 0 });
  expect(failures).toEqual([]);
  expect(world.status).toBe("escaped");
  expect(world.collapsed).toBe(true);
  expect(world.stats.actions).toBe(SCRIPT.filter((s) => s.kind === "act").length);
});
