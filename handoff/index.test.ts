import assert from "node:assert/strict";
import test from "node:test";
import {
  createHandoffExtension,
  expandTilde,
  getHandoffMessages,
  parseHandoffIntent,
  responseDiagnostics,
} from "./index.ts";

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
type SpawnCall = {
  mode: string;
  direction: string | null;
  targetDir: string | null;
  taskFile: string;
  windowId: string;
  scriptDir: string;
};
type ConfirmCall = { title: string; message: string };
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
    confirm(title: string, message: string): Promise<boolean>;
  };
  newSession(options: NewSessionOptions): Promise<{ cancelled: boolean }>;
  testState: {
    branch: ReturnType<typeof messageEntry>[];
    notifications: Notification[];
    editorInput: { title: string; text: string } | undefined;
    newSessionOptions: NewSessionOptions | undefined;
    stagedPrompt: string | undefined;
    waitedForIdle: boolean;
    confirmCalls: ConfirmCall[];
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
  const commands = new Map<string, Command>();
  const pi = {
    registerCommand(name: string, options: unknown) {
      commands.set(name, { name, ...(options as Omit<Command, "name">) });
    },
  };

  createHandoffExtension(pi as Parameters<typeof createHandoffExtension>[0], {
    convertToLlm: (messages: unknown) => messages as ReturnType<ConvertToLlm>,
    serializeConversation: () => "serialized conversation",
    createLoader: () => ({ signal: new AbortController().signal }),
    now: () => 1234567890,
    captureWindowId: () => "12345",
    writeTaskFile: (prompt: string) => `/tmp/pi-handoff-test/${Buffer.byteLength(prompt)}.md`,
    spawnDelegated: () => {},
    scriptDir: "/fake/scripts",
    ...(deps as Partial<HandoffDeps>),
  });

  assert.ok(commands.has("handoff"), "handoff command should be registered");
  assert.ok(commands.has("delegate"), "delegate command should be registered");

  return {
    commands,
    async run(args: string, ctx = createContext(), commandName = "handoff") {
      const cmd = commands.get(commandName);
      assert.ok(cmd, `${commandName} command not registered`);
      await cmd.handler(args, ctx);
      return ctx;
    },
  };
}

function jsonIntent(
  overrides: Partial<{ mode: string; direction: string | null; targetDir: string | null; prompt: string }> = {},
) {
  const obj = {
    mode: "in-process",
    direction: null,
    targetDir: null,
    prompt: "generated prompt",
    ...overrides,
  };
  return JSON.stringify(obj);
}

function createContext(overrides: Record<string, unknown> = {}) {
  const notifications: Notification[] = [];
  const branch = [messageEntry("m1", "user", "hello")];
  let editorInput: { title: string; text: string } | undefined;
  let newSessionOptions: NewSessionOptions | undefined;
  let stagedPrompt: string | undefined;
  let waitedForIdle = false;
  const confirmCalls: ConfirmCall[] = [];
  const confirmAnswer = (overrides.confirmAnswer as boolean | undefined) ?? true;

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
      async confirm(title: string, message: string) {
        confirmCalls.push({ title, message });
        return confirmAnswer;
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
      confirmCalls,
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

test("parseHandoffIntent accepts a bare JSON object", () => {
  const intent = parseHandoffIntent('{"mode":"in-process","direction":null,"targetDir":null,"prompt":"go"}');
  assert.deepEqual(intent, { mode: "in-process", direction: null, targetDir: null, prompt: "go" });
});

test("parseHandoffIntent tolerates a ```json fence", () => {
  const intent = parseHandoffIntent('```json\n{"mode":"pane","direction":"right","targetDir":null,"prompt":"go"}\n```');
  assert.deepEqual(intent, { mode: "pane", direction: "right", targetDir: null, prompt: "go" });
});

test("parseHandoffIntent defaults split direction to right when missing for pane mode", () => {
  const intent = parseHandoffIntent('{"mode":"pane","direction":null,"targetDir":"~/x","prompt":"go"}');
  assert.deepEqual(intent, { mode: "pane", direction: "right", targetDir: "~/x", prompt: "go" });
});

test("parseHandoffIntent clears direction for non-pane modes", () => {
  const intent = parseHandoffIntent('{"mode":"tab","direction":"left","targetDir":null,"prompt":"go"}');
  assert.equal(intent?.direction, null);
});

test("parseHandoffIntent falls back to defaultMode for unknown modes", () => {
  assert.equal(
    parseHandoffIntent('{"mode":"wat","direction":null,"targetDir":null,"prompt":"go"}')?.mode,
    "in-process",
  );
  assert.equal(
    parseHandoffIntent('{"mode":"wat","direction":null,"targetDir":null,"prompt":"go"}', "pane")?.mode,
    "pane",
  );
});

test("parseHandoffIntent returns null on missing prompt", () => {
  assert.equal(parseHandoffIntent('{"mode":"in-process","prompt":""}'), null);
});

test("parseHandoffIntent returns null on non-JSON input", () => {
  assert.equal(parseHandoffIntent("definitely not JSON"), null);
});

test("expandTilde resolves ~ and ~/sub", () => {
  assert.equal(expandTilde("~", "/home/sam"), "/home/sam");
  assert.equal(expandTilde("~/src/edgey", "/home/sam"), "/home/sam/src/edgey");
  assert.equal(expandTilde("/abs/path", "/home/sam"), "/abs/path");
  assert.equal(expandTilde("relative", "/home/sam"), "relative");
});

test("handoff generates a prompt, opens the editor, and stages the edited prompt in a new session (in-process)", async () => {
  const completeCalls: Array<{ request: unknown; options: { apiKey?: string } }> = [];
  const harness = createHarness({
    complete: async (_model: unknown, request: unknown, options: unknown) => {
      completeCalls.push({ request, options: options as { apiKey?: string } });
      return {
        stopReason: "end_turn",
        content: [{ type: "text", text: jsonIntent({ prompt: "generated prompt" }) }],
      };
    },
  });

  const ctx = await harness.run("continue the work");

  assert.equal(ctx.testState.waitedForIdle, true);
  assert.equal(completeCalls.length, 1);
  assert.equal(completeCalls[0].options.apiKey, "test-key");
  assert.equal(ctx.testState.editorInput.title, "Edit handoff prompt");
  assert.equal(ctx.testState.editorInput.text, "generated prompt");
  // No confirm for in-process mode.
  assert.equal(ctx.testState.confirmCalls.length, 0);
  assert.equal(ctx.testState.newSessionOptions.parentSession, "/tmp/session.json");
  assert.equal(ctx.testState.stagedPrompt, "edited prompt");
  assert.deepEqual(ctx.testState.notifications.at(-1), {
    message: "Handoff ready. Submit when ready.",
    level: "info",
  });
});

test("handoff delegates to a new pane when the model selects pane mode, after user confirms", async () => {
  const spawnCalls: SpawnCall[] = [];
  const captured: string[] = [];
  const harness = createHarness({
    complete: async () => ({
      stopReason: "end_turn",
      content: [
        {
          type: "text",
          text: jsonIntent({
            mode: "pane",
            direction: "right",
            targetDir: "~/src/github.com/Shopify/edgey",
            prompt: "do the thing",
          }),
        },
      ],
    }),
    captureWindowId: () => {
      captured.push("captured");
      return "9999";
    },
    spawnDelegated: (args: SpawnCall) => {
      spawnCalls.push(args);
    },
    writeTaskFile: (prompt: string) => `/tmp/task-${prompt.length}.md`,
    scriptDir: "/fake/scripts",
  });

  const ctx = await harness.run("in edgey, finish the migration");

  // Window id captured exactly once, synchronously at command entry (before LLM call).
  assert.deepEqual(captured, ["captured"]);

  // User confirmation was shown with the resolved path.
  assert.equal(ctx.testState.confirmCalls.length, 1);
  assert.match(ctx.testState.confirmCalls[0].message, /pane \(right\)/);
  assert.match(ctx.testState.confirmCalls[0].message, /\/src\/github\.com\/Shopify\/edgey/);

  // Editor was opened with the generated prompt.
  assert.equal(ctx.testState.editorInput.text, "do the thing");

  // Spawn was invoked with edited prompt resolved into a task file.
  assert.equal(spawnCalls.length, 1);
  const spawn = spawnCalls[0];
  assert.equal(spawn.mode, "pane");
  assert.equal(spawn.direction, "right");
  assert.match(spawn.targetDir ?? "", /\/src\/github\.com\/Shopify\/edgey$/);
  assert.equal(spawn.windowId, "9999");
  assert.equal(spawn.scriptDir, "/fake/scripts");
  assert.match(spawn.taskFile, /^\/tmp\/task-\d+\.md$/);

  // No in-process session replacement.
  assert.equal(ctx.testState.newSessionOptions, undefined);

  assert.match(ctx.testState.notifications.at(-1)?.message ?? "", /Delegated to new pane \(right\)/);
});

test("handoff cancels delegation when user declines confirm", async () => {
  const spawnCalls: SpawnCall[] = [];
  const harness = createHarness({
    complete: async () => ({
      stopReason: "end_turn",
      content: [{ type: "text", text: jsonIntent({ mode: "tab", direction: null, targetDir: "~/x", prompt: "go" }) }],
    }),
    spawnDelegated: (args: SpawnCall) => {
      spawnCalls.push(args);
    },
  });

  const ctx = await harness.run("delegate to ~/x in a new tab", createContext({ confirmAnswer: false }));

  assert.equal(ctx.testState.confirmCalls.length, 1);
  assert.equal(spawnCalls.length, 0);
  assert.equal(ctx.testState.editorInput, undefined);
  assert.deepEqual(ctx.testState.notifications.at(-1), { message: "Cancelled", level: "info" });
});

test("/delegate defaults to pane mode when the model omits a mode", async () => {
  const spawnCalls: SpawnCall[] = [];
  const harness = createHarness({
    complete: async () => ({
      stopReason: "end_turn",
      // Model returns an unknown mode — parser should fall back to the command's default (pane for /delegate).
      content: [{ type: "text", text: '{"mode":"wat","direction":"right","targetDir":null,"prompt":"go"}' }],
    }),
    spawnDelegated: (args: SpawnCall) => {
      spawnCalls.push(args);
    },
  });

  const ctx = await harness.run("finish the migration", createContext(), "delegate");

  // Confirm was shown (we're spawning) and spawn happened in pane mode.
  assert.equal(ctx.testState.confirmCalls.length, 1);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].mode, "pane");
});

test("handoff reports a parse error if the model returns unparseable output", async () => {
  const harness = createHarness({
    complete: async () => ({
      stopReason: "end_turn",
      content: [{ type: "text", text: "not json at all" }],
    }),
  });

  const ctx = await harness.run("continue the work");

  assert.equal(ctx.testState.notifications.length, 1);
  assert.equal(ctx.testState.notifications[0].level, "error");
  assert.match(ctx.testState.notifications[0].message, /Could not parse handoff intent/);
  assert.equal(ctx.testState.editorInput, undefined);
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
