/**
 * Handoff Extension — transfer context to a new focused session.
 *
 * Instead of compacting (which is lossy), handoff extracts what matters
 * for your next task and creates a new session with a generated prompt.
 *
 * Usage:
 *   /handoff now implement this for teams as well
 *   /handoff execute phase one of the plan
 *   /handoff in a new pane, finish the migration
 *   /handoff in the edgey repo, add an alibaba_origin block type
 *   /handoff in a new tab in shopify-cli, port the same fix
 *
 * The free-text instruction may include where the new session should run:
 *   - same pi session (default)
 *   - a new Ghostty pane (split)
 *   - a new Ghostty tab
 *   - a new Ghostty window
 * and optionally a target repository/directory. The repo convention is
 * ~/src/github.com/<org>/<repo>; the LLM resolves nicknames against it,
 * and a confirmation step lets the user correct the resolved path before
 * anything is spawned.
 *
 * The generated prompt appears as a draft in the editor for review/editing.
 *
 * Adapted from Pi's official handoff example:
 * https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/handoff.ts
 */

import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { complete, type AssistantMessage, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import { BorderedLoader, convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";

export const SYSTEM_PROMPT = `You are a context transfer assistant. Given a conversation history and the user's free-text instruction for a new session, output a JSON object with this exact shape (and nothing else — no preamble, no code fence):

{
  "mode": "in-process" | "pane" | "tab" | "window",
  "direction": "right" | "left" | "up" | "down" | null,
  "targetDir": string | null,
  "prompt": string
}

Field guidance:

- "mode": Default is "in-process" (start the new session in the current pi instance, same working directory). Use "pane" / "tab" / "window" only when the user explicitly asks for a separate Ghostty pane/tab/window, OR when they ask to run the task in a different repo/directory (in that case default to "pane" unless they specify otherwise).

- "direction": Only meaningful when "mode" is "pane". Defaults to "right" when the user does not say. Use null for any other mode.

- "targetDir":
  - When the user names a repo by nickname (e.g. "in edgey", "in the shopify-cli repo"), resolve it to an absolute-style path using the convention "~/src/github.com/<org>/<repo>". If you don't know the org, prefer "Shopify" (this is the common case).
  - When the user gives an explicit path (with or without "~"), use it verbatim.
  - When the user does not specify a repo/path, set this to null. (For "in-process" mode this means keep the current cwd; for pane/tab/window modes the spawn will inherit the current cwd.)

- "prompt": a focused, self-contained handoff prompt for the new session. The new session has NO memory of the source conversation. Structure it as:
  1. ## Context — relevant decisions, findings, file paths, approaches.
  2. ## Task — what to do next, based on the user's instruction.
  3. Acceptance criteria when meaningful.

  If "targetDir" is set and points to a different repository than the current cwd, the receiving session does NOT know the source repo. Reference files in the source repo by absolute or repo-qualified path and include enough orienting context that the new session can act independently.

Output ONLY the JSON object.`;

function entryTimestamp(entry: SessionEntry): number {
  return new Date(entry.timestamp).getTime();
}

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
  if (entry.type === "message") {
    return entry.message;
  }

  if (entry.type === "compaction") {
    return {
      role: "compactionSummary",
      summary: entry.summary,
      tokensBefore: entry.tokensBefore,
      timestamp: entryTimestamp(entry),
    };
  }

  if (entry.type === "branch_summary") {
    return {
      role: "branchSummary",
      summary: entry.summary,
      fromId: entry.fromId,
      timestamp: entryTimestamp(entry),
    };
  }

  if (entry.type === "custom_message") {
    return {
      role: "custom",
      customType: entry.customType,
      content: entry.content,
      display: entry.display,
      details: entry.details,
      timestamp: entryTimestamp(entry),
    };
  }

  return undefined;
}

export function getHandoffMessages(branch: SessionEntry[]): AgentMessage[] {
  let compactionIndex = -1;
  for (let i = branch.length - 1; i >= 0; i--) {
    if (branch[i].type === "compaction") {
      compactionIndex = i;
      break;
    }
  }

  if (compactionIndex < 0) {
    return branch.map(entryToMessage).filter((message) => message !== undefined);
  }

  const compaction = branch[compactionIndex];
  const firstKeptIndex =
    compaction.type === "compaction" ? branch.findIndex((entry) => entry.id === compaction.firstKeptEntryId) : -1;
  const compactedBranch = [
    compaction,
    ...(firstKeptIndex >= 0 ? branch.slice(firstKeptIndex, compactionIndex) : []),
    ...branch.slice(compactionIndex + 1),
  ];

  return compactedBranch.map(entryToMessage).filter((message) => message !== undefined);
}

function truncateForNotification(text: string, maxChars = 900): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

export function responseDiagnostics(response: AssistantMessage): string {
  const contentTypes = response.content.map((content) => content.type).join(",") || "none";
  const diagnostics = response.diagnostics
    ?.map((diagnostic) => diagnostic.error?.message || diagnostic.type)
    .filter((message) => message && message.length > 0)
    .join("; ");

  return truncateForNotification(
    [
      `stopReason=${response.stopReason}`,
      `contentTypes=${contentTypes}`,
      response.errorMessage ? `error=${response.errorMessage}` : undefined,
      diagnostics ? `diagnostics=${diagnostics}` : undefined,
    ]
      .filter(Boolean)
      .join("; "),
  );
}

export type HandoffMode = "in-process" | "pane" | "tab" | "window";
export type SplitDirection = "right" | "left" | "up" | "down";

export interface HandoffIntent {
  mode: HandoffMode;
  direction: SplitDirection | null;
  targetDir: string | null;
  prompt: string;
}

/**
 * Parse the model's structured JSON response. Tolerant of code fences and
 * stray prose around the JSON. On failure, returns null.
 */
export function parseHandoffIntent(text: string): HandoffIntent | null {
  const trimmed = text.trim();
  // Strip a single surrounding ```json ... ``` or ``` ... ``` fence if present.
  const fenceStripped = trimmed.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  // Find the first balanced JSON object.
  const firstBrace = fenceStripped.indexOf("{");
  if (firstBrace < 0) return null;
  // Take from first { to last } — simple and works for our schema.
  const lastBrace = fenceStripped.lastIndexOf("}");
  if (lastBrace <= firstBrace) return null;
  const slice = fenceStripped.slice(firstBrace, lastBrace + 1);

  let raw: unknown;
  try {
    raw = JSON.parse(slice);
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const validModes: HandoffMode[] = ["in-process", "pane", "tab", "window"];
  const mode = validModes.includes(obj.mode as HandoffMode) ? (obj.mode as HandoffMode) : "in-process";

  const validDirs: SplitDirection[] = ["right", "left", "up", "down"];
  let direction: SplitDirection | null = null;
  if (typeof obj.direction === "string" && validDirs.includes(obj.direction as SplitDirection)) {
    direction = obj.direction as SplitDirection;
  }
  if (mode === "pane" && direction === null) direction = "right";
  if (mode !== "pane") direction = null;

  const targetDir = typeof obj.targetDir === "string" && obj.targetDir.length > 0 ? obj.targetDir : null;
  const prompt = typeof obj.prompt === "string" ? obj.prompt : "";

  if (!prompt.trim()) return null;

  return { mode, direction, targetDir, prompt };
}

/**
 * Resolve a leading "~" or "~user" in a path against the user's home directory.
 */
export function expandTilde(input: string, home: string = homedir()): string {
  if (input === "~") return home;
  if (input.startsWith("~/")) return path.join(home, input.slice(2));
  return input;
}

type HandoffLoader = {
  signal?: AbortSignal;
  onAbort?: () => void;
};

export interface HandoffSpawnDeps {
  /** Synchronously capture the current Ghostty window id (or "" if unavailable). */
  captureWindowId?: () => string;
  /** Spawn a delegated Ghostty pane/tab/window. */
  spawnDelegated?: (args: SpawnDelegatedArgs) => void;
  /** Write the task file to a temp location and return its absolute path. */
  writeTaskFile?: (prompt: string) => string;
}

export interface SpawnDelegatedArgs {
  mode: Exclude<HandoffMode, "in-process">;
  direction: SplitDirection | null;
  targetDir: string | null;
  taskFile: string;
  windowId: string;
  scriptDir: string;
}

interface HandoffDependencies extends HandoffSpawnDeps {
  complete?: typeof complete;
  convertToLlm?: typeof convertToLlm;
  serializeConversation?: typeof serializeConversation;
  createLoader?: (tui: unknown, theme: unknown, message: string) => HandoffLoader;
  now?: () => number;
  scriptDir?: string;
}

const DEFAULT_SCRIPT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "scripts");

function defaultCaptureWindowId(scriptDir: string): string {
  if (process.platform !== "darwin") return "";
  try {
    const out = execFileSync("osascript", [path.join(scriptDir, "ghostty-current-window-id.applescript")], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim();
  } catch {
    return "";
  }
}

function defaultWriteTaskFile(prompt: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pi-handoff-"));
  const file = path.join(dir, "task.md");
  // Prepend a self-cleanup hint so the receiving session removes the temp file
  // (and its containing dir) when it starts.
  const header = `**Before starting, delete this task file:** \`rm -rf ${dir}\`\n\n`;
  writeFileSync(file, header + prompt, { encoding: "utf8", mode: 0o600 });
  return file;
}

function defaultSpawnDelegated(args: SpawnDelegatedArgs): void {
  const cmd = `${path.join(args.scriptDir, "pi-delegate")} @${args.taskFile}`;
  const scriptName =
    args.mode === "pane"
      ? "ghostty-pane.applescript"
      : args.mode === "tab"
        ? "ghostty-tab.applescript"
        : "ghostty-window.applescript";

  const cliArgs: string[] = [path.join(args.scriptDir, scriptName)];
  if (args.mode === "pane" && args.direction) {
    cliArgs.push("--direction", args.direction);
  }
  cliArgs.push("--cmd", cmd);
  if (args.targetDir) cliArgs.push("--dir", args.targetDir);
  // Window mode is unambiguous — no window-id needed.
  if (args.mode !== "window" && args.windowId) {
    cliArgs.push("--window-id", args.windowId);
  }

  // Fire and forget. Errors surface to the user via Ghostty itself.
  execFile("osascript", cliArgs, (err) => {
    if (err) {
      // Best-effort; nothing useful to do here. The handler has already
      // returned by this point.
    }
  });
}

export function createHandoffExtension(pi: ExtensionAPI, deps: HandoffDependencies = {}) {
  const completePrompt = deps.complete ?? complete;
  const toLlm = deps.convertToLlm ?? convertToLlm;
  const serialize = deps.serializeConversation ?? serializeConversation;
  const createLoader =
    deps.createLoader ??
    ((tui, theme, message) =>
      new BorderedLoader(
        tui as ConstructorParameters<typeof BorderedLoader>[0],
        theme as ConstructorParameters<typeof BorderedLoader>[1],
        message,
      ));
  const now = deps.now ?? Date.now;
  const scriptDir = deps.scriptDir ?? DEFAULT_SCRIPT_DIR;
  const captureWindowId = deps.captureWindowId ?? (() => defaultCaptureWindowId(scriptDir));
  const writeTaskFile = deps.writeTaskFile ?? defaultWriteTaskFile;
  const spawnDelegated = deps.spawnDelegated ?? defaultSpawnDelegated;

  pi.registerCommand("handoff", {
    description: "Transfer context to a new focused session (optionally in a new pane/tab/window or repo)",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("handoff requires interactive mode", "error");
        return;
      }

      if (!ctx.model) {
        ctx.ui.notify("No model selected", "error");
        return;
      }
      const model = ctx.model;

      const goal = args.trim();
      if (!goal) {
        ctx.ui.notify("Usage: /handoff <goal for new session>", "error");
        return;
      }

      // RACE FIX: capture the current Ghostty window id synchronously, before
      // we do any awaitable work. If the user switches focus to a different
      // Ghostty window during the LLM call or the editor step, a later spawn
      // can still anchor to this window. Cheap (~50ms osascript) and silent
      // on failure (returns "" — spawn will fall back to front window /
      // new window).
      const capturedWindowId = captureWindowId();

      await ctx.waitForIdle();

      // Gather conversation context from current branch. If the branch was compacted,
      // include the compaction summary plus entries from firstKeptEntryId onward.
      const messages = getHandoffMessages(ctx.sessionManager.getBranch());
      if (messages.length === 0) {
        ctx.ui.notify("No conversation to hand off", "error");
        return;
      }

      const llmMessages = toLlm(messages);
      const conversationText = serialize(llmMessages);
      const currentSessionFile = ctx.sessionManager.getSessionFile();

      let generationError: string | undefined;

      // Generate the handoff intent + prompt with loader UI.
      const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const loader = createLoader(tui, theme, `Generating handoff prompt using ${model.id}...`);
        loader.onAbort = () => done(null);

        const doGenerate = async () => {
          const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
          if (!auth.ok) {
            const authError = (auth as { error?: string }).error;
            throw new Error(authError || `Authentication failed for ${model.provider}/${model.id}`);
          }
          if (!auth.apiKey) {
            throw new Error(`No API key for ${model.provider}/${model.id}`);
          }

          const userMessage: UserMessage = {
            role: "user",
            content: [
              {
                type: "text",
                text: `## Conversation History\n\n${conversationText}\n\n## User's Instruction for New Session\n\n${goal}`,
              },
            ],
            timestamp: now(),
          };

          const response = await completePrompt(
            model,
            { systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
            { apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
          );

          if (response.stopReason === "aborted") {
            return null;
          }

          if (response.stopReason === "error") {
            throw new Error(`Handoff generation failed: ${responseDiagnostics(response)}`);
          }

          const text = response.content
            .filter((content): content is { type: "text"; text: string } => content.type === "text")
            .map((content) => content.text)
            .join("\n");

          if (!text.trim()) {
            throw new Error(`Handoff generation returned no text: ${responseDiagnostics(response)}`);
          }

          return text;
        };

        doGenerate()
          .then(done)
          .catch((error) => {
            generationError = error?.message || String(error);
            done(null);
          });

        return loader as HandoffLoader & Component;
      });

      if (result === null) {
        ctx.ui.notify(generationError ?? "Cancelled", generationError ? "error" : "info");
        return;
      }

      const intent = parseHandoffIntent(result);
      if (!intent) {
        ctx.ui.notify(
          `Could not parse handoff intent from model. Raw output:\n${truncateForNotification(result, 600)}`,
          "error",
        );
        return;
      }

      // Resolve targetDir tilde for display and for passing to the AppleScript.
      const resolvedTargetDir = intent.targetDir ? expandTilde(intent.targetDir) : null;

      // Confirmation safety net for any non-in-process delegation. Shows the
      // resolved directory so the user can catch a wrong nickname/path guess.
      if (intent.mode !== "in-process") {
        const dirLine = resolvedTargetDir ? resolvedTargetDir : "(current working directory)";
        const modeLine = intent.mode === "pane" ? `pane (${intent.direction})` : intent.mode;
        const confirmed = await ctx.ui.confirm(
          "Delegate to a new Ghostty session?",
          `Mode:      ${modeLine}\nDirectory: ${dirLine}`,
        );
        if (!confirmed) {
          ctx.ui.notify("Cancelled", "info");
          return;
        }
      }

      // Let the user review/edit the generated prompt before starting / spawning.
      const editedPrompt = await ctx.ui.editor("Edit handoff prompt", intent.prompt);
      if (editedPrompt === undefined) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      if (!editedPrompt.trim()) {
        ctx.ui.notify("Handoff prompt was empty", "error");
        return;
      }

      if (intent.mode === "in-process") {
        // Existing behavior: replace the current session, stage the prompt.
        const newSessionResult = await ctx.newSession({
          parentSession: currentSessionFile,
          withSession: async (replacementCtx) => {
            replacementCtx.ui.setEditorText(editedPrompt);
            replacementCtx.ui.notify("Handoff ready. Submit when ready.", "info");
          },
        });

        if (newSessionResult.cancelled) {
          ctx.ui.notify("New session cancelled", "info");
        }
        return;
      }

      // Delegated spawn into a new Ghostty pane/tab/window.
      const taskFile = writeTaskFile(editedPrompt);
      spawnDelegated({
        mode: intent.mode,
        direction: intent.direction,
        targetDir: resolvedTargetDir,
        taskFile,
        windowId: capturedWindowId,
        scriptDir,
      });

      const where =
        intent.mode === "pane" ? `new pane (${intent.direction})` : intent.mode === "tab" ? "new tab" : "new window";
      const inDir = resolvedTargetDir ? ` in ${resolvedTargetDir}` : "";
      ctx.ui.notify(`Delegated to ${where}${inDir}.`, "info");
    },
  });
}

export default function (pi: ExtensionAPI) {
  createHandoffExtension(pi);
}
