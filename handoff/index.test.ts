import assert from "node:assert/strict";
import test from "node:test";
import { createHandoffExtension, getHandoffMessages, responseDiagnostics } from "./index.ts";

const timestamp = "2026-01-01T00:00:00.000Z";

type HandoffDeps = NonNullable<Parameters<typeof createHandoffExtension>[1]>;
type ConvertToLlm = NonNullable<HandoffDeps["convertToLlm"]>;
type Notification = { message: string; level: string };
type Command = { name: string; handler: (args: string, ctx: TestContext) => Promise<void> };
type ReplacementContext = {
  ui: {
    setEditorText(text: string): void;
    notify(message: string, level: string): void;
  };
};
type NewSessionOptions = {
  parentSession?: string;
  withSession(ctx: ReplacementContext): void | Promise<void>;
};
type CustomRenderer = (tui: unknown, theme: unknown, keybindings: unknown, done: (value: unknown) => void) => unknown;
type TestContext = {
  hasUI: boolean;
  model?: { provider: string; id: string };
  modelRegistry: { getApiKeyAndHeaders(): Promise<Record<string, unknown>> };
  sessionManager: { getBranch(): ReturnType<typeof messageEntry>[]; getSessionFile(): string };
  waitForIdle(): Promise<void>;
  ui: {
    notify(message: string, level: string): void;
    custom(render: CustomRenderer): Promise<unknown>;
    editor(title: string, text: string): Promise<string | undefined>;
  };
  newSession(options: NewSessionOptions): Promise<{ cancelled: boolean }>;
  testState: {
    branch: ReturnType<typeof messageEntry>[];
    notifications: Notification[];
    editorInput: { title: string; text: string } | undefined;
    newSessionOptions: NewSessionOptions | undefined;
    stagedPrompt: string | undefined;
    waitedForIdle: boolean;
  };
} & Record<string, unknown>;

function messageEntry(id: string, role: "user" | "assistant", text: string) {
  return {
    id,
    type: "message",
    timestamp,
    message: {
      role,
      content: [{ type: "text", text }],
      timestamp: new Date(timestamp).getTime(),
    },
  };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createHarness(deps: Record<string, unknown> = {}) {
  let command: Command | undefined;
  const pi = {
    registerCommand(name: string, options: unknown) {
      command = { name, ...(options as Omit<Command, "name">) };
    },
  };

  createHandoffExtension(pi as Parameters<typeof createHandoffExtension>[0], {
    convertToLlm: (messages: unknown) => messages as ReturnType<ConvertToLlm>,
    serializeConversation: () => "serialized conversation",
    createLoader: () => ({ signal: new AbortController().signal }),
    now: () => 1234567890,
    ...(deps as Partial<HandoffDeps>),
  });

  assert.ok(command, "handoff command should be registered");
  assert.equal(command.name, "handoff");
  const registeredCommand = command;

  return {
    async run(args: string, ctx = createContext()) {
      await registeredCommand.handler(args, ctx);
      return ctx;
    },
  };
}

function createContext(overrides: Record<string, unknown> = {}) {
  const notifications: Notification[] = [];
  const branch = [messageEntry("m1", "user", "hello")];
  let editorInput: { title: string; text: string } | undefined;
  let newSessionOptions: NewSessionOptions | undefined;
  let stagedPrompt: string | undefined;
  let waitedForIdle = false;

  const ctx: TestContext = {
    hasUI: true,
    model: { provider: "test-provider", id: "test-model" },
    modelRegistry: {
      getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test-key", headers: { authorization: "Bearer test" } }),
    },
    sessionManager: {
      getBranch: () => branch,
      getSessionFile: () => "/tmp/session.json",
    },
    async waitForIdle() {
      waitedForIdle = true;
    },
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
      async custom(render: CustomRenderer) {
        let doneCalled = false;
        let value: unknown;
        render({}, {}, {}, (nextValue: unknown) => {
          doneCalled = true;
          value = nextValue;
        });

        for (let i = 0; i < 10 && !doneCalled; i++) {
          await flush();
        }

        assert.equal(doneCalled, true, "custom UI did not complete");
        return value;
      },
      async editor(title: string, text: string) {
        editorInput = { title, text };
        return "edited prompt";
      },
    },
    async newSession(options: NewSessionOptions) {
      newSessionOptions = options;
      await options.withSession({
        ui: {
          setEditorText(text: string) {
            stagedPrompt = text;
          },
          notify(message: string, level: string) {
            notifications.push({ message, level });
          },
        },
      });
      return { cancelled: false };
    },
    testState: {
      branch,
      notifications,
      get editorInput() {
        return editorInput;
      },
      get newSessionOptions() {
        return newSessionOptions;
      },
      get stagedPrompt() {
        return stagedPrompt;
      },
      get waitedForIdle() {
        return waitedForIdle;
      },
    },
  };

  Object.assign(ctx, overrides);
  return ctx;
}

test("getHandoffMessages keeps latest compaction and entries from firstKeptEntryId", () => {
  const messages = getHandoffMessages([
    messageEntry("old", "user", "old context"),
    messageEntry("kept", "assistant", "kept context"),
    {
      id: "compact",
      type: "compaction",
      timestamp,
      summary: "summary text",
      tokensBefore: 123,
      firstKeptEntryId: "kept",
    },
    messageEntry("new", "user", "new context"),
  ] as unknown as Parameters<typeof getHandoffMessages>[0]);

  assert.deepEqual(
    messages.map((message) => message.role),
    ["compactionSummary", "assistant", "user"],
  );
  const firstMessage = messages[0];
  assert.equal(firstMessage.role, "compactionSummary");
  assert.equal(firstMessage.summary, "summary text");
});

test("responseDiagnostics includes stop reason, content types, error message, and diagnostics", () => {
  const diagnostics = responseDiagnostics({
    stopReason: "error",
    content: [],
    errorMessage: "provider returned 401",
    diagnostics: [{ type: "provider_error", error: { message: "bad credentials" } }],
  } as unknown as Parameters<typeof responseDiagnostics>[0]);

  assert.match(diagnostics, /stopReason=error/);
  assert.match(diagnostics, /contentTypes=none/);
  assert.match(diagnostics, /provider returned 401/);
  assert.match(diagnostics, /bad credentials/);
});

test("handoff generates a prompt, opens the editor, and stages the edited prompt in a new session", async () => {
  const completeCalls: Array<{ request: unknown; options: { apiKey?: string } }> = [];
  const harness = createHarness({
    complete: async (_model: unknown, request: unknown, options: unknown) => {
      completeCalls.push({ request, options: options as { apiKey?: string } });
      return {
        stopReason: "end_turn",
        content: [{ type: "text", text: "generated prompt" }],
      };
    },
  });

  const ctx = await harness.run("continue the work");

  assert.equal(ctx.testState.waitedForIdle, true);
  assert.equal(completeCalls.length, 1);
  assert.equal(completeCalls[0].options.apiKey, "test-key");
  assert.equal(ctx.testState.editorInput.title, "Edit handoff prompt");
  assert.equal(ctx.testState.editorInput.text, "generated prompt");
  assert.equal(ctx.testState.newSessionOptions.parentSession, "/tmp/session.json");
  assert.equal(ctx.testState.stagedPrompt, "edited prompt");
  assert.deepEqual(ctx.testState.notifications.at(-1), {
    message: "Handoff ready. Submit when ready.",
    level: "info",
  });
});

test("handoff surfaces model authentication failures", async () => {
  const ctx = createContext({
    modelRegistry: {
      getApiKeyAndHeaders: async () => ({ ok: false, error: "bad auth" }),
    },
  });
  const harness = createHarness();

  await harness.run("continue the work", ctx);

  assert.deepEqual(ctx.testState.notifications, [{ message: "bad auth", level: "error" }]);
  assert.equal(ctx.testState.editorInput, undefined);
  assert.equal(ctx.testState.newSessionOptions, undefined);
});

test("handoff surfaces provider error diagnostics from the completion response", async () => {
  const harness = createHarness({
    complete: async () => ({
      stopReason: "error",
      content: [],
      errorMessage: "OpenAI 401",
      diagnostics: [{ type: "provider_error", error: { message: "proxy auth failed" } }],
    }),
  });

  const ctx = await harness.run("continue the work");

  assert.equal(ctx.testState.notifications.length, 1);
  assert.equal(ctx.testState.notifications[0].level, "error");
  assert.match(ctx.testState.notifications[0].message, /Handoff generation failed/);
  assert.match(ctx.testState.notifications[0].message, /stopReason=error/);
  assert.match(ctx.testState.notifications[0].message, /OpenAI 401/);
  assert.match(ctx.testState.notifications[0].message, /proxy auth failed/);
  assert.equal(ctx.testState.editorInput, undefined);
});

test("handoff reports diagnostics when generation returns no text", async () => {
  const harness = createHarness({
    complete: async () => ({
      stopReason: "end_turn",
      content: [],
      diagnostics: [{ type: "empty_response" }],
    }),
  });

  const ctx = await harness.run("continue the work");

  assert.equal(ctx.testState.notifications.length, 1);
  assert.equal(ctx.testState.notifications[0].level, "error");
  assert.match(ctx.testState.notifications[0].message, /Handoff generation returned no text/);
  assert.match(ctx.testState.notifications[0].message, /contentTypes=none/);
  assert.match(ctx.testState.notifications[0].message, /empty_response/);
  assert.equal(ctx.testState.editorInput, undefined);
});
