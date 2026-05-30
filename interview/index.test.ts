import assert from "node:assert/strict";
import test from "node:test";
import interviewExtension, { findLastAssistantText, parseExtractionResult } from "./index.ts";

type Notification = { message: string; level: string };
type Command = { name: string; handler: (args: string, ctx: unknown) => Promise<void> };
type TestContext = {
  hasUI: boolean;
  model?: { provider: string; id: string };
  sessionManager: { getBranch: () => unknown[] };
  ui: { notify(message: string, level: string): void };
  testState: { notifications: Notification[] };
} & Record<string, unknown>;

function messageEntry(role: string, content: unknown[]) {
  return {
    type: "message",
    message: {
      role,
      content,
    },
  };
}

function createHarness() {
  let command: Command | undefined;
  const pi = {
    registerCommand(name: string, options: unknown) {
      command = { name, ...(options as Omit<Command, "name">) };
    },
  };

  interviewExtension(pi as Parameters<typeof interviewExtension>[0]);
  assert.ok(command, "answer command should be registered");
  assert.equal(command.name, "answer");
  const registeredCommand = command;

  return {
    async run(ctx = createContext()) {
      await registeredCommand.handler("", ctx);
      return ctx;
    },
  };
}

function createContext(overrides: Record<string, unknown> = {}) {
  const notifications: Notification[] = [];

  const ctx: TestContext = {
    hasUI: true,
    model: { provider: "test-provider", id: "test-model" },
    sessionManager: {
      getBranch: () => [],
    },
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
    },
    testState: {
      notifications,
    },
  };

  Object.assign(ctx, overrides);
  return ctx;
}

test("parseExtractionResult parses direct, fenced, and surrounding JSON", () => {
  assert.deepEqual(parseExtractionResult('{"questions":[{"question":"What should we build?"}]}'), {
    questions: [{ question: "What should we build?" }],
  });

  assert.deepEqual(
    parseExtractionResult(
      'Here is the result:\n```json\n{"questions":[{"question":"Which env?","context":"Deploy target"}]}\n```',
    ),
    {
      questions: [{ question: "Which env?", context: "Deploy target" }],
    },
  );

  assert.deepEqual(parseExtractionResult('prefix {"questions":[]} suffix'), { questions: [] });
});

test("parseExtractionResult rejects malformed or unexpected responses", () => {
  assert.equal(parseExtractionResult("not json"), null);
  assert.equal(parseExtractionResult('{"answers":[]}'), null);
  assert.equal(parseExtractionResult('{"questions":"not an array"}'), null);
});

test("findLastAssistantText returns the latest assistant text parts", () => {
  const ctx = {
    sessionManager: {
      getBranch: () => [
        messageEntry("assistant", [
          { type: "text", text: "older" },
          { type: "tool_use", name: "ignored" },
        ]),
        messageEntry("user", [{ type: "text", text: "user question" }]),
        { type: "toolResult", result: "ignored" },
        messageEntry("assistant", [
          { type: "text", text: "first" },
          { type: "image", url: "ignored" },
          { type: "text", text: "second" },
        ]),
      ],
    },
  };

  assert.equal(findLastAssistantText(ctx as unknown as Parameters<typeof findLastAssistantText>[0]), "first\nsecond");
});

test("findLastAssistantText skips assistant messages without text and missing assistants", () => {
  assert.equal(
    findLastAssistantText({
      sessionManager: {
        getBranch: () => [
          messageEntry("assistant", [{ type: "image", url: "ignored" }]),
          messageEntry("user", [{ type: "text", text: "hello" }]),
        ],
      },
    } as unknown as Parameters<typeof findLastAssistantText>[0]),
    undefined,
  );
});

test("/answer reports non-interactive, model, and conversation precondition errors", async () => {
  const harness = createHarness();

  assert.deepEqual((await harness.run(createContext({ hasUI: false }))).testState.notifications, [
    { message: "answer requires interactive mode", level: "error" },
  ]);

  assert.deepEqual((await harness.run(createContext({ model: undefined }))).testState.notifications, [
    { message: "No model selected", level: "error" },
  ]);

  assert.deepEqual((await harness.run()).testState.notifications, [
    { message: "No assistant messages found", level: "error" },
  ]);
});
