/**
 * Nodoz Extension
 *
 * Keeps macOS awake while pi is actively working by running a scoped
 * `caffeinate` child process during agent turns.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn as nodeSpawn } from "node:child_process";

type Platform = string;
type Signal = string;

export interface InhibitorCommand {
  command: string;
  args: string[];
}

type ChildErrorListener = (error: Error) => void;
type ChildExitListener = (code: number | null, signal: Signal | null) => void;

interface InhibitorProcess {
  pid?: number;
  killed?: boolean;
  kill: (signal?: Signal | number) => boolean;
  on(event: "error", listener: ChildErrorListener): unknown;
  on(event: "exit", listener: ChildExitListener): unknown;
  off?(event: "error", listener: ChildErrorListener): unknown;
  off?(event: "exit", listener: ChildExitListener): unknown;
  removeListener?(event: "error", listener: ChildErrorListener): unknown;
  removeListener?(event: "exit", listener: ChildExitListener): unknown;
}

interface ProcessLike {
  platform: Platform;
  stdout: { isTTY?: boolean };
  on: (event: "exit", listener: () => void) => unknown;
  off?: (event: "exit", listener: () => void) => unknown;
  removeListener?: (event: "exit", listener: () => void) => unknown;
}

interface SpawnOptions {
  stdio: "ignore";
  detached: false;
}

interface NodozDependencies {
  process?: ProcessLike;
  spawn?: (command: string, args: string[], options: SpawnOptions) => InhibitorProcess;
  logger?: { warn: (message?: unknown, ...optionalParams: unknown[]) => void };
  getInhibitorCommand?: (platform: Platform) => InhibitorCommand | undefined;
}

interface NodozUI {
  setStatus: (id: string, text: string | undefined) => void;
  theme: { fg: (style: string, text: string) => string };
}

interface NodozContext {
  ui?: NodozUI;
}

export interface NodozState {
  activeTurns: number;
  isInhibiting: boolean;
}

const STATUS_PREFIX = "[nodoz]";

export function getInhibitorCommand(platform: Platform): InhibitorCommand | undefined {
  if (platform === "darwin") {
    return {
      command: "caffeinate",
      args: ["-d", "-i", "-s"],
    };
  }

  // Future Linux support can use:
  // systemd-inhibit --what=idle:sleep --mode=block sleep infinity
  return undefined;
}

function detachChildListener(child: InhibitorProcess, event: "error", listener: ChildErrorListener): void;
function detachChildListener(child: InhibitorProcess, event: "exit", listener: ChildExitListener): void;
function detachChildListener(
  child: InhibitorProcess,
  event: "error" | "exit",
  listener: ChildErrorListener | ChildExitListener,
): void {
  if (event === "error") {
    const errorListener = listener as ChildErrorListener;
    if (child.off) {
      child.off("error", errorListener);
    } else if (child.removeListener) {
      child.removeListener("error", errorListener);
    }
    return;
  }

  const exitListener = listener as ChildExitListener;
  if (child.off) {
    child.off("exit", exitListener);
  } else if (child.removeListener) {
    child.removeListener("exit", exitListener);
  }
}

function detachProcessExitListener(processLike: ProcessLike, listener: () => void): void {
  if (processLike.off) {
    processLike.off("exit", listener);
  } else if (processLike.removeListener) {
    processLike.removeListener("exit", listener);
  }
}

function formatExit(code: number | null, signal: Signal | null): string {
  if (signal) return `signal ${signal}`;
  if (code !== null) return `code ${code}`;
  return "unknown status";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createNodozExtension(pi: ExtensionAPI, deps: NodozDependencies = {}): NodozState | undefined {
  const processLike = deps.process ?? process;
  const spawn = deps.spawn ?? ((command, args, options) => nodeSpawn(command, args, options) as InhibitorProcess);
  const logger = deps.logger ?? console;
  const commandForPlatform = deps.getInhibitorCommand ?? getInhibitorCommand;

  // Only the interactive parent pi session should hold a sleep inhibitor.
  // Non-TTY sessions/subagents intentionally register nothing.
  if (!processLike.stdout?.isTTY) return undefined;

  const state: NodozState = {
    activeTurns: 0,
    isInhibiting: false,
  };

  let child: InhibitorProcess | undefined;
  let childErrorHandler: ((error: Error) => void) | undefined;
  let childExitHandler: ((code: number | null, signal: Signal | null) => void) | undefined;
  let currentUI: NodozUI | undefined;

  function rememberUI(ctx?: NodozContext): void {
    if (ctx?.ui) currentUI = ctx.ui;
  }

  function updateStatus(): void {
    if (!currentUI) return;
    currentUI.setStatus("nodoz", state.isInhibiting ? currentUI.theme.fg("dim", "👀 nodoz ") : undefined);
  }

  function clearChild(): void {
    if (child && childErrorHandler) {
      detachChildListener(child, "error", childErrorHandler);
    }
    if (child && childExitHandler) {
      detachChildListener(child, "exit", childExitHandler);
    }
    child = undefined;
    childErrorHandler = undefined;
    childExitHandler = undefined;
    state.isInhibiting = false;
    updateStatus();
  }

  function resetAfterFailure(): void {
    clearChild();
    state.activeTurns = 0;
  }

  function startInhibitor(): boolean {
    if (child) {
      updateStatus();
      return true;
    }

    const inhibitor = commandForPlatform(processLike.platform);
    if (!inhibitor) return false;

    let spawned: InhibitorProcess;
    try {
      spawned = spawn(inhibitor.command, inhibitor.args, {
        stdio: "ignore",
        detached: false,
      });
    } catch (error) {
      state.activeTurns = 0;
      logger.warn(`${STATUS_PREFIX} failed to start sleep inhibitor: ${errorMessage(error)}`);
      return false;
    }

    child = spawned;
    state.isInhibiting = true;
    updateStatus();

    childErrorHandler = (error: Error) => {
      if (child !== spawned) return;
      logger.warn(`${STATUS_PREFIX} sleep inhibitor error: ${error?.message ?? String(error)}`);
      resetAfterFailure();
    };

    childExitHandler = (code: number | null, signal: Signal | null) => {
      if (child !== spawned) return;
      const wasActive = state.activeTurns > 0;
      resetAfterFailure();
      if (wasActive) {
        logger.warn(`${STATUS_PREFIX} sleep inhibitor exited unexpectedly (${formatExit(code, signal)})`);
      }
    };

    spawned.on("error", childErrorHandler);
    spawned.on("exit", childExitHandler);
    return true;
  }

  function stopInhibitor(): void {
    const proc = child;
    if (!proc) return;

    clearChild();
    if (!proc.killed) {
      try {
        proc.kill();
      } catch (error) {
        logger.warn(`${STATUS_PREFIX} failed to stop sleep inhibitor: ${errorMessage(error)}`);
      }
    }
  }

  function cleanupForProcessExit(): void {
    const proc = child;
    if (!proc) return;
    clearChild();
    if (!proc.killed) {
      try {
        proc.kill();
      } catch {
        // Node's exit event is synchronous; do not do anything noisy here.
      }
    }
    state.activeTurns = 0;
  }

  const processExitHandler = () => cleanupForProcessExit();
  processLike.on("exit", processExitHandler);

  pi.on("agent_start", (_event, ctx) => {
    rememberUI(ctx as NodozContext | undefined);
    state.activeTurns += 1;
    if (!startInhibitor()) {
      state.activeTurns = 0;
      updateStatus();
    }
  });

  pi.on("agent_end", (_event, ctx) => {
    rememberUI(ctx as NodozContext | undefined);
    if (state.activeTurns > 0) state.activeTurns -= 1;
    if (state.activeTurns === 0) stopInhibitor();
  });

  pi.on("session_shutdown", (_event, ctx) => {
    rememberUI(ctx as NodozContext | undefined);
    state.activeTurns = 0;
    stopInhibitor();
    updateStatus();
    currentUI = undefined;
    detachProcessExitListener(processLike, processExitHandler);
  });

  return state;
}

export default function (pi: ExtensionAPI) {
  createNodozExtension(pi);
}
