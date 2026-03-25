/**
 * System Theme Extension
 *
 * Syncs pi's theme with macOS system appearance (dark/light mode).
 * Polls the system appearance and switches pi's theme accordingly.
 *
 * Provides:
 *   - Automatic theme syncing on session start
 *   - Polling for system appearance changes
 *   - /system-theme command to configure dark/light theme names and poll interval
 *   - Persists config overrides to ~/.pi/agent/system-theme.json
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type Config = {
  darkTheme: string;
  lightTheme: string;
  pollMs: number;
};

type Appearance = "dark" | "light";

const DEFAULT_CONFIG: Config = {
  darkTheme: "dark",
  lightTheme: "light",
  pollMs: 2000,
};

const GLOBAL_CONFIG_PATH = path.join(
  os.homedir(),
  ".pi",
  "agent",
  "system-theme.json",
);
const DETECTION_TIMEOUT_MS = 1200;
const MIN_POLL_MS = 500;

// --- Config persistence ---

function getOverrides(config: Config): Partial<Config> {
  const overrides: Partial<Config> = {};
  if (config.darkTheme !== DEFAULT_CONFIG.darkTheme)
    overrides.darkTheme = config.darkTheme;
  if (config.lightTheme !== DEFAULT_CONFIG.lightTheme)
    overrides.lightTheme = config.lightTheme;
  if (config.pollMs !== DEFAULT_CONFIG.pollMs)
    overrides.pollMs = config.pollMs;
  return overrides;
}

async function loadConfig(): Promise<Config> {
  const config = { ...DEFAULT_CONFIG };
  try {
    const raw = await readFile(GLOBAL_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return config;

    if (typeof parsed.darkTheme === "string" && parsed.darkTheme.trim())
      config.darkTheme = parsed.darkTheme.trim();
    if (typeof parsed.lightTheme === "string" && parsed.lightTheme.trim())
      config.lightTheme = parsed.lightTheme.trim();
    if (
      typeof parsed.pollMs === "number" &&
      Number.isFinite(parsed.pollMs)
    )
      config.pollMs = Math.max(MIN_POLL_MS, Math.round(parsed.pollMs));
  } catch (e: any) {
    if (e?.code !== "ENOENT") {
      console.warn(
        `[system-theme] Failed to read ${GLOBAL_CONFIG_PATH}: ${e?.message}`,
      );
    }
  }
  return config;
}

async function saveConfig(config: Config): Promise<number> {
  const overrides = getOverrides(config);
  const count = Object.keys(overrides).length;
  if (count === 0) {
    await rm(GLOBAL_CONFIG_PATH, { force: true });
  } else {
    await mkdir(path.dirname(GLOBAL_CONFIG_PATH), { recursive: true });
    await writeFile(
      GLOBAL_CONFIG_PATH,
      `${JSON.stringify(overrides, null, 4)}\n`,
      "utf8",
    );
  }
  return count;
}

// --- Appearance detection ---

async function detectAppearance(): Promise<Appearance | null> {
  if (process.platform === "darwin") {
    return detectMacAppearance();
  }
  if (process.platform === "linux") {
    return detectLinuxAppearance();
  }
  return null;
}

async function detectMacAppearance(): Promise<Appearance | null> {
  try {
    const { stdout } = await execFileAsync(
      "/usr/bin/defaults",
      ["read", "-g", "AppleInterfaceStyle"],
      { timeout: DETECTION_TIMEOUT_MS },
    );
    return stdout.trim().toLowerCase() === "dark" ? "dark" : "light";
  } catch (e: any) {
    // "does not exist" means light mode (no AppleInterfaceStyle key set)
    const stderr =
      typeof e?.stderr === "string" ? e.stderr.toLowerCase() : "";
    if (stderr.includes("does not exist")) return "light";
    return null;
  }
}

async function detectLinuxAppearance(): Promise<Appearance | null> {
  try {
    const { stdout } = await execFileAsync(
      "gsettings",
      ["get", "org.gnome.desktop.interface", "color-scheme"],
      { timeout: DETECTION_TIMEOUT_MS },
    );
    const value = stdout.trim().toLowerCase().replace(/^['"]|['"]$/g, "");
    if (value === "prefer-dark") return "dark";
    if (value === "prefer-light") return "light";
  } catch {
    // fall through to gtk-theme
  }

  try {
    const { stdout } = await execFileAsync(
      "gsettings",
      ["get", "org.gnome.desktop.interface", "gtk-theme"],
      { timeout: DETECTION_TIMEOUT_MS },
    );
    const value = stdout.trim().toLowerCase().replace(/^['"]|['"]$/g, "");
    if (value.includes("dark")) return "dark";
    if (value.includes("light")) return "light";
  } catch {
    // detection failed
  }

  return null;
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
  let activeConfig: Config = { ...DEFAULT_CONFIG };
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let syncInProgress = false;

  function canSync(ctx: ExtensionContext): boolean {
    return ctx.hasUI && ctx.ui.getAllThemes().length > 0;
  }

  function shouldAutoSync(ctx: ExtensionContext): boolean {
    if (!canSync(ctx)) return false;
    // If user configured custom theme names, always sync
    if (
      activeConfig.darkTheme !== DEFAULT_CONFIG.darkTheme ||
      activeConfig.lightTheme !== DEFAULT_CONFIG.lightTheme
    )
      return true;
    // If current theme is one of the defaults, sync
    const current = ctx.ui.theme.name;
    return current === "dark" || current === "light";
  }

  async function syncTheme(ctx: ExtensionContext): Promise<void> {
    if (!shouldAutoSync(ctx) || syncInProgress) return;
    syncInProgress = true;
    try {
      const appearance = await detectAppearance();
      if (!appearance) return;

      const target =
        appearance === "dark"
          ? activeConfig.darkTheme
          : activeConfig.lightTheme;
      if (ctx.ui.theme.name === target) return;

      const result = ctx.ui.setTheme(target);
      if (!result.success) {
        console.warn(
          `[system-theme] Failed to set theme "${target}": ${result.error}`,
        );
      }
    } finally {
      syncInProgress = false;
    }
  }

  function startPolling(ctx: ExtensionContext): void {
    stopPolling();
    if (!shouldAutoSync(ctx)) return;
    intervalId = setInterval(() => {
      void syncTheme(ctx);
    }, activeConfig.pollMs);
  }

  function stopPolling(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // --- /system-theme command ---

  pi.registerCommand("system-theme", {
    description: "Configure system theme syncing",
    handler: async (_args, ctx) => {
      if (!canSync(ctx)) {
        ctx.ui.notify("Theme syncing requires interactive mode.", "info");
        return;
      }

      const draft: Config = { ...activeConfig };

      while (true) {
        const choices = [
          `Dark theme: ${draft.darkTheme}`,
          `Light theme: ${draft.lightTheme}`,
          `Poll interval: ${draft.pollMs}ms`,
          "Save and apply",
          "Cancel",
        ];

        const choice = await ctx.ui.select("system-theme", choices);

        if (choice === undefined || choice === "Cancel") return;

        if (choice === choices[0]) {
          const next = await ctx.ui.input("Dark theme", draft.darkTheme);
          if (next?.trim()) draft.darkTheme = next.trim();
        } else if (choice === choices[1]) {
          const next = await ctx.ui.input("Light theme", draft.lightTheme);
          if (next?.trim()) draft.lightTheme = next.trim();
        } else if (choice === choices[2]) {
          const next = await ctx.ui.input(
            `Poll interval ms (>= ${MIN_POLL_MS})`,
            String(draft.pollMs),
          );
          if (next?.trim()) {
            const parsed = parseInt(next.trim(), 10);
            if (Number.isFinite(parsed) && parsed >= MIN_POLL_MS) {
              draft.pollMs = parsed;
            } else {
              ctx.ui.notify(
                `Enter a number >= ${MIN_POLL_MS}.`,
                "warning",
              );
            }
          }
        } else if (choice === "Save and apply") {
          activeConfig = draft;
          try {
            const count = await saveConfig(activeConfig);
            ctx.ui.notify(
              count > 0
                ? `Saved ${count} override(s) to ${GLOBAL_CONFIG_PATH}`
                : "Using defaults (config file removed).",
              "info",
            );
          } catch (e: any) {
            ctx.ui.notify(`Failed to save: ${e?.message}`, "error");
            return;
          }
          await syncTheme(ctx);
          startPolling(ctx);
          return;
        }
      }
    },
  });

  // --- Lifecycle ---

  pi.on("session_start", async (_event, ctx) => {
    if (process.platform !== "darwin" && process.platform !== "linux") return;
    activeConfig = await loadConfig();
    if (!shouldAutoSync(ctx)) return;
    await syncTheme(ctx);
    startPolling(ctx);
  });

  pi.on("session_shutdown", () => {
    stopPolling();
  });
}
