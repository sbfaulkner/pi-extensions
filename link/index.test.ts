import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOsascriptClipboardArgs,
  createLinkExtension,
  formatHtmlLine,
  formatLinkOutput,
  formatPlainLine,
  htmlEscape,
  parseRefs,
  type PullRequestMetadata,
} from "./index.ts";

interface Notification {
  message: string;
  level: string;
}

interface SentMessage {
  msg: unknown;
  opts?: unknown;
}

interface Command {
  name: string;
  handler: (args: string, ctx: TestContext) => Promise<void>;
}

interface TestContext {
  cwd: string;
  ui: {
    notify(message: string, level: string): void;
  };
  testState: {
    notifications: Notification[];
  };
}

const PR_ONE: PullRequestMetadata = {
  number: 123,
  title: 'Fix "quoted" & <tag> in paths',
  url: "https://github.com/acme/repo/pull/123?foo=1&bar=2",
  additions: 42,
  deletions: 7,
};

const PR_TWO: PullRequestMetadata = {
  number: 456,
  title: "Ship link command",
  url: "https://github.com/acme/repo/pull/456",
  additions: 10,
  deletions: 1,
};

function createContext(): TestContext {
  const notifications: Notification[] = [];
  return {
    cwd: "/repo",
    ui: {
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
    },
    testState: { notifications },
  };
}

function createHarness(deps: Parameters<typeof createLinkExtension>[1] = {}): {
  command: Command;
  sentMessages: SentMessage[];
} {
  let command: Command | undefined;
  const sentMessages: SentMessage[] = [];

  const pi = {
    registerMessageRenderer() {},
    registerCommand(name: string, options: unknown) {
      command = { name, ...(options as Omit<Command, "name">) };
    },
    sendMessage(msg: unknown, opts?: unknown) {
      sentMessages.push({ msg, opts });
    },
  };

  createLinkExtension(pi as unknown as Parameters<typeof createLinkExtension>[0], deps);

  assert.ok(command, "link command should be registered");
  assert.equal(command.name, "link");
  return { command, sentMessages };
}

function sentContent(sent: SentMessage): string {
  const msg = sent.msg as { content?: unknown };
  if (typeof msg.content !== "string") {
    throw new Error("sent message content should be a string");
  }
  return msg.content;
}

test("parseRefs splits whitespace and treats blank input as current branch", () => {
  assert.deepEqual(parseRefs(""), []);
  assert.deepEqual(parseRefs("   \t\n  "), []);
  assert.deepEqual(parseRefs("123 https://github.com/acme/repo/pull/456 feature/link"), [
    "123",
    "https://github.com/acme/repo/pull/456",
    "feature/link",
  ]);
});

test("formatters produce plain markdown and escaped HTML", () => {
  assert.equal(
    formatPlainLine(PR_ONE),
    '👀 [#123 Fix "quoted" & <tag> in paths](https://github.com/acme/repo/pull/123?foo=1&bar=2) `+42/-7`',
  );

  assert.equal(htmlEscape("\"&<>'"), "&quot;&amp;&lt;&gt;&#39;");
  assert.equal(
    formatHtmlLine(PR_ONE),
    '👀 <a href="https://github.com/acme/repo/pull/123?foo=1&amp;bar=2">#123 Fix &quot;quoted&quot; &amp; &lt;tag&gt; in paths</a> <code>+42/-7</code>',
  );
});

test("formatLinkOutput joins plain lines with newlines and HTML lines with br", () => {
  const output = formatLinkOutput([PR_ONE, PR_TWO]);

  assert.equal(
    output.plain,
    '👀 [#123 Fix "quoted" & <tag> in paths](https://github.com/acme/repo/pull/123?foo=1&bar=2) `+42/-7`\n👀 [#456 Ship link command](https://github.com/acme/repo/pull/456) `+10/-1`',
  );
  assert.match(output.html, /^<meta charset="utf-8">/);
  assert.match(output.html, /<br>👀 <a href="https:\/\/github.com\/acme\/repo\/pull\/456">/);
});

test("buildOsascriptClipboardArgs passes plain text as argv instead of interpolating it into AppleScript", () => {
  const plain = 'quote " backslash \\ newline\nemoji 👀';
  const html = '<meta charset="utf-8"><b>quote " & emoji 👀</b>';
  const args = buildOsascriptClipboardArgs(plain, html);

  assert.equal(args.at(-1), plain);
  const script = args.slice(0, -1).join("\n");
  assert.doesNotMatch(script, /quote/);
  assert.match(script, /«data HTML[0-9a-f]+»/);
});

test("/link resolves the current branch PR, emits the exact link line, and copies rich text", async () => {
  const seenRefs: Array<string | null> = [];
  const copies: Array<{ plain: string; html: string }> = [];
  const { command, sentMessages } = createHarness({
    env: {},
    viewPullRequest: async (cwd, ref) => {
      assert.equal(cwd, "/repo");
      seenRefs.push(ref);
      return PR_TWO;
    },
    copyToClipboard: async (plain, html) => {
      copies.push({ plain, html });
    },
  });

  const ctx = createContext();
  await command.handler("", ctx);

  assert.deepEqual(seenRefs, [null]);
  assert.equal(sentMessages.length, 1);
  assert.equal(
    sentContent(sentMessages[0]),
    "👀 [#456 Ship link command](https://github.com/acme/repo/pull/456) `+10/-1`",
  );
  assert.deepEqual(copies, [formatLinkOutput([PR_TWO])]);
  assert.deepEqual(ctx.testState.notifications, [{ message: "Link copied to clipboard.", level: "info" }]);
});

test("/link processes refs in order", async () => {
  const seenRefs: Array<string | null> = [];
  const { command, sentMessages } = createHarness({
    env: {},
    viewPullRequest: async (_cwd, ref) => {
      seenRefs.push(ref);
      return ref === "123" ? PR_ONE : PR_TWO;
    },
    copyToClipboard: async () => {},
  });

  await command.handler("123 feature/link", createContext());

  assert.deepEqual(seenRefs, ["123", "feature/link"]);
  assert.equal(sentContent(sentMessages[0]), formatLinkOutput([PR_ONE, PR_TWO]).plain);
});

test("/link can skip clipboard copy for tests and non-interactive dry runs", async () => {
  let copied = false;
  const { command, sentMessages } = createHarness({
    env: { LINK_SKIP_CLIPBOARD: "1" },
    viewPullRequest: async () => PR_TWO,
    copyToClipboard: async () => {
      copied = true;
    },
  });
  const ctx = createContext();

  await command.handler("456", ctx);

  assert.equal(copied, false);
  assert.equal(sentMessages.length, 1);
  assert.deepEqual(ctx.testState.notifications, [
    { message: "Link generated; clipboard skipped via LINK_SKIP_CLIPBOARD.", level: "info" },
  ]);
});

test("/link reports unsupported/unresolved refs without copying or emitting a link", async () => {
  let copied = false;
  const { command, sentMessages } = createHarness({
    env: {},
    viewPullRequest: async () => {
      throw new Error("not found");
    },
    copyToClipboard: async () => {
      copied = true;
    },
  });
  const ctx = createContext();

  await command.handler("not-a-pr", ctx);

  assert.equal(copied, false);
  assert.equal(sentMessages.length, 0);
  assert.equal(ctx.testState.notifications.length, 1);
  assert.equal(ctx.testState.notifications[0].level, "error");
  assert.match(ctx.testState.notifications[0].message, /\/link currently supports GitHub PRs only/);
});

test("/link still emits the link if clipboard copy fails", async () => {
  const { command, sentMessages } = createHarness({
    env: {},
    viewPullRequest: async () => PR_TWO,
    copyToClipboard: async () => {
      throw new Error("osascript denied");
    },
  });
  const ctx = createContext();

  await command.handler("456", ctx);

  assert.equal(sentMessages.length, 1);
  assert.equal(sentContent(sentMessages[0]), formatLinkOutput([PR_TWO]).plain);
  assert.deepEqual(ctx.testState.notifications, [
    { message: "Link generated, but clipboard copy failed: osascript denied", level: "error" },
  ]);
});
