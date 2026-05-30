import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

let importCounter = 0;

async function loadModule(agentDir: string) {
  process.env.PI_CODING_AGENT_DIR = agentDir;
  return import(`./index.ts?test=${Date.now()}-${importCounter++}`);
}

async function withModule(run: (mod: typeof import("./index.ts"), agentDir: string) => Promise<void>) {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = await mkdtemp(path.join(tmpdir(), "pi-extensions-system-theme-"));

  try {
    const mod = await loadModule(agentDir);
    await run(mod, agentDir);
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  }
}

test("getOverrides returns only config values that differ from defaults", async () => {
  await withModule(async (mod) => {
    assert.deepEqual(mod.getOverrides(mod.DEFAULT_CONFIG), {});
    assert.deepEqual(
      mod.getOverrides({
        darkTheme: "rose-pine",
        lightTheme: mod.DEFAULT_CONFIG.lightTheme,
        pollMs: 5000,
      }),
      { darkTheme: "rose-pine", pollMs: 5000 },
    );
  });
});

test("loadConfig reads valid overrides and clamps short poll intervals", async () => {
  await withModule(async (mod, agentDir) => {
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      path.join(agentDir, "system-theme.json"),
      JSON.stringify({ darkTheme: "midnight", lightTheme: "dawn", pollMs: 100 }),
    );

    assert.deepEqual(await mod.loadConfig(), {
      darkTheme: "midnight",
      lightTheme: "dawn",
      pollMs: 500,
    });
  });
});

test("saveConfig writes only overrides and removes default config", async () => {
  await withModule(async (mod, agentDir) => {
    const configPath = path.join(agentDir, "system-theme.json");

    assert.equal(
      await mod.saveConfig({
        darkTheme: "dark-plus",
        lightTheme: mod.DEFAULT_CONFIG.lightTheme,
        pollMs: mod.DEFAULT_CONFIG.pollMs,
      }),
      1,
    );
    assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), { darkTheme: "dark-plus" });

    assert.equal(await mod.saveConfig(mod.DEFAULT_CONFIG), 0);
    assert.deepEqual(await mod.loadConfig(), mod.DEFAULT_CONFIG);
  });
});

test("detectLinuxAppearance prefers color-scheme and falls back to gtk-theme", async () => {
  await withModule(async (mod) => {
    const originalExecPath = process.env.PATH;
    const binDir = await mkdtemp(path.join(tmpdir(), "pi-extensions-gsettings-"));
    const gsettingsPath = path.join(binDir, "gsettings");

    try {
      process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;

      await writeFile(
        gsettingsPath,
        `#!/bin/sh
if [ "$3" = "color-scheme" ]; then
  echo "'prefer-dark'"
  exit 0
fi
exit 1
`,
        { mode: 0o755 },
      );
      assert.equal(await mod.detectLinuxAppearance(), "dark");

      await writeFile(
        gsettingsPath,
        `#!/bin/sh
if [ "$3" = "color-scheme" ]; then
  echo "'default'"
  exit 0
fi
if [ "$3" = "gtk-theme" ]; then
  echo "'Adwaita-light'"
  exit 0
fi
exit 1
`,
        { mode: 0o755 },
      );
      assert.equal(await mod.detectLinuxAppearance(), "light");
    } finally {
      process.env.PATH = originalExecPath;
    }
  });
});
