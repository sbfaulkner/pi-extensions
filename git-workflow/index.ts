/**
 * Git Workflow Extension
 *
 * Detects the appropriate git workflow for the current repo:
 * - If no remote is configured → local git workflow (no PRs)
 * - If a non-GitHub remote is configured → remote git workflow (no GitHub PR assumptions)
 * - If a GitHub remote is configured → GitHub PR-based workflow
 *
 * Injects a one-line context hint via the context event so the agent knows
 * which workflow to use. Local git guidance lives in the git-workflow skill.
 * GitHub PR guidance lives in the github-workflow skill.
 *
 * Command: /workflow (detect the current repo's workflow)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFileSync } from "node:child_process";

type ContextEvent = {
  messages: unknown[];
};

type ContextEventContext = {
  cwd?: string;
};

type ContextEventHandler = (
  event: ContextEvent,
  ctx: ContextEventContext,
) => Promise<{ messages: unknown[] } | undefined>;

type RegisterContextEvent = (event: "context", handler: ContextEventHandler) => void;

// --- Repo detection ---

type WorkflowType = "github" | "git" | "remote-git" | "unknown";

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
  // No origin remote falls back to the local git workflow. Non-GitHub remotes
  // get local-git-with-remote guidance rather than being treated as no remote.
  const remoteUrl = getOriginRemoteUrl(cwd);
  if (!remoteUrl) {
    workflow = "git";
  } else {
    workflow = extractGithubOrg(remoteUrl) ? "github" : "remote-git";
  }

  workflowCache.set(cwd, workflow);
  updateStatus(workflow);
  return workflow;
}

function clearCache(): void {
  workflowCache.clear();
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

export const GITHUB_CONTEXT =
  'This repo uses standard GitHub PRs. Use `git` and `gh` for branching, pushing, and creating PRs. Create new PRs as drafts by default (`gh pr create --draft ...`) to avoid requesting review of early iterations, and do not mark them ready unless the user explicitly asks or repo docs require it. Load the github-workflow skill for best practices. Always provide explicit arguments and messages inline to avoid opening interactive prompts or an editor (e.g. `git commit -m "message"`, `gh pr edit --body-file ...`, `git rebase main`). Note: if the repo\'s AGENTS.md or project docs specify a different workflow, follow those instead.';
const GIT_CONTEXT =
  'This repo has no remote configured. Use local `git` workflows (branches, commits) — there is no remote GitHub PR workflow available. Load the git-workflow skill for best practices and use explicit arguments (e.g. `git commit -m "message"`).';
const REMOTE_GIT_CONTEXT =
  'This repo has a non-GitHub origin remote. Use explicit local `git` commands for branching, commits, fetching, rebasing, and pushing; do not assume GitHub PRs or `gh` are available unless repo docs say so. Load the git-workflow skill for best practices and use explicit arguments (e.g. `git commit -m "message"`).';

// --- Extension ---

export { detectWorkflow, getRemoteOrg };

export default function (pi: ExtensionAPI) {
  // --- /workflow command ---

  pi.registerCommand("workflow", {
    description: "Detect the current repo's git workflow",
    handler: async (_args, ctx) => {
      const cwd = ctx.cwd;
      if (!cwd) {
        ctx.ui.notify("No working directory.", "warning");
        return;
      }

      const org = getRemoteOrg(cwd);
      clearCache();
      const workflow = detectWorkflow(cwd);

      ctx.ui.notify(`org: ${org ?? "none"} | workflow: ${workflow}`, "info");
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

  const onContext = pi.on as unknown as RegisterContextEvent;
  onContext("context", async (event, ctx) => {
    const cwd = ctx.cwd;
    if (!cwd) return undefined;

    const workflow = detectWorkflow(cwd);
    const content =
      workflow === "github"
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
        ...event.messages,
      ],
    };
  });
}
