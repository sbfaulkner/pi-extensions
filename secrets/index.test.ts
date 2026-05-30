import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

type Handler = (...args: any[]) => unknown;

let importCounter = 0;

async function createSecretsFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "pi-extensions-secrets-"));
  const configHome = path.join(root, "config");
  const secretsDir = path.join(configHome, "secrets");
  const binDir = path.join(root, "bin");

  await mkdir(secretsDir, { recursive: true });
  await mkdir(binDir, { recursive: true });
  await writeFile(path.join(secretsDir, "secrets.ejson"), "{}\n");
  await writeFile(path.join(secretsDir, "other.ejson"), "{}\n");

  const ejsonPath = path.join(binDir, "ejson");
  await writeFile(
    ejsonPath,
    `#!/bin/sh
if [ "$1" != "decrypt" ]; then
  echo "unexpected command" >&2
  exit 2
fi
case "$2" in
  */secrets.ejson)
    printf '%s\n' '{"environment":{"API_TOKEN":"secret-token","_public_key":"public","NUMBER":123}}'
    ;;
  */other.ejson)
    printf '%s\n' '{"environment":{"OTHER_TOKEN":"other-secret"}}'
    ;;
  *)
    echo "unknown file: $2" >&2
    exit 2
    ;;
esac
`,
  );
  await chmod(ejsonPath, 0o755);

  return { root, configHome, secretsDir, binDir };
}

async function loadSecretsModule(configHome: string, binDir: string) {
  process.env.XDG_CONFIG_HOME = configHome;
  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
  return import(`./index.ts?test=${Date.now()}-${importCounter++}`);
}

function createPi() {
  const commands = new Map<string, any>();
  const tools = new Map<string, any>();
  const handlers = new Map<string, Handler[]>();

  const pi = {
    registerCommand(name: string, options: any) {
      commands.set(name, options);
    },
    registerTool(tool: any) {
      tools.set(tool.name, tool);
    },
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  };

  return { pi, commands, tools, handlers };
}

function createContext(branch: any[] = []) {
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses = new Map<string, string | undefined>();

  return {
    notifications,
    statuses,
    ctx: {
      sessionManager: {
        getBranch: () => branch,
      },
      ui: {
        notify(message: string, level: string) {
          notifications.push({ message, level });
        },
        setStatus(id: string, text: string | undefined) {
          statuses.set(id, text);
        },
      },
    },
  };
}

async function setupExtension() {
  const originalConfigHome = process.env.XDG_CONFIG_HOME;
  const originalPath = process.env.PATH;
  const fixture = await createSecretsFixture();
  const { default: secretsExtension } = await loadSecretsModule(fixture.configHome, fixture.binDir);
  const harness = createPi();

  secretsExtension(harness.pi as any);

  return {
    ...fixture,
    ...harness,
    restoreEnv() {
      process.env.XDG_CONFIG_HOME = originalConfigHome;
      process.env.PATH = originalPath;
      delete process.env.API_TOKEN;
      delete process.env.OTHER_TOKEN;
    },
  };
}

test("/secrets list shows available ejson files", async () => {
  const harness = await setupExtension();
  try {
    const { ctx, notifications } = createContext();

    await harness.commands.get("secrets").handler("list", ctx);

    assert.deepEqual(notifications, [{ message: "Available: other, secrets", level: "info" }]);
  } finally {
    harness.restoreEnv();
  }
});

test("/secrets loads and clears secret environment variables", async () => {
  const harness = await setupExtension();
  try {
    const { ctx, notifications, statuses } = createContext();

    await harness.commands.get("secrets").handler("secrets", ctx);

    assert.equal(process.env.API_TOKEN, "secret-token");
    assert.equal(process.env.NUMBER, undefined, "non-string ejson values should not be loaded");
    assert.equal(statuses.get("secrets"), "🔑 secrets");
    assert.deepEqual(notifications.at(-1), {
      message: "Loaded 1 secret(s) from secrets: API_TOKEN",
      level: "info",
    });

    await harness.commands.get("secrets").handler("clear", ctx);

    assert.equal(process.env.API_TOKEN, undefined);
    assert.equal(statuses.get("secrets"), undefined);
    assert.deepEqual(notifications.at(-1), { message: "Secrets cleared", level: "info" });
  } finally {
    harness.restoreEnv();
  }
});

test("load_secrets tool loads named secrets and reports variable names", async () => {
  const harness = await setupExtension();
  try {
    const result = await harness.tools.get("load_secrets").execute("tool-call", { name: "other" });

    assert.equal(process.env.OTHER_TOKEN, "other-secret");
    assert.deepEqual(result.details, { name: "other", variables: ["OTHER_TOKEN"] });
    assert.match(result.content[0].text, /Loaded 1 secret\(s\) from other\.ejson: OTHER_TOKEN/);
  } finally {
    harness.restoreEnv();
  }
});

test("session_start restores secrets loaded by earlier tool results", async () => {
  const harness = await setupExtension();
  try {
    const branch = [
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: "load_secrets",
          isError: false,
          details: { name: "other" },
        },
      },
    ];
    const { ctx, statuses } = createContext(branch);

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(process.env.OTHER_TOKEN, "other-secret");
    assert.equal(statuses.get("secrets"), "🔑 other");
  } finally {
    harness.restoreEnv();
  }
});
