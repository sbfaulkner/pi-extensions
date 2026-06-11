/**
 * Link Extension — create Slack-pastable GitHub PR link lines.
 *
 * The old /link prompt template asked the agent to improvise gh, HTML, and
 * AppleScript escaping each time. This command keeps the deterministic pieces
 * in TypeScript so they are testable and do not consume an agent turn.
 */

import { execFile } from "node:child_process";
import type { ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Box, Text } from "@mariozechner/pi-tui";

const execFileAsync = promisify(execFile);

const CUSTOM_TYPE = "link/result";
const GH_FIELDS = "number,title,url,additions,deletions";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface PullRequestMetadata {
  number: number;
  title: string;
  url: string;
  additions: number;
  deletions: number;
}

export interface LinkDependencies {
  viewPullRequest?: (cwd: string, ref: string | null) => Promise<PullRequestMetadata>;
  copyToClipboard?: (plain: string, html: string) => Promise<void>;
  env?: NodeJS.ProcessEnv;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function execFileUtf8(
  file: string,
  args: string[],
  options: ExecFileOptions & { encoding: BufferEncoding },
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(file, args, options) as Promise<{ stdout: string; stderr: string }>;
}

function requireNumber(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`gh returned an invalid ${key} field`);
  }
  return value;
}

function requireString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string") {
    throw new Error(`gh returned an invalid ${key} field`);
  }
  return value;
}

function parsePullRequestMetadata(raw: unknown): PullRequestMetadata {
  if (!isRecord(raw)) throw new Error("gh returned non-object JSON");

  return {
    number: requireNumber(raw, "number"),
    title: requireString(raw, "title"),
    url: requireString(raw, "url"),
    additions: requireNumber(raw, "additions"),
    deletions: requireNumber(raw, "deletions"),
  };
}

export async function defaultViewPullRequest(cwd: string, ref: string | null): Promise<PullRequestMetadata> {
  const args = ["pr", "view"];
  if (ref) args.push(ref);
  args.push("--json", GH_FIELDS);

  const { stdout } = await execFileUtf8("gh", args, {
    cwd,
    encoding: "utf8",
    timeout: DEFAULT_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });

  return parsePullRequestMetadata(JSON.parse(stdout));
}

export function parseRefs(args: string): string[] {
  return args.trim().split(/\s+/).filter(Boolean);
}

export function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatPlainLine(pr: PullRequestMetadata): string {
  return `👀 [#${pr.number} ${pr.title}](${pr.url}) \`+${pr.additions}/-${pr.deletions}\``;
}

export function formatHtmlLine(pr: PullRequestMetadata): string {
  return `👀 <a href="${htmlEscape(pr.url)}">#${pr.number} ${htmlEscape(pr.title)}</a> <code>+${pr.additions}/-${pr.deletions}</code>`;
}

export function formatLinkOutput(prs: PullRequestMetadata[]): { plain: string; html: string } {
  return {
    plain: prs.map(formatPlainLine).join("\n"),
    html: `<meta charset="utf-8">${prs.map(formatHtmlLine).join("<br>")}`,
  };
}

export function buildOsascriptClipboardArgs(plain: string, html: string): string[] {
  const hex = Buffer.from(html, "utf8").toString("hex");
  return [
    "-e",
    "on run argv",
    "-e",
    "set plainText to item 1 of argv",
    "-e",
    `set the clipboard to {string:plainText, «class HTML»:«data HTML${hex}»}`,
    "-e",
    "end run",
    plain,
  ];
}

export async function copyRichTextToClipboard(plain: string, html: string): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("rich clipboard copy currently requires macOS");
  }

  await execFileUtf8("osascript", buildOsascriptClipboardArgs(plain, html), {
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}

function resolveError(ref: string | null, error: unknown): string {
  const target = ref ? `"${ref}"` : "the current branch's PR";
  const detail = errorMessage(error).trim();
  const suffix = detail ? ` (${detail})` : "";
  return `Could not resolve ${target}. /link currently supports GitHub PRs only.${suffix}`;
}

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: string; text?: string } => typeof part === "object" && part !== null)
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n");
  }
  return "";
}

function clipboardSkipped(env: NodeJS.ProcessEnv): boolean {
  const value = env.LINK_SKIP_CLIPBOARD;
  return value !== undefined && value !== "" && value !== "0" && value.toLowerCase() !== "false";
}

export function createLinkExtension(pi: ExtensionAPI, deps: LinkDependencies = {}) {
  const viewPullRequest = deps.viewPullRequest ?? defaultViewPullRequest;
  const copyToClipboard = deps.copyToClipboard ?? copyRichTextToClipboard;
  const env = deps.env ?? process.env;

  pi.registerMessageRenderer(CUSTOM_TYPE, (message, _opts, theme) => {
    const body = messageContentToString(message.content);
    const box = new Box(1, 1, (t) => theme.bg("customMessageBg", t));
    box.addChild(new Text(body, 0, 0));
    return box;
  });

  pi.registerCommand("link", {
    description:
      "Create Slack-pastable GitHub PR links and copy rich + plain text (usage: /link [PR number/URL/branch ...])",
    handler: async (args, ctx) => {
      const refs = parseRefs(args);
      const targets = refs.length > 0 ? refs : [null];

      const prs: PullRequestMetadata[] = [];
      for (const ref of targets) {
        try {
          prs.push(await viewPullRequest(ctx.cwd, ref));
        } catch (error) {
          ctx.ui.notify(resolveError(ref, error), "error");
          return;
        }
      }

      const output = formatLinkOutput(prs);

      pi.sendMessage(
        {
          customType: CUSTOM_TYPE,
          content: output.plain,
          display: true,
          details: { pullRequests: prs },
        },
        { triggerTurn: false },
      );

      if (clipboardSkipped(env)) {
        ctx.ui.notify("Link generated; clipboard skipped via LINK_SKIP_CLIPBOARD.", "info");
        return;
      }

      try {
        await copyToClipboard(output.plain, output.html);
        ctx.ui.notify(
          prs.length === 1 ? "Link copied to clipboard." : `${prs.length} links copied to clipboard.`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(`Link generated, but clipboard copy failed: ${errorMessage(error)}`, "error");
      }
    },
  });
}

export default function (pi: ExtensionAPI) {
  createLinkExtension(pi);
}
