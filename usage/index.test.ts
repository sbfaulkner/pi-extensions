import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

type Handler = (...args: unknown[]) => unknown;

type GhFixtureOptions =
  | {
      mode: "ai-credits";
      credits: number;
      grossAmount?: number;
      netAmount?: number;
    }
  | {
      mode: "empty-ai-credits";
    }
  | {
      mode: "legacy-premium-requests";
      requests: number;
    };

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

async function createGhFixture(options: GhFixtureOptions) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-extensions-usage-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir, { recursive: true });

  const ghPath = path.join(binDir, "gh");
  await writeFile(
    ghPath,
    `#!/usr/bin/env node
const options = ${JSON.stringify(options)};
const args = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(2);
}

if (args[0] !== "api") fail("unexpected command: " + args.join(" "));

const endpoint = args.find((arg) => arg.startsWith("/"));
if (!endpoint) fail("missing endpoint: " + args.join(" "));

if (endpoint === "/user") {
  console.log(args.includes("--jq") ? "octocat" : JSON.stringify({ login: "octocat" }));
  process.exit(0);
}

if (endpoint.startsWith("/users/octocat/settings/billing/usage/summary")) {
  const url = new URL("https://example.test" + endpoint);
  if (url.searchParams.get("product") !== "copilot") fail("unexpected product query: " + endpoint);
  if (!url.searchParams.get("year") || !url.searchParams.get("month")) fail("missing time query: " + endpoint);

  if (options.mode === "ai-credits") {
    console.log(JSON.stringify({
      usageItems: [{
        product: "Copilot",
        sku: "Copilot AI Credits",
        unitType: "credits",
        grossQuantity: options.credits,
        grossAmount: options.grossAmount,
        netAmount: options.netAmount,
      }],
    }));
    process.exit(0);
  }

  if (options.mode === "empty-ai-credits") {
    console.log(JSON.stringify({ usageItems: [] }));
    process.exit(0);
  }

  if (options.mode === "legacy-premium-requests") {
    console.log(JSON.stringify({
      usageItems: [{
        product: "Copilot",
        sku: "Copilot Premium Request",
        unitType: "requests",
        grossQuantity: options.requests,
      }],
    }));
    process.exit(0);
  }
}

if (endpoint.startsWith("/users/octocat/settings/billing/premium_request/usage")) {
  if (options.mode !== "legacy-premium-requests") fail("unexpected legacy endpoint: " + endpoint);

  const url = new URL("https://example.test" + endpoint);
  if (url.searchParams.get("product") !== "copilot") fail("unexpected product query: " + endpoint);
  if (!url.searchParams.get("year") || !url.searchParams.get("month")) fail("missing time query: " + endpoint);

  console.log(JSON.stringify({
    usageItems: [{
      product: "Copilot",
      sku: "Copilot Premium Request",
      unitType: "requests",
      grossQuantity: options.requests,
    }],
  }));
  process.exit(0);
}

fail("unexpected endpoint: " + endpoint);
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

test("session_start fetches GitHub Copilot AI credit usage and sets a dim status", async () => {
  const fixture = await createGhFixture({ mode: "ai-credits", credits: 123.456, grossAmount: 1.23456 });
  const harness = await setupExtension(fixture.binDir);

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>123.46 · $1.23 (github-copilot)</dim>");
  } finally {
    harness.restoreEnv();
  }
});

test("turn_end refreshes usage for supported providers", async () => {
  const fixture = await createGhFixture({ mode: "ai-credits", credits: 17.2, grossAmount: 0.172, netAmount: 0.05 });
  const harness = await setupExtension(fixture.binDir);

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("turn_end") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>17.2 · $0.17 · $0.05 billed (github-copilot)</dim>");
  } finally {
    harness.restoreEnv();
  }
});

test("falls back to legacy premium request usage when AI credits are not returned", async () => {
  const fixture = await createGhFixture({ mode: "legacy-premium-requests", requests: 42.7 });
  const harness = await setupExtension(fixture.binDir);

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>42 premium requests (github-copilot)</dim>");
  } finally {
    harness.restoreEnv();
  }
});

test("shows zero AI credits for an empty successful usage response", async () => {
  const fixture = await createGhFixture({ mode: "empty-ai-credits" });
  const harness = await setupExtension(fixture.binDir);

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>0 (github-copilot)</dim>");
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

test("session_start clears the status for unsupported providers", async () => {
  const harness = await setupExtension();

  try {
    const { ctx, statuses } = createContext("openai");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), undefined);
  } finally {
    harness.restoreEnv();
  }
});

test("session_start shows unavailable when usage cannot be fetched", async () => {
  const fixture = await createFailingGhFixture();
  const harness = await setupExtension(fixture.binDir);
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const { ctx, statuses } = createContext("github-copilot");

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(statuses.get("provider-usage"), "<dim>usage unavailable (github-copilot)</dim>");
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
