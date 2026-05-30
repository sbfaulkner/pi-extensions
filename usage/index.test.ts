import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

type Handler = (...args: unknown[]) => unknown;

let importCounter = 0;

async function loadUsageModule(binDir?: string) {
  const originalPath = process.env.PATH;
  if (binDir) {
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
  }

  const mod = await import(`./index.ts?test=${Date.now()}-${importCounter++}`);

  return {
    mod,
    restoreEnv() {
      process.env.PATH = originalPath;
    },
  };
}

async function createGhFixture(usage = 42.7) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-extensions-usage-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir, { recursive: true });

  const ghPath = path.join(binDir, "gh");
  await writeFile(
    ghPath,
    `#!/bin/sh
if [ "$1" != "api" ]; then
  echo "unexpected command: $*" >&2
  exit 2
fi
if [ "$2" = "/user" ]; then
  printf '%s\n' 'octocat'
  exit 0
fi
if [ "$2" = "/users/octocat/settings/billing/usage/summary?product=copilot&sku=copilot_premium_request" ]; then
  printf '%s\n' '{"usageItems":[{"grossQuantity":${usage}}]}'
  exit 0
fi
echo "unexpected endpoint: $2" >&2
exit 2
`,
  );
  await chmod(ghPath, 0o755);

  return { binDir };
}

async function createFailingGhFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "pi-extensions-usage-failing-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir, { recursive: true });

  const ghPath = path.join(binDir, "gh");
  await writeFile(
    ghPath,
    `#!/bin/sh
echo "gh failure" >&2
exit 1
`,
  );
  await chmod(ghPath, 0o755);

  return { binDir };
}

function createPi() {
  const handlers = new Map<string, Handler[]>();

  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  };

  return { pi, handlers };
}

function createContext(provider?: string) {
  const statuses = new Map<string, string | undefined>();

  return {
    statuses,
    ctx: {
      model: provider ? { provider } : undefined,
      ui: {
        theme: {
          fg(style: string, text: string) {
            return `<${style}>${text}</${style}>`;
          },
        },
        setStatus(id: string, text: string | undefined) {
          statuses.set(id, text);
        },
      },
    },
  };
}

async function setupExtension(binDir?: string) {
  const { mod, restoreEnv } = await loadUsageModule(binDir);
  const harness = createPi();

  mod.default(harness.pi as Parameters<typeof mod.default>[0]);

  return { ...harness, restoreEnv };
}

test("session_start fetches GitHub Copilot usage and sets a dim status", async () => {
  const fixture = await createGhFixture(42.7);
  const harness = await setupExtension(fixture.binDir);

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>42/300 (github-copilot)</dim>");
  } finally {
    harness.restoreEnv();
  }
});

test("turn_end refreshes usage for supported providers", async () => {
  const fixture = await createGhFixture(17.2);
  const harness = await setupExtension(fixture.binDir);

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("turn_end") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>17/300 (github-copilot)</dim>");
  } finally {
    harness.restoreEnv();
  }
});

test("turn_end ignores unsupported providers", async () => {
  const harness = await setupExtension();

  try {
    const { ctx, statuses } = createContext("openai");

    for (const handler of harness.handlers.get("turn_end") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.has("provider-usage"), false);
  } finally {
    harness.restoreEnv();
  }
});

test("session_start keeps the default status when usage cannot be fetched", async () => {
  const fixture = await createFailingGhFixture();
  const harness = await setupExtension(fixture.binDir);
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>0/300 (github-copilot)</dim>");
  } finally {
    console.error = originalConsoleError;
    harness.restoreEnv();
  }
});

test("session_shutdown clears the usage status", async () => {
  const harness = await setupExtension();

  try {
    const { ctx, statuses } = createContext();

    for (const handler of harness.handlers.get("session_shutdown") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), undefined);
  } finally {
    harness.restoreEnv();
  }
});
