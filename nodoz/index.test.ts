import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createNodozExtension, getInhibitorCommand } from "./index.ts";

type HarnessEvent = "agent_start" | "agent_end" | "session_shutdown";
type HarnessHandler = (event: unknown, ctx?: unknown) => void;
type ProcessEvent = "exit";

type SpawnOptions = {
  stdio: "ignore";
  detached: false;
};

type SpawnCall = {
  command: string;
  args: string[];
  options: SpawnOptions;
  child?: FakeChild;
};

type SpawnFake = ((command: string, args: string[], options: SpawnOptions) => FakeChild) & {
  calls: SpawnCall[];
};

type ProcessOptions = {
  isTTY?: boolean;
  platform?: string;
};

class FakeChild extends EventEmitter {
  killed = false;
  killCalls = 0;
  lastSignal?: string | number;

  kill(signal?: string | number): boolean {
    this.killCalls += 1;
    this.lastSignal = signal;
    this.killed = true;
    return true;
  }
}

function createPi() {
  const handlers = new Map<HarnessEvent, HarnessHandler[]>();
  return {
    handlers,
    pi: {
      on(event: HarnessEvent, handler: HarnessHandler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
    } as unknown as ExtensionAPI,
    emit(event: HarnessEvent, ctx: unknown = {}) {
      for (const handler of handlers.get(event) ?? []) {
        handler({}, ctx);
      }
    },
  };
}

function createProcess(options: ProcessOptions = {}) {
  const isTTY = Object.hasOwn(options, "isTTY") ? options.isTTY : true;
  const platform = options.platform ?? "darwin";
  const listeners = new Map<ProcessEvent, Array<() => void>>();
  return {
    platform,
    stdout: isTTY === undefined ? {} : { isTTY },
    listeners,
    on(event: ProcessEvent, listener: () => void) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
    },
    off(event: ProcessEvent, listener: () => void) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((candidate) => candidate !== listener),
      );
    },
    emit(event: ProcessEvent) {
      for (const listener of [...(listeners.get(event) ?? [])]) {
        listener();
      }
    },
  };
}

function createSpawn({ throwFirst = false }: { throwFirst?: boolean } = {}): SpawnFake {
  const calls: SpawnCall[] = [];
  let throwNext = throwFirst;
  const spawn = ((command: string, args: string[], options: SpawnOptions) => {
    const call: SpawnCall = { command, args, options };
    calls.push(call);
    if (throwNext) {
      throwNext = false;
      throw new Error("spawn failed");
    }
    const child = new FakeChild();
    call.child = child;
    return child;
  }) as SpawnFake;
  spawn.calls = calls;
  return spawn;
}

function createLogger() {
  const warnings: string[] = [];
  return {
    warnings,
    logger: {
      warn(message?: unknown) {
        warnings.push(String(message));
      },
    },
  };
}

function createUI() {
  const statuses = new Map<string, string>();
  const calls: Array<{ id: string; text: string | undefined }> = [];
  return {
    statuses,
    calls,
    ui: {
      theme: {
        fg(style: string, text: string) {
          return `<${style}>${text}</${style}>`;
        },
      },
      setStatus(id: string, text: string | undefined) {
        calls.push({ id, text });
        if (text === undefined) {
          statuses.delete(id);
        } else {
          statuses.set(id, text);
        }
      },
    },
  };
}

test("getInhibitorCommand returns macOS caffeinate command and leaves other platforms unsupported", () => {
  assert.deepEqual(getInhibitorCommand("darwin"), {
    command: "caffeinate",
    args: ["-d", "-i", "-s"],
  });
  assert.equal(getInhibitorCommand("linux"), undefined);
});

test("TTY sessions register lifecycle handlers and process exit cleanup", () => {
  const harness = createPi();
  const processLike = createProcess({ isTTY: true });
  const spawn = createSpawn();
  const { logger } = createLogger();

  const state = createNodozExtension(harness.pi, { process: processLike, spawn, logger });

  assert.deepEqual(state, { activeTurns: 0, isInhibiting: false });
  assert.equal(harness.handlers.get("agent_start")?.length, 1);
  assert.equal(harness.handlers.get("agent_end")?.length, 1);
  assert.equal(harness.handlers.get("session_shutdown")?.length, 1);
  assert.equal(processLike.listeners.get("exit")?.length, 1);
  assert.equal(spawn.calls.length, 0);
});

test("non-TTY and undefined TTY sessions register nothing and spawn nothing", () => {
  for (const isTTY of [false, undefined]) {
    const harness = createPi();
    const processLike = createProcess({ isTTY });
    const spawn = createSpawn();
    const { logger } = createLogger();

    const state = createNodozExtension(harness.pi, { process: processLike, spawn, logger });

    assert.equal(state, undefined);
    assert.equal(harness.handlers.size, 0);
    assert.equal(processLike.listeners.size, 0);
    assert.equal(spawn.calls.length, 0);
  }
});

test("agent_start spawns caffeinate with expected arguments and options", () => {
  const harness = createPi();
  const processLike = createProcess();
  const spawn = createSpawn();
  const { logger } = createLogger();
  const state = createNodozExtension(harness.pi, { process: processLike, spawn, logger });

  harness.emit("agent_start");

  assert.equal(state.activeTurns, 1);
  assert.equal(state.isInhibiting, true);
  assert.equal(spawn.calls.length, 1);
  assert.deepEqual(spawn.calls[0], {
    command: "caffeinate",
    args: ["-d", "-i", "-s"],
    options: { stdio: "ignore", detached: false },
    child: spawn.calls[0].child,
  });
});

test("status bar shows dim nodoz item while inhibiting and clears on stop", () => {
  const harness = createPi();
  const spawn = createSpawn();
  const { logger } = createLogger();
  const { ui, statuses, calls } = createUI();
  createNodozExtension(harness.pi, { process: createProcess(), spawn, logger });

  harness.emit("agent_start", { ui });
  assert.equal(statuses.get("nodoz"), "<dim>👀 nodoz </dim>");
  assert.deepEqual(calls.at(-1), { id: "nodoz", text: "<dim>👀 nodoz </dim>" });

  harness.emit("agent_end", { ui });
  assert.equal(statuses.has("nodoz"), false);
  assert.deepEqual(calls.at(-1), { id: "nodoz", text: undefined });
});

test("repeated starts retain one process and final agent_end releases it", () => {
  const harness = createPi();
  const spawn = createSpawn();
  const { logger } = createLogger();
  const state = createNodozExtension(harness.pi, {
    process: createProcess(),
    spawn,
    logger,
  });

  harness.emit("agent_start");
  harness.emit("agent_start");
  const child = spawn.calls[0].child;

  assert.equal(spawn.calls.length, 1);
  assert.equal(state.activeTurns, 2);

  harness.emit("agent_end");
  assert.equal(child.killCalls, 0);
  assert.equal(state.activeTurns, 1);
  assert.equal(state.isInhibiting, true);

  harness.emit("agent_end");
  assert.equal(child.killCalls, 1);
  assert.equal(state.activeTurns, 0);
  assert.equal(state.isInhibiting, false);
});

test("session_shutdown kills immediately and resets refcount", () => {
  const harness = createPi();
  const spawn = createSpawn();
  const { logger } = createLogger();
  const processLike = createProcess();
  const state = createNodozExtension(harness.pi, { process: processLike, spawn, logger });

  harness.emit("agent_start");
  harness.emit("agent_start");
  const child = spawn.calls[0].child;

  harness.emit("session_shutdown");
  assert.equal(child.killCalls, 1);
  assert.equal(state.activeTurns, 0);
  assert.equal(state.isInhibiting, false);
  assert.equal(processLike.listeners.get("exit")?.length, 0);

  harness.emit("agent_end");
  assert.equal(child.killCalls, 1);
});

test("process exit cleanup kills only the spawned child", () => {
  const harness = createPi();
  const processLike = createProcess();
  const spawn = createSpawn();
  const { logger } = createLogger();
  const state = createNodozExtension(harness.pi, { process: processLike, spawn, logger });

  harness.emit("agent_start");
  const child = spawn.calls[0].child;

  processLike.emit("exit");

  assert.equal(child.killCalls, 1);
  assert.equal(state.activeTurns, 0);
  assert.equal(state.isInhibiting, false);
});

test("spawn throws are logged, do not escape, and next start can retry", () => {
  const harness = createPi();
  const spawn = createSpawn({ throwFirst: true });
  const { logger, warnings } = createLogger();
  const state = createNodozExtension(harness.pi, {
    process: createProcess(),
    spawn,
    logger,
  });

  assert.doesNotThrow(() => harness.emit("agent_start"));
  assert.equal(spawn.calls.length, 1);
  assert.equal(state.activeTurns, 0);
  assert.equal(state.isInhibiting, false);
  assert.match(warnings[0], /failed to start sleep inhibitor: spawn failed/);

  harness.emit("agent_start");
  assert.equal(spawn.calls.length, 2);
  assert.equal(state.activeTurns, 1);
  assert.equal(state.isInhibiting, true);
});

test("child error clears state, logs warning, and allows restart", () => {
  const harness = createPi();
  const spawn = createSpawn();
  const { logger, warnings } = createLogger();
  const state = createNodozExtension(harness.pi, {
    process: createProcess(),
    spawn,
    logger,
  });

  harness.emit("agent_start");
  spawn.calls[0].child.emit("error", new Error("ENOENT"));

  assert.equal(state.activeTurns, 0);
  assert.equal(state.isInhibiting, false);
  assert.match(warnings[0], /sleep inhibitor error: ENOENT/);

  harness.emit("agent_start");
  assert.equal(spawn.calls.length, 2);
  assert.equal(state.activeTurns, 1);
  assert.equal(state.isInhibiting, true);
});

test("unexpected child exit clears state, logs warning, and allows restart", () => {
  const harness = createPi();
  const spawn = createSpawn();
  const { logger, warnings } = createLogger();
  const state = createNodozExtension(harness.pi, {
    process: createProcess(),
    spawn,
    logger,
  });

  harness.emit("agent_start");
  spawn.calls[0].child.emit("exit", 1, null);

  assert.equal(state.activeTurns, 0);
  assert.equal(state.isInhibiting, false);
  assert.match(warnings[0], /sleep inhibitor exited unexpectedly \(code 1\)/);

  harness.emit("agent_end");
  assert.equal(spawn.calls[0].child.killCalls, 0);

  harness.emit("agent_start");
  assert.equal(spawn.calls.length, 2);
  assert.equal(state.activeTurns, 1);
  assert.equal(state.isInhibiting, true);
});

test("can restart after a normal stop", () => {
  const harness = createPi();
  const spawn = createSpawn();
  const { logger } = createLogger();
  createNodozExtension(harness.pi, { process: createProcess(), spawn, logger });

  harness.emit("agent_start");
  const firstChild = spawn.calls[0].child;
  harness.emit("agent_end");

  harness.emit("agent_start");
  const secondChild = spawn.calls[1].child;

  assert.equal(firstChild.killCalls, 1);
  assert.equal(spawn.calls.length, 2);
  assert.notEqual(secondChild, firstChild);
  assert.equal(secondChild.killCalls, 0);
});
