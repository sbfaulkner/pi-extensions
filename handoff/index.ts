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
import { mkdtempSync, promises as fsp, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { complete, type AssistantMessage, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import { BorderedLoader, convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";

function buildSystemPrompt(defaultMode: HandoffMode): string {
  const defaultModeExplanation =
    defaultMode === "in-process"
      ? `Default "mode" is "in-process" (start the new session in the current pi instance, same working directory — replacing this session). Use "pane" / "tab" / "window" only when the user explicitly asks for a separate Ghostty surface, OR when they ask to run the task in a different repo/directory (in that case default to "pane" unless they specify otherwise).`
      : `Default "mode" is "${defaultMode}" (spawn a new Ghostty surface; the current session continues). Use "in-process" only when the user explicitly asks to continue "here" / "in this session" / "in a fresh thread" without mentioning a separate pane/tab/window/repo. Use a different surface mode (pane/tab/window) when the user explicitly says so.`;

  return `You are a context transfer assistant. Given a conversation history and the user's free-text instruction for a new session, output a JSON object with this exact shape (and nothing else — no preamble, no code fence):

{
  "mode": "in-process" | "pane" | "tab" | "window",
  "direction": "right" | "left" | "up" | "down" | null,
  "targetRepo": string | null,
  "targetDir": string | null,
  "prompt": string
}

Field guidance:

- "mode": ${defaultModeExplanation}

- "direction": Only meaningful when "mode" is "pane". Defaults to "right" when the user does not say. Use null for any other mode.

- "targetRepo": A bare repo nickname (e.g. "edgey", "shopify-cli") when the user named a repo without giving a full path. DO NOT guess an org or a path — just the single-segment repo name. The extension resolves the actual path by globbing the filesystem. Set to null if the user gave an explicit path or named no repo.

- "targetDir": ONLY when the user gave an explicit path (with or without "~"), use it verbatim. Otherwise set to null. Never put a bare repo nickname here — use "targetRepo" for that.

- At most one of "targetRepo" / "targetDir" should be non-null. If the user gave neither, both are null and the spawn inherits the current cwd.

- "prompt": a focused, self-contained handoff prompt for the new session. The new session has NO memory of the source conversation. Structure it as:
  1. ## Context — relevant decisions, findings, file paths, approaches.
  2. ## Task — what to do next, based on the user's instruction.
  3. Acceptance criteria when meaningful.

  If "targetDir" is set and points to a different repository than the current cwd, the receiving session does NOT know the source repo. Reference files in the source repo by absolute or repo-qualified path and include enough orienting context that the new session can act independently.

Output ONLY the JSON object.`;
}

/** Backwards-compatible export: the system prompt for the historical /handoff default. */
export const SYSTEM_PROMPT = buildSystemPrompt("in-process");

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
  /** A bare repo nickname (e.g. "edgey"). Resolved via filesystem glob against ~/src/github.com/*. */
  targetRepo: string | null;
  /** An explicit path the user gave verbatim. Mutually exclusive with targetRepo. */
  targetDir: string | null;
  prompt: string;
}

/**
 * Parse the model's structured JSON response. Tolerant of code fences and
 * stray prose around the JSON. On failure, returns null.
 */
export function parseHandoffIntent(text: string, defaultMode: HandoffMode = "in-process"): HandoffIntent | null {
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
  const mode = validModes.includes(obj.mode as HandoffMode) ? (obj.mode as HandoffMode) : defaultMode;

  const validDirs: SplitDirection[] = ["right", "left", "up", "down"];
  let direction: SplitDirection | null = null;
  if (typeof obj.direction === "string" && validDirs.includes(obj.direction as SplitDirection)) {
    direction = obj.direction as SplitDirection;
  }
  if (mode === "pane" && direction === null) direction = "right";
  if (mode !== "pane") direction = null;

  let targetRepo: string | null =
    typeof obj.targetRepo === "string" && obj.targetRepo.length > 0 ? obj.targetRepo : null;
  let targetDir: string | null = typeof obj.targetDir === "string" && obj.targetDir.length > 0 ? obj.targetDir : null;

  // Safety net for model drift: if the model put a bare nickname (no slashes,
  // no leading ~) in targetDir, treat it as targetRepo instead. This keeps the
  // filesystem-resolution path in charge even when the model ignores the schema.
  if (targetDir && !targetRepo && !targetDir.includes("/") && !targetDir.startsWith("~")) {
    targetRepo = targetDir;
    targetDir = null;
  }

  // If both are set, prefer the explicit path (targetDir) and drop the nickname.
  if (targetRepo && targetDir) targetRepo = null;

  const prompt = typeof obj.prompt === "string" ? obj.prompt : "";

  if (!prompt.trim()) return null;

  return { mode, direction, targetRepo, targetDir, prompt };
}

/** Resolution result for a repo nickname lookup against the filesystem. */
export type RepoResolution =
  | { kind: "found"; dir: string }
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: string[] };

const DEFAULT_REPO_ROOT = path.join(homedir(), "src/github.com");

/**
 * Resolve a bare repo nickname to an absolute path by globbing
 * `~/src/github.com/<any-org>/<nickname>`. The filesystem is the source of
 * truth — we don't guess orgs, and we never invent paths.
 *
 *   1 match  → use it (no prompt; the FS confirmed it exists).
 *   0 matches → user-visible error; nothing spawns.
 *   2+ matches → caller should disambiguate via ctx.ui.select.
 */
export async function resolveRepoNickname(nickname: string, root: string = DEFAULT_REPO_ROOT): Promise<RepoResolution> {
  if (!nickname) return { kind: "none" };
  // Single path segment only — don't accept "org/repo" or path traversal here.
  if (nickname.includes("/") || nickname.includes(path.sep) || nickname.includes("..")) {
    return { kind: "none" };
  }

  let orgs: string[];
  try {
    orgs = await fsp.readdir(root);
  } catch {
    return { kind: "none" };
  }

  const matches: string[] = [];
  await Promise.all(
    orgs.map(async (org) => {
      const candidate = path.join(root, org, nickname);
      try {
        const stat = await fsp.stat(candidate);
        if (stat.isDirectory()) matches.push(candidate);
      } catch {
        // not a directory; skip
      }
    }),
  );

  matches.sort();
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "found", dir: matches[0] };
  return { kind: "ambiguous", candidates: matches };
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

/** Anchors captured synchronously at command entry to defeat focus races. */
export interface GhosttyAnchor {
  /** Stable id of the front Ghostty window when /handoff was invoked. "" if none. */
  windowId: string;
  /** Stable id of the focused terminal surface within that window. "" if unavailable. */
  terminalId: string;
}

/** Result of a delegated spawn attempt. */
export interface SpawnResult {
  /** True when osascript exited cleanly. */
  ok: boolean;
  /** Non-empty stderr from osascript (warnings or error text). */
  stderr: string;
  /** Error message if osascript failed to run or exited non-zero. */
  error?: string;
}

export interface HandoffSpawnDeps {
  /** Synchronously capture Ghostty anchors (window + focused terminal) at command entry. */
  captureAnchor?: () => GhosttyAnchor;
  /** Spawn a delegated Ghostty pane/tab/window. Awaited so failures surface to the user. */
  spawnDelegated?: (args: SpawnDelegatedArgs) => Promise<SpawnResult>;
  /** Write the task file to a temp location and return its absolute path. */
  writeTaskFile?: (prompt: string) => string;
  /** Resolve a bare repo nickname against the filesystem. */
  resolveRepo?: (nickname: string) => Promise<RepoResolution>;
}

export interface SpawnDelegatedArgs {
  mode: Exclude<HandoffMode, "in-process">;
  direction: SplitDirection | null;
  targetDir: string | null;
  taskFile: string;
  anchor: GhosttyAnchor;
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

function defaultCaptureAnchor(scriptDir: string): GhosttyAnchor {
  if (process.platform !== "darwin") return { windowId: "", terminalId: "" };
  try {
    const out = execFileSync("osascript", [path.join(scriptDir, "ghostty-current-anchor.applescript")], {
      encoding: "utf8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const [windowId = "", terminalId = ""] = out.split(/\r?\n/).map((line) => line.trim());
    return { windowId, terminalId };
  } catch {
    return { windowId: "", terminalId: "" };
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

async function defaultSpawnDelegated(args: SpawnDelegatedArgs): Promise<SpawnResult> {
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

  // Race-anchoring: strictest available signal per mode.
  //   pane mode  → terminal id (split the exact surface) + window id fallback.
  //   tab mode   → window id (which window gets the new tab).
  //   window mode→ nothing; new windows are unambiguous.
  if (args.mode === "pane" && args.anchor.terminalId) {
    cliArgs.push("--terminal-id", args.anchor.terminalId);
  }
  if (args.mode !== "window" && args.anchor.windowId) {
    cliArgs.push("--window-id", args.anchor.windowId);
  }

  try {
    const { stderr } = await execFileAsync("osascript", cliArgs, { timeout: 5000 });
    return { ok: true, stderr: stderr.trim() };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string };
    return {
      ok: false,
      stderr: (e.stderr ?? "").trim(),
      error: e.message || String(err),
    };
  }
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
  const captureAnchor = deps.captureAnchor ?? (() => defaultCaptureAnchor(scriptDir));
  const writeTaskFile = deps.writeTaskFile ?? defaultWriteTaskFile;
  const spawnDelegated = deps.spawnDelegated ?? defaultSpawnDelegated;
  const resolveRepo = deps.resolveRepo ?? ((nickname: string) => resolveRepoNickname(nickname));

  const makeHandler =
    (defaultMode: HandoffMode) =>
    async (args: string, ctx: Parameters<Parameters<ExtensionAPI["registerCommand"]>[1]["handler"]>[1]) => {
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

      // RACE FIX: capture stable Ghostty anchors (front window id + focused
      // terminal id) synchronously, before any awaitable work. A later pane
      // spawn can then split the exact terminal surface the user invoked from,
      // regardless of where focus is when osascript actually runs. Tab spawn
      // can still target the captured window. Cheap (~50ms osascript) and
      // silent on failure (empty anchor — spawn falls back gracefully to
      // front window / new window).
      const capturedAnchor = captureAnchor();

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

      const systemPrompt = buildSystemPrompt(defaultMode);

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
            { systemPrompt, messages: [userMessage] },
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

      const intent = parseHandoffIntent(result, defaultMode);
      if (!intent) {
        ctx.ui.notify(
          `Could not parse handoff intent from model. Raw output:\n${truncateForNotification(result, 600)}`,
          "error",
        );
        return;
      }

      // Resolve the target directory.
      //   - intent.targetDir: explicit path from the user, used verbatim (tilde-expanded).
      //   - intent.targetRepo: a bare nickname; resolved against the filesystem by
      //     globbing ~/src/github.com/*/<nickname>. One hit = use it; zero hits = error;
      //     multiple hits = prompt the user to pick. No prompt in the unambiguous cases.
      //   - neither: spawn inherits current cwd; no prompt.
      let resolvedTargetDir: string | null = null;
      if (intent.targetDir) {
        resolvedTargetDir = expandTilde(intent.targetDir);
      } else if (intent.targetRepo) {
        const resolution = await resolveRepo(intent.targetRepo);
        if (resolution.kind === "none") {
          ctx.ui.notify(
            `No repo matching "${intent.targetRepo}" found under ~/src/github.com/*/${intent.targetRepo}.`,
            "error",
          );
          return;
        }
        if (resolution.kind === "ambiguous") {
          const choice = await ctx.ui.select(
            `Multiple repos match "${intent.targetRepo}". Pick one:`,
            resolution.candidates,
          );
          if (choice === undefined) {
            ctx.ui.notify("Cancelled", "info");
            return;
          }
          resolvedTargetDir = choice;
        } else {
          resolvedTargetDir = resolution.dir;
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

      // Delegated spawn into a new Ghostty pane/tab/window. We await this so
      // failures (osascript missing, Ghostty not running, scripting permission
      // denied, etc.) surface honestly to the user instead of silently
      // claiming success. The osascript call itself is fast (~100-300ms),
      // invisible after the multi-second LLM call we just did.
      const taskFile = writeTaskFile(editedPrompt);
      const spawnResult = await spawnDelegated({
        mode: intent.mode,
        direction: intent.direction,
        targetDir: resolvedTargetDir,
        taskFile,
        anchor: capturedAnchor,
        scriptDir,
      });

      const where =
        intent.mode === "pane" ? `new pane (${intent.direction})` : intent.mode === "tab" ? "new tab" : "new window";
      const inDir = resolvedTargetDir ? ` in ${resolvedTargetDir}` : "";

      if (!spawnResult.ok) {
        const detail = spawnResult.stderr || spawnResult.error || "unknown error";
        ctx.ui.notify(
          `Delegation to ${where}${inDir} failed: ${truncateForNotification(detail, 600)}\nPrompt saved at: ${taskFile}`,
          "error",
        );
        return;
      }

      if (spawnResult.stderr) {
        ctx.ui.notify(
          `Delegated to ${where}${inDir} (warnings: ${truncateForNotification(spawnResult.stderr, 400)}).`,
          "warning",
        );
      } else {
        ctx.ui.notify(`Delegated to ${where}${inDir}.`, "info");
      }
    };

  pi.registerCommand("handoff", {
    description:
      "Transfer context to a new focused session here (default replaces current session; ask for a pane/tab/window/repo in natural language to fork instead)",
    handler: makeHandler("in-process"),
  });

  pi.registerCommand("delegate", {
    description:
      "Spawn a parallel pi session in a new Ghostty pane/tab/window or another repo. Current session continues.",
    handler: makeHandler("pane"),
  });
}

export default function (pi: ExtensionAPI) {
  createHandoffExtension(pi);
}
