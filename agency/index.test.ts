import assert from "node:assert/strict";
import test from "node:test";
import agencyExtension from "./index.ts";

type Handler = (...args: any[]) => unknown;

function createHarness() {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, any>();
  const notifications: Array<{ message: string; level: string }> = [];

  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    registerCommand(name: string, options: any) {
      commands.set(name, options);
    },
    async appendEntry() {},
  };

  agencyExtension(pi as any);

  const ctx: any = {
    hasUI: true,
    model: { provider: "test-provider", id: "test-model", thinking: "medium" },
    sessionManager: {
      getEntries: () => [],
    },
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      setWidget() {},
      setStatus() {},
      theme: {
        fg(_style: string, text: string) {
          return text;
        },
      },
    },
  };

  return {
    commands,
    notifications,
    ctx,
    async emit(event: string) {
      for (const handler of handlers.get(event) ?? []) {
        await handler({}, ctx);
      }
    },
  };
}

test("agency help lists implemented commands and omits removed log/stop commands", async () => {
  const harness = createHarness();
  await harness.emit("session_start");

  const command = harness.commands.get("agency");
  assert.ok(command, "agency command should be registered");

  await command.handler("help", harness.ctx);

  const help = harness.notifications.at(-1)?.message ?? "";
  assert.match(help, /\/agency clear \[confirm\|--force\]/);
  assert.match(help, /\/agency events <id\|all> \[N\]/);
  assert.doesNotMatch(help, /\/agency log/);
  assert.doesNotMatch(help, /\/agency logs/);
  assert.doesNotMatch(help, /\/agency stop/);
});
