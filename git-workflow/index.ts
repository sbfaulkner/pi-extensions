/**
 * Git Workflow Extension
 *
 * Detects the appropriate git workflow for the current repo:
 * - If no remote is configured → local git workflow (no PRs)
 * - If a non-GitHub remote is configured → remote git workflow (no GitHub PR assumptions)
 * - If a GitHub remote is configured → GitHub PR-based workflow or Graphite (if configured)
 *
 * Injects a one-line context hint via the context event so the agent knows
 * which workflow to use. Detailed Graphite reference lives in the built-in
 * graphite skill. Local git guidance lives in the git-workflow skill. GitHub
 * PR guidance lives in the github-workflow skill.
 *
 * Config: ${PI_CODING_AGENT_DIR:-~/.pi/agent}/git-workflow.json
 * Command: /workflow (add/remove/list orgs, detect current repo)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// --- Configuration ---

const CONFIG_DIR = getAgentDir();
const CONFIG_PATH = path.join(CONFIG_DIR, "git-workflow.json");

interface Config {
  graphiteOrgs: string[];
}

function loadConfig(): Config {
  try {
    const data = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return {
      graphiteOrgs: Array.isArray(parsed.graphiteOrgs) ? parsed.graphiteOrgs : [],
    };
  } catch {
    return { graphiteOrgs: [] };
  }
}

function saveConfig(config: Config): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

// --- gt detection ---

let gtAvailable: boolean | undefined;

function isGtInstalled(): boolean {
  if (gtAvailable !== undefined) return gtAvailable;
  try {
    execFileSync("which", ["gt"], {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    gtAvailable = true;
  } catch {
    gtAvailable = false;
  }
  return gtAvailable;
}

// --- Repo detection ---

type WorkflowType = "graphite" | "github" | "git" | "remote-git" | "unknown";

function getOriginRemoteUrl(cwd: string): string | undefined {
  try {
    return execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

function extractGithubOrg(remoteUrl: string): string | undefined {
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\//i);
  return match ? match[1].toLowerCase() : undefined;
}

function getRemoteOrg(cwd: string): string | undefined {
  const remoteUrl = getOriginRemoteUrl(cwd);
  return remoteUrl ? extractGithubOrg(remoteUrl) : undefined;
}

/** Cache: cwd → workflow type (avoids shelling out on every LLM call) */
const workflowCache = new Map<string, WorkflowType>();

function detectWorkflow(cwd: string): WorkflowType {
  const cached = workflowCache.get(cwd);
  if (cached !== undefined) {
    updateStatus(cached);
    return cached;
  }

  let workflow: WorkflowType;
  // First check whether an origin remote is configured. If no remote exists,
  // fall back to the local git workflow. If a GitHub remote exists, then decide
  // between Graphite and GitHub PR workflows. Non-GitHub remotes get accurate
  // local-git-with-remote guidance rather than being treated as no remote.
  const remoteUrl = getOriginRemoteUrl(cwd);
  if (!remoteUrl) {
    workflow = "git";
  } else {
    const org = extractGithubOrg(remoteUrl);
    if (!org) {
      workflow = "remote-git";
    } else if (!isGtInstalled()) {
      workflow = "github";
    } else {
      const config = loadConfig();
      workflow = config.graphiteOrgs.some((o) => o.toLowerCase() === org) ? "graphite" : "github";
    }
  }

  workflowCache.set(cwd, workflow);
  updateStatus(workflow);
  return workflow;
}

function clearCache(): void {
  workflowCache.clear();
  gtAvailable = undefined;
}

// --- Status ---

/** Stored reference to the UI so detectWorkflow can update status at decision time. */
let currentUI:
  | {
      setStatus: (id: string, text: string | undefined) => void;
      theme: { fg: (style: string, text: string) => string };
    }
  | undefined;

function statusText(workflow: WorkflowType): string | undefined {
  switch (workflow) {
    case "graphite":
      return "gt";
    case "github":
      return "github";
    case "git":
    case "remote-git":
      return "git";
    default:
      return undefined;
  }
}

function updateStatus(workflow: WorkflowType): void {
  if (!currentUI) return;
  const label = statusText(workflow);
  currentUI.setStatus("git-workflow", label ? currentUI.theme.fg("dim", `\u2387 ${label} `) : undefined);
}

// --- Context messages ---

const GRAPHITE_CONTEXT =
  'This is a Graphite repo. Use `gt` for branch creation, commit/amend, restack/sync, submit, and stack navigation. Plain `git` is still appropriate for status/diff/staging and conflict resolution unless repo docs say otherwise. Load the graphite skill for the full command reference. Always provide explicit arguments and messages inline to avoid opening interactive prompts or an editor (e.g. `gt checkout <branch>` instead of bare `gt checkout`, `gt create -am "message"`, `gt submit --no-edit`). Note: if the repo\'s AGENTS.md or project docs specify a different workflow, follow those instead.';
const GITHUB_CONTEXT =
  'This repo uses standard GitHub PRs. Use `git` and `gh` for branching, pushing, and creating PRs. Load the github-workflow skill for best practices. Always provide explicit arguments and messages inline to avoid opening interactive prompts or an editor (e.g. `git commit -m "message"`, `gh pr edit --body-file ...`, `git rebase main`). Note: if the repo\'s AGENTS.md or project docs specify a different workflow, follow those instead.';
const GIT_CONTEXT =
  'This repo has no remote configured. Use local `git` workflows (branches, commits) — there is no remote GitHub PR workflow available. Load the git-workflow skill for best practices and use explicit arguments (e.g. `git commit -m "message"`).';
const REMOTE_GIT_CONTEXT =
  'This repo has a non-GitHub origin remote. Use explicit local `git` commands for branching, commits, fetching, rebasing, and pushing; do not assume GitHub PRs or `gh` are available unless repo docs say so. Load the git-workflow skill for best practices and use explicit arguments (e.g. `git commit -m "message"`).';

// --- Extension ---

export { detectWorkflow, getRemoteOrg, isGtInstalled, loadConfig, saveConfig };

export default function (pi: ExtensionAPI) {
  // --- /workflow command ---

  pi.registerCommand("workflow", {
    description: "Manage git workflow configuration (Graphite orgs)",
    handler: async (_args, ctx) => {
      const config = loadConfig();
      const usage = "Usage: /workflow [list|add <org>|remove <org>|detect]";
      const rawArgs = typeof _args === "string" ? _args.trim() : "";
      let action: "list" | "add" | "remove" | "detect" | undefined;
      let orgArg: string | undefined;

      if (rawArgs) {
        const [command, ...rest] = rawArgs.split(/\s+/);
        orgArg = rest.join(" ").trim() || undefined;

        switch (command.toLowerCase()) {
          case "list":
          case "ls":
            action = "list";
            break;
          case "add":
            action = "add";
            break;
          case "remove":
          case "rm":
            action = "remove";
            break;
          case "detect":
            action = "detect";
            break;
          case "help":
          case "--help":
          case "-h":
            ctx.ui.notify(usage, "info");
            return;
          default:
            ctx.ui.notify(`${usage}. Unknown action: ${command}`, "warning");
            return;
        }
      } else {
        if (!ctx.hasUI) {
          ctx.ui.notify(usage, "warning");
          return;
        }

        const selection = await ctx.ui.select("Git Workflow Configuration", [
          "List configured orgs",
          "Add an org",
          "Remove an org",
          "Detect current repo",
        ]);

        if (!selection) return;

        action =
          selection === "List configured orgs"
            ? "list"
            : selection === "Add an org"
              ? "add"
              : selection === "Remove an org"
                ? "remove"
                : "detect";
      }

      if (action === "list") {
        if (config.graphiteOrgs.length === 0) {
          ctx.ui.notify("No orgs configured. Use /workflow add <org> to add one.", "info");
        } else {
          ctx.ui.notify(`Graphite orgs: ${config.graphiteOrgs.join(", ")}`, "info");
        }
      } else if (action === "add") {
        let org = orgArg;
        if (!org) {
          if (!ctx.hasUI) {
            ctx.ui.notify(usage, "warning");
            return;
          }

          org = await ctx.ui.input("GitHub org to use Graphite workflow", "e.g. Shopify");
        }
        if (!org) return;

        const trimmed = org.trim();
        if (!trimmed) return;

        if (config.graphiteOrgs.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
          ctx.ui.notify(`"${trimmed}" is already configured.`, "info");
          return;
        }

        config.graphiteOrgs.push(trimmed);
        saveConfig(config);
        clearCache();
        // Re-detect so the status reflects the new config immediately
        if (ctx.cwd) detectWorkflow(ctx.cwd);
        ctx.ui.notify(`Added "${trimmed}".`, "info");
      } else if (action === "remove") {
        if (config.graphiteOrgs.length === 0) {
          ctx.ui.notify("No orgs configured.", "info");
          return;
        }

        let org = orgArg;
        if (!org) {
          if (!ctx.hasUI) {
            ctx.ui.notify(usage, "warning");
            return;
          }

          org = await ctx.ui.select("Select org to remove", config.graphiteOrgs);
        }
        if (!org) return;

        const existing = config.graphiteOrgs.find((o) => o.toLowerCase() === org.toLowerCase());
        if (!existing) {
          ctx.ui.notify(`"${org}" is not configured.`, "warning");
          return;
        }

        config.graphiteOrgs = config.graphiteOrgs.filter((o) => o.toLowerCase() !== existing.toLowerCase());
        saveConfig(config);
        clearCache();
        // Re-detect so the status reflects the new config immediately
        if (ctx.cwd) detectWorkflow(ctx.cwd);
        ctx.ui.notify(`Removed "${existing}".`, "info");
      } else if (action === "detect") {
        const cwd = ctx.cwd;
        if (!cwd) {
          ctx.ui.notify("No working directory.", "warning");
          return;
        }

        const org = getRemoteOrg(cwd);
        clearCache();
        const workflow = detectWorkflow(cwd);
        const gt = isGtInstalled();

        ctx.ui.notify(`org: ${org ?? "none"} | gt: ${gt ? "yes" : "no"} | workflow: ${workflow}`, "info");
      }
    },
  });

  // --- Track UI reference for status updates ---

  pi.on("session_start", async (_event, ctx) => {
    currentUI = ctx.ui;
    const cwd = ctx.cwd;
    if (cwd) detectWorkflow(cwd);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("git-workflow", undefined);
    currentUI = undefined;
  });

  // --- Inject workflow context into every LLM call ---

  pi.on("context", async (_event, ctx) => {
    const cwd = ctx.cwd;
    if (!cwd) return undefined;

    const workflow = detectWorkflow(cwd);
    const content =
      workflow === "graphite"
        ? GRAPHITE_CONTEXT
        : workflow === "github"
          ? GITHUB_CONTEXT
          : workflow === "git"
            ? GIT_CONTEXT
            : workflow === "remote-git"
              ? REMOTE_GIT_CONTEXT
              : undefined;

    if (!content) return undefined;

    return {
      messages: [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: content }],
          customType: "git-workflow-context",
        },
        ..._event.messages,
      ],
    };
  });
}
