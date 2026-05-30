/**
 * Handoff Extension — transfer context to a new focused session.
 *
 * Instead of compacting (which is lossy), handoff extracts what matters
 * for your next task and creates a new session with a generated prompt.
 *
 * Usage:
 *   /handoff now implement this for teams as well
 *   /handoff execute phase one of the plan
 *   /handoff check other places that need this fix
 *
 * The generated prompt appears as a draft in the editor for review/editing.
 *
 * Adapted from Pi's official handoff example:
 * https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/handoff.ts
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { complete, type AssistantMessage, type UserMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, SessionEntry } from "@mariozechner/pi-coding-agent";
import { BorderedLoader, convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";

export const SYSTEM_PROMPT = `You are a context transfer assistant. Given a conversation history and the user's goal for a new thread, generate a focused prompt that:

1. Summarizes relevant context from the conversation (decisions made, approaches taken, key findings)
2. Lists any relevant files that were discussed or modified
3. Clearly states the next task based on the user's goal
4. Is self-contained - the new thread should be able to proceed without the old conversation

Format your response as a prompt the user can send to start the new thread. Be concise but include all necessary context. Do not include any preamble like "Here's the prompt" - just output the prompt itself.

Example output format:
## Context
We've been working on X. Key decisions:
- Decision 1
- Decision 2

Files involved:
- path/to/file1.ts
- path/to/file2.ts

## Task
[Clear description of what to do next based on user's goal]`;

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

type HandoffLoader = {
  signal?: AbortSignal;
  onAbort?: () => void;
};

interface HandoffDependencies {
  complete?: typeof complete;
  convertToLlm?: typeof convertToLlm;
  serializeConversation?: typeof serializeConversation;
  createLoader?: (tui: unknown, theme: unknown, message: string) => HandoffLoader;
  now?: () => number;
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

  pi.registerCommand("handoff", {
    description: "Transfer context to a new focused session",
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

      // Generate the handoff prompt with loader UI.
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
                text: `## Conversation History\n\n${conversationText}\n\n## User's Goal for New Thread\n\n${goal}`,
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

          const prompt = response.content
            .filter((content): content is { type: "text"; text: string } => content.type === "text")
            .map((content) => content.text)
            .join("\n");

          if (!prompt.trim()) {
            throw new Error(`Handoff generation returned no text: ${responseDiagnostics(response)}`);
          }

          return prompt;
        };

        doGenerate()
          .then(done)
          .catch((error) => {
            generationError = error?.message || String(error);
            done(null);
          });

        return loader as any;
      });

      if (result === null) {
        ctx.ui.notify(generationError ?? "Cancelled", generationError ? "error" : "info");
        return;
      }

      if (!result.trim()) {
        ctx.ui.notify("Generated handoff prompt was empty", "error");
        return;
      }

      // Let the user review/edit the generated prompt before starting the new session.
      const editedPrompt = await ctx.ui.editor("Edit handoff prompt", result);
      if (editedPrompt === undefined) {
        ctx.ui.notify("Cancelled", "info");
        return;
      }

      // Create new session with parent tracking. Use the replacement-session
      // context for post-switch UI work; the original ctx is stale after a
      // successful session replacement.
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
    },
  });
}

export default function (pi: ExtensionAPI) {
  createHandoffExtension(pi);
}
