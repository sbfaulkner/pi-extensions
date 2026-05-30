import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import agencyExtension from "./index.ts";

type Handler = (...args: any[]) => unknown;

async function createFakePiBin(startupMessage?: unknown) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-extensions-agency-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir, { recursive: true });

  const piPath = path.join(binDir, "pi");
  await writeFile(
    piPath,
    `#!/usr/bin/env node
const startupMessage = ${JSON.stringify(startupMessage)};
if (startupMessage) {
  setTimeout(() => process.stdout.write(JSON.stringify(startupMessage) + "\\n"), 0);
}
process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf("\\n");
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    index = buffer.indexOf("\\n");
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      if (message.type === "prompt") {
        process.stdout.write(JSON.stringify({ type: "response", id: message.id, success: true }) + "\\n");
      }
    } catch {}
  }
});
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1000);
`,
  );
  await chmod(piPath, 0o755);

  return { binDir };
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 1000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("timed out waiting for condition");
}

function createHarness() {
  const handlers = new Map<string, Handler[]>();
  const commands = new Map<string, any>();
  const notifications: Array<{ message: string; level: string }> = [];
  const appendedEntries: Array<{ type: string; data: unknown }> = [];
  let widgetName: string | undefined;

  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    registerCommand(name: string, options: any) {
      commands.set(name, options);
    },
    async appendEntry(type: string, data: unknown) {
      appendedEntries.push({ type, data });
    },
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
      setWidget(name: string | undefined) {
        widgetName = name;
      },
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
    appendedEntries,
    get widgetName() {
      return widgetName;
    },
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

test("agency add, list, and remove manage a named member", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin();
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    await command.handler("add developer Alice", harness.ctx);

    assert.deepEqual(harness.notifications.at(-1), { message: "Added developer Alice", level: "info" });
    assert.equal(harness.widgetName, "agency");
    assert.equal(harness.appendedEntries.length, 1);
    assert.deepEqual(harness.appendedEntries[0].data, {
      members: [
        {
          id: "alice",
          role: "developer",
          displayName: "Alice",
          provider: "test-provider",
          modelId: "test-model",
          thinking: "medium",
        },
      ],
    });

    await command.handler("list", harness.ctx);
    assert.match(harness.notifications.at(-1)?.message ?? "", /Alice \(developer\): initializing/);

    await command.handler("remove Alice", harness.ctx);

    assert.deepEqual(harness.notifications.at(-1), { message: "Removed member alice", level: "info" });
    assert.equal(harness.appendedEntries.length, 2);
    assert.deepEqual(harness.appendedEntries.at(-1)?.data, { members: [] });

    await command.handler("list", harness.ctx);
    assert.deepEqual(harness.notifications.at(-1), { message: "No members configured", level: "info" });
  } finally {
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("agency clear without force preserves busy members when confirmation is unavailable", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin({ type: "message_start" });
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();
  const ctxWithoutConfirm = {
    ...harness.ctx,
    ui: {
      ...harness.ctx.ui,
      confirm: undefined,
    },
  };

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    await command.handler("add developer Busy", harness.ctx);
    await waitFor(async () => {
      await command.handler("list", harness.ctx);
      return /Busy \(developer\): busy/.test(harness.notifications.at(-1)?.message ?? "");
    });
    await command.handler("clear", ctxWithoutConfirm);

    const notification = harness.notifications.at(-1);
    assert.equal(notification?.level, "warning");
    assert.match(notification?.message ?? "", /busy members were not cleared/);

    await command.handler("list", harness.ctx);
    assert.match(harness.notifications.at(-1)?.message ?? "", /Busy \(developer\): busy/);

    await command.handler("clear confirm", ctxWithoutConfirm);
    assert.deepEqual(harness.notifications.at(-1), { message: "Removed all members", level: "info" });
  } finally {
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});
