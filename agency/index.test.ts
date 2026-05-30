import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import agencyExtension from "./index.ts";

type Handler = (...args: any[]) => unknown;

async function createFakePiBin(startupMessage?: unknown, signalFile?: string) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-extensions-agency-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir, { recursive: true });

  const piPath = path.join(binDir, "pi");
  await writeFile(
    piPath,
    `#!/usr/bin/env node
const startupMessage = ${JSON.stringify(startupMessage)};
const signalFile = ${JSON.stringify(signalFile)};
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
process.on("SIGTERM", () => {
  if (signalFile) {
    require("node:fs").writeFileSync(signalFile, "SIGTERM");
  }
  process.exit(0);
});
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

function createHarness(options: { entries?: any[] } = {}) {
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
      getEntries: () => options.entries ?? [],
    },
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      setWidget(name: string, factory?: unknown) {
        widgetName = factory === undefined ? undefined : name;
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

test("agency assign clears confirmation timeout after child response", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin();
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const confirmationTimers = new Set<ReturnType<typeof setTimeout>>();
  const clearedTimers = new Set<ReturnType<typeof setTimeout>>();

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    await command.handler("add developer Alice", harness.ctx);

    (globalThis as any).setTimeout = (handler: any, timeout?: any, ...args: any[]) => {
      const timer = originalSetTimeout(handler, timeout, ...args);
      if (timeout === 6000) confirmationTimers.add(timer);
      return timer;
    };
    (globalThis as any).clearTimeout = (timer: any) => {
      if (timer) clearedTimers.add(timer);
      return originalClearTimeout(timer);
    };

    await command.handler("assign alice Fix the bug", harness.ctx);

    assert.deepEqual(harness.notifications.at(-1), { message: "Assigned developer task to Alice", level: "info" });
    assert.equal(confirmationTimers.size, 1);
    assert.ok(
      clearedTimers.has(Array.from(confirmationTimers)[0]),
      "assign confirmation timeout should be cleared after response",
    );

    await command.handler("list", harness.ctx);
    assert.match(harness.notifications.at(-1)?.message ?? "", /Alice \(developer\): busy/);
  } finally {
    (globalThis as any).setTimeout = originalSetTimeout;
    (globalThis as any).clearTimeout = originalClearTimeout;
    for (const timer of confirmationTimers) {
      originalClearTimeout(timer);
    }
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("agency role verb shorthand creates a member and assigns the task", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin();
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const confirmationTimers = new Set<ReturnType<typeof setTimeout>>();

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    (globalThis as any).setTimeout = (handler: any, timeout?: any, ...args: any[]) => {
      const timer = originalSetTimeout(handler, timeout, ...args);
      if (timeout === 6000) confirmationTimers.add(timer);
      return timer;
    };

    await command.handler("develop Build the feature", harness.ctx);

    const savedMembers = (harness.appendedEntries.at(-1)?.data as any).members;
    assert.equal(savedMembers.length, 1);
    assert.equal(savedMembers[0].role, "developer");
    assert.deepEqual(harness.notifications.at(-1), {
      message: `Assigned developer task to ${savedMembers[0].displayName}`,
      level: "info",
    });

    await command.handler("list", harness.ctx);
    assert.match(
      harness.notifications.at(-1)?.message ?? "",
      new RegExp(`${savedMembers[0].displayName} \\(developer\\): busy`),
    );
  } finally {
    (globalThis as any).setTimeout = originalSetTimeout;
    for (const timer of confirmationTimers) {
      originalClearTimeout(timer);
    }
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("agency events shows member and all event buffers", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin({ type: "message_start", id: "evt-1" });
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    await command.handler("add developer Alice", harness.ctx);
    await waitFor(async () => {
      await command.handler("events alice 5", harness.ctx);
      const notification = harness.notifications.at(-1);
      return notification?.level === "info" && /Events for alice \(last 1\):/.test(notification.message);
    });

    assert.match(harness.notifications.at(-1)?.message ?? "", /message_start/);

    await command.handler("events all 5", harness.ctx);
    assert.match(harness.notifications.at(-1)?.message ?? "", /Member events \(per member, last 5\):/);
    assert.match(harness.notifications.at(-1)?.message ?? "", /alice> .*message_start/);

    await command.handler("events unknown", harness.ctx);
    assert.deepEqual(harness.notifications.at(-1), { message: "No events for member unknown", level: "info" });
  } finally {
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("session_start restores persisted agency members", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin();
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness({
    entries: [
      {
        type: "custom",
        customType: "agency",
        data: {
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
        },
      },
    ],
  });

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    assert.deepEqual(harness.notifications.at(-1), { message: "Resumed developer Alice", level: "info" });

    await command.handler("list", harness.ctx);
    assert.match(harness.notifications.at(-1)?.message ?? "", /Alice \(developer\): initializing/);
    assert.equal(harness.appendedEntries.length, 0);
  } finally {
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("session_shutdown kills spawned members and clears the widget", async () => {
  const originalPath = process.env.PATH;
  const signalRoot = await mkdtemp(path.join(tmpdir(), "pi-extensions-agency-signal-"));
  const signalFile = path.join(signalRoot, "signal");
  const fixture = await createFakePiBin({ type: "message_start" }, signalFile);
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();
  let didShutdown = false;

  try {
    await harness.emit("session_start");
    const command = harness.commands.get("agency");
    assert.ok(command, "agency command should be registered");

    await command.handler("add developer Alice", harness.ctx);
    assert.equal(harness.widgetName, "agency");
    await waitFor(async () => {
      await command.handler("list", harness.ctx);
      return /Alice \(developer\): busy/.test(harness.notifications.at(-1)?.message ?? "");
    });

    await harness.emit("session_shutdown");
    didShutdown = true;

    await waitFor(async () => {
      try {
        return (await readFile(signalFile, "utf8")) === "SIGTERM";
      } catch {
        return false;
      }
    });
    assert.equal(harness.widgetName, undefined);
  } finally {
    if (!didShutdown) await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("agency clear cancels when busy member confirmation is declined", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin({ type: "message_start" });
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();
  const ctxWithDecline = {
    ...harness.ctx,
    ui: {
      ...harness.ctx.ui,
      confirm: async () => false,
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

    await command.handler("clear", ctxWithDecline);
    assert.deepEqual(harness.notifications.at(-1), { message: "Clear cancelled", level: "info" });

    await command.handler("list", harness.ctx);
    assert.match(harness.notifications.at(-1)?.message ?? "", /Busy \(developer\): busy/);
  } finally {
    await harness.emit("session_shutdown");
    process.env.PATH = originalPath;
  }
});

test("agency clear removes busy members when confirmation is accepted", async () => {
  const originalPath = process.env.PATH;
  const fixture = await createFakePiBin({ type: "message_start" });
  process.env.PATH = `${fixture.binDir}${path.delimiter}${process.env.PATH ?? ""}`;

  const harness = createHarness();
  const ctxWithConfirm = {
    ...harness.ctx,
    ui: {
      ...harness.ctx.ui,
      confirm: async () => true,
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

    await command.handler("clear", ctxWithConfirm);
    assert.deepEqual(harness.notifications.at(-1), { message: "Removed all members", level: "info" });

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
