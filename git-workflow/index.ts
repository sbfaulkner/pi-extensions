/**
 * Git Workflow Extension
 *
 * Detects the appropriate git workflow for the current repo:
 * - If `gt` is installed and the repo belongs to a configured org → Graphite
 * - Otherwise → standard PR-based git workflow
 *
 * Injects a one-line context hint via the context event so the agent knows
 * which workflow to use. Detailed Graphite reference lives in the built-in
 * graphite skill. Standard git workflow reference lives in the git-workflow skill.
 *
 * Config: ~/.config/pi/git-workflow.json
 * Command: /git-workflow (add/remove/list orgs, detect current repo)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// --- Configuration ---

const CONFIG_DIR = path.join(process.env.HOME ?? "", ".config", "pi");
const CONFIG_PATH = path.join(CONFIG_DIR, "git-workflow.json");

interface Config {
  graphiteOrgs: string[];
}

function loadConfig(): Config {
  try {
    const data = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(data);
    return {
      graphiteOrgs: Array.isArray(parsed.graphiteOrgs)
        ? parsed.graphiteOrgs
        : [],
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

type WorkflowType = "graphite" | "git" | "unknown";

function getRemoteOrg(cwd: string): string | undefined {
  try {
    const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const match = remoteUrl.match(/github\.com[:/]([^/]+)\//i);
    return match ? match[1].toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

/** Cache: cwd → workflow type (avoids shelling out on every LLM call) */
const workflowCache = new Map<string, WorkflowType>();

function detectWorkflow(cwd: string): WorkflowType {
  const cached = workflowCache.get(cwd);
  if (cached !== undefined) return cached;

  let workflow: WorkflowType;
  if (!isGtInstalled()) {
    workflow = "git";
  } else {
    const org = getRemoteOrg(cwd);
    if (!org) {
      workflow = "unknown";
    } else {
      const config = loadConfig();
      workflow = config.graphiteOrgs.some((o) => o.toLowerCase() === org)
        ? "graphite"
        : "git";
    }
  }

  workflowCache.set(cwd, workflow);
  return workflow;
}

function clearCache(): void {
  workflowCache.clear();
}

// --- Context messages ---

const GRAPHITE_CONTEXT =
  "This is a Graphite repo. Use `gt` instead of `git` for all mutating operations. Load the graphite skill for the full command reference. Note: if the repo's AGENTS.md or project docs specify a different workflow, follow those instead.";
const GIT_CONTEXT =
  "This repo uses standard git PRs. Use `git` and `gh` for branching, pushing, and creating PRs. Load the git-workflow skill for best practices. Note: if the repo's AGENTS.md or project docs specify a different workflow, follow those instead.";

// --- Extension ---

export { detectWorkflow, getRemoteOrg, isGtInstalled, loadConfig, saveConfig };

export default function (pi: ExtensionAPI) {
  // --- /git-workflow command ---

  pi.registerCommand("git-workflow", {
    description: "Manage git workflow configuration (Graphite orgs)",
    handler: async (_args, ctx) => {
      const config = loadConfig();

      const action = await ctx.ui.select(
        "Git Workflow Configuration",
        [
          "List configured orgs",
          "Add an org",
          "Remove an org",
          "Detect current repo",
        ],
      );

      if (!action) return;

      if (action === "List configured orgs") {
        if (config.graphiteOrgs.length === 0) {
          ctx.ui.notify(
            "No orgs configured. Use /git-workflow to add one.",
            "info",
          );
        } else {
          ctx.ui.notify(
            `Graphite orgs: ${config.graphiteOrgs.join(", ")}`,
            "info",
          );
        }
      } else if (action === "Add an org") {
        const org = await ctx.ui.input(
          "GitHub org to use Graphite workflow",
          "e.g. Shopify",
        );
        if (!org) return;

        const trimmed = org.trim();
        if (
          config.graphiteOrgs.some(
            (o) => o.toLowerCase() === trimmed.toLowerCase(),
          )
        ) {
          ctx.ui.notify(`"${trimmed}" is already configured.`, "info");
          return;
        }

        config.graphiteOrgs.push(trimmed);
        saveConfig(config);
        clearCache();
        ctx.ui.notify(`Added "${trimmed}".`, "info");
      } else if (action === "Remove an org") {
        if (config.graphiteOrgs.length === 0) {
          ctx.ui.notify("No orgs configured.", "info");
          return;
        }

        const org = await ctx.ui.select(
          "Select org to remove",
          config.graphiteOrgs,
        );
        if (!org) return;

        config.graphiteOrgs = config.graphiteOrgs.filter((o) => o !== org);
        saveConfig(config);
        clearCache();
        ctx.ui.notify(`Removed "${org}".`, "info");
      } else if (action === "Detect current repo") {
        const cwd = ctx.cwd;
        if (!cwd) {
          ctx.ui.notify("No working directory.", "warning");
          return;
        }

        const org = getRemoteOrg(cwd);
        const workflow = detectWorkflow(cwd);
        const gt = isGtInstalled();

        ctx.ui.notify(
          `org: ${org ?? "none"} | gt: ${gt ? "yes" : "no"} | workflow: ${workflow}`,
          "info",
        );
      }
    },
  });

  // --- Inject workflow context into every LLM call ---

  pi.on("context", async (_event, ctx) => {
    const cwd = ctx.cwd;
    if (!cwd) return undefined;

    const workflow = detectWorkflow(cwd);
    const content =
      workflow === "graphite"
        ? GRAPHITE_CONTEXT
        : workflow === "git"
          ? GIT_CONTEXT
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
