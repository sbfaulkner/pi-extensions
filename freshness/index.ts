/**
 * Freshness Extension — at startup, check user-managed extension/skill repos
 * for upstream commits and announce once if any are behind.
 *
 * Behavior:
 *   - Enumerates ~/.pi/agent/extensions/* and ~/.pi/agent/skills/*.
 *   - Resolves realpath; skips anything inside ~/.pi/ (pi-managed).
 *   - Walks each to its enclosing git root; de-dups.
 *   - For each root, on a tracked branch with a remote, runs `git ls-remote`
 *     and reports the behind count when the upstream is strictly ahead.
 *   - Inserts one transcript block on startup if any repos are behind.
 *     Silent otherwise. No commands, no cache, no snooze.
 */

import { execFile } from "node:child_process";
import { promises as fsp } from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";

const execFileAsync = promisify(execFile);

const CUSTOM_TYPE = "freshness/announcement";
const PER_GIT_TIMEOUT_MS = 3000;

export interface FreshnessDependencies {
  homeDir?: () => string;
  listDir?: (dir: string) => Promise<string[]>;
  realpath?: (p: string) => Promise<string>;
  runGit?: (cwd: string, args: string[], opts?: { timeoutMs?: number }) => Promise<{ stdout: string; code: number }>;
}

export interface RepoStatus {
  root: string;
  name: string;
  branch: string;
  behindCount: number;
}

async function defaultListDir(dir: string): Promise<string[]> {
  try {
    return await fsp.readdir(dir);
  } catch {
    return [];
  }
}

async function defaultRealpath(p: string): Promise<string> {
  try {
    return await fsp.realpath(p);
  } catch {
    return p;
  }
}

async function defaultRunGit(
  cwd: string,
  args: string[],
  opts: { timeoutMs?: number } = {},
): Promise<{ stdout: string; code: number }> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: opts.timeoutMs ?? PER_GIT_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    return { stdout, code: 0 };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string };
    const code = typeof e.code === "number" ? e.code : 1;
    return { stdout: typeof e.stdout === "string" ? e.stdout : "", code };
  }
}

/** Enumerate user-managed git roots reachable from pi's extension/skill load paths. */
export async function enumerateCandidateRoots(deps: FreshnessDependencies = {}): Promise<string[]> {
  const home = (deps.homeDir ?? (() => homedir()))();
  const listDir = deps.listDir ?? defaultListDir;
  const realpath = deps.realpath ?? defaultRealpath;
  const runGit = deps.runGit ?? defaultRunGit;

  const piPrefix = `${path.join(home, ".pi")}${path.sep}`;
  const sources = [path.join(home, ".pi", "agent", "extensions"), path.join(home, ".pi", "agent", "skills")];

  const roots = new Set<string>();
  for (const src of sources) {
    const entries = await listDir(src);
    for (const entry of entries) {
      const dir = path.join(src, entry);
      const rp = await realpath(dir);
      if (rp === path.join(home, ".pi") || rp.startsWith(piPrefix)) continue;
      const result = await runGit(rp, ["rev-parse", "--show-toplevel"]);
      if (result.code !== 0) continue;
      const root = result.stdout.trim();
      if (root) roots.add(root);
    }
  }
  return [...roots].sort();
}

/** Check a single repo. Returns null unless the upstream is strictly ahead. */
export async function checkRepo(
  root: string,
  runGit: NonNullable<FreshnessDependencies["runGit"]>,
): Promise<RepoStatus | null> {
  const head = await runGit(root, ["rev-parse", "HEAD"]);
  if (head.code !== 0) return null;
  const localSha = head.stdout.trim();

  const br = await runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (br.code !== 0) return null;
  const branch = br.stdout.trim();
  if (!branch || branch === "HEAD") return null;

  const rem = await runGit(root, ["config", `branch.${branch}.remote`]);
  if (rem.code !== 0) return null;
  const remote = rem.stdout.trim();
  if (!remote) return null;

  const lsr = await runGit(root, ["ls-remote", remote, branch], { timeoutMs: PER_GIT_TIMEOUT_MS });
  if (lsr.code !== 0) return null;
  const lines = lsr.stdout.split("\n").filter((line) => line.trim().length > 0);
  const match = lines.find((line) => line.endsWith(`refs/heads/${branch}`));
  if (!match) return null;
  const upstreamSha = match.split(/\s+/)[0];
  if (!upstreamSha || upstreamSha === localSha) return null;

  // Only report when upstream is strictly ahead (local is an ancestor of upstream).
  // Diverged / unrelated histories are silent.
  const anc = await runGit(root, ["merge-base", "--is-ancestor", localSha, upstreamSha]);
  if (anc.code !== 0) return null;

  const cnt = await runGit(root, ["rev-list", "--count", `${localSha}..${upstreamSha}`]);
  if (cnt.code !== 0) return null;
  const behindCount = Number.parseInt(cnt.stdout.trim(), 10);
  if (!Number.isFinite(behindCount) || behindCount <= 0) return null;

  return { root, name: path.basename(root), branch, behindCount };
}

/** Gather behind-status for all candidate roots. */
export async function gatherFreshness(deps: FreshnessDependencies = {}): Promise<RepoStatus[]> {
  const runGit = deps.runGit ?? defaultRunGit;
  const roots = await enumerateCandidateRoots(deps);
  const results = await Promise.all(roots.map((root) => checkRepo(root, runGit).catch(() => null)));
  return results.filter((r): r is RepoStatus => r !== null);
}

/** Render a compact aligned table for the announcement. */
export function formatAnnouncement(statuses: RepoStatus[]): string {
  if (statuses.length === 0) return "";
  const nameWidth = Math.max(...statuses.map((s) => s.name.length));
  const branchWidth = Math.max(...statuses.map((s) => s.branch.length));
  const header = statuses.length === 1 ? "1 repo behind upstream:" : `${statuses.length} repos behind upstream:`;
  const lines = statuses.map(
    (s) => `  ${s.name.padEnd(nameWidth)}  ${s.branch.padEnd(branchWidth)}  ⇡${s.behindCount}`,
  );
  return [header, "", ...lines].join("\n");
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: string; text?: string } => typeof c === "object" && c !== null)
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
  }
  return "";
}

export function createFreshnessExtension(pi: ExtensionAPI, deps: FreshnessDependencies = {}) {
  pi.registerMessageRenderer(CUSTOM_TYPE, (message, _opts, theme) => {
    const body = extractText(message.content);
    const heading = theme.fg("warning", "freshness · upstream changes available");
    const text = body ? `${heading}\n\n${theme.fg("dim", body)}` : heading;
    const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
    box.addChild(new Text(text, 0, 0));
    return box;
  });

  pi.on("session_start", (event, _ctx) => {
    if (event.reason !== "startup") return;
    // Fire-and-forget: never block startup on the network.
    void (async () => {
      try {
        const statuses = await gatherFreshness(deps);
        if (statuses.length === 0) return;
        pi.sendMessage(
          {
            customType: CUSTOM_TYPE,
            content: formatAnnouncement(statuses),
            display: true,
          },
          { triggerTurn: false },
        );
      } catch {
        // Silent on any failure — freshness must never break a session.
      }
    })();
  });
}

export default function (pi: ExtensionAPI) {
  createFreshnessExtension(pi);
}
