/**
 * Vendor Docs Extension
 *
 * Lightweight status bar extension that shows cache size and source count
 * for the vendor-docs skill. No custom tools — just passive visibility.
 *
 * Displays: 📚 3 sources · 30/500MB 6%
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VENDOR_DOCS_DIR = join(process.env.HOME ?? "", ".pi", "vendor-docs");
const SOURCES_DIR = join(VENDOR_DOCS_DIR, "sources");
const CONFIG_PATH = join(VENDOR_DOCS_DIR, "config.yaml");

const STATUS_KEY = "vendor-docs";
const POLL_INTERVAL_MS = 60_000;

function parseBudgetFromConfig(): number {
  try {
    if (!existsSync(CONFIG_PATH)) return 500;
    const content = readFileSync(CONFIG_PATH, "utf-8");
    const match = content.match(/^budget_mb:\s*(\d+)/m);
    return match ? parseInt(match[1], 10) : 500;
  } catch {
    return 500;
  }
}

async function getCacheInfo(): Promise<{ sourceCount: number; sizeMb: number; budgetMb: number } | null> {
  if (!existsSync(SOURCES_DIR)) return null;

  const budgetMb = parseBudgetFromConfig();

  try {
    const { stdout: lsOut } = await execFileAsync("ls", ["-1", SOURCES_DIR]);
    const sources = lsOut.trim().split("\n").filter(Boolean);
    if (sources.length === 0) return null;

    const { stdout: duOut } = await execFileAsync("du", ["-sm", SOURCES_DIR]);
    const sizeMb = parseInt(duOut.trim().split(/\s+/)[0] ?? "0", 10);

    return { sourceCount: sources.length, sizeMb, budgetMb };
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  let timer: ReturnType<typeof setInterval> | null = null;

  pi.on("session_start", async (_event, ctx) => {
    const update = async () => {
      const info = await getCacheInfo();
      if (info) {
        const pct = Math.round((info.sizeMb / info.budgetMb) * 100);
        const s = info.sourceCount === 1 ? "source" : "sources";
        const text = `📚 ${info.sourceCount} ${s} · ${info.sizeMb}/${info.budgetMb}MB ${pct}%`;
        ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", text));
      } else {
        ctx.ui.setStatus(STATUS_KEY, undefined);
      }
    };

    await update();

    timer = setInterval(async () => {
      try {
        await update();
      } catch {
        // Silently ignore polling errors
      }
    }, POLL_INTERVAL_MS);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    ctx.ui.setStatus(STATUS_KEY, undefined);
  });
}
