/**
 * Secrets Extension
 *
 * Loads environment variables from ejson secret files (~/.secrets.d/)
 * and injects them into all bash tool invocations.
 *
 * Provides:
 *   - load_secrets tool: LLM can load secrets by name
 *   - /secrets command: manually load secrets
 *   - Automatic env injection via bash spawnHook
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SECRETS_DIR = join(process.env.HOME ?? "", ".secrets.d");

function getAvailableSecrets(): string[] {
  if (!existsSync(SECRETS_DIR)) return [];
  return readdirSync(SECRETS_DIR)
    .filter((f) => f.endsWith(".ejson"))
    .map((f) => f.replace(/\.ejson$/, ""));
}

function loadSecretsFromEjson(name: string): Record<string, string> {
  const ejsonPath = join(SECRETS_DIR, `${name}.ejson`);
  if (!existsSync(ejsonPath)) {
    throw new Error(
      `Secrets file not found: ${ejsonPath}\nAvailable: ${getAvailableSecrets().join(", ")}`,
    );
  }

  const output = execFileSync("ejson", ["decrypt", ejsonPath], {
    encoding: "utf-8",
  });

  const parsed = JSON.parse(output);
  const env = parsed.environment ?? {};
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key !== "_public_key" && typeof value === "string") {
      vars[key] = value;
    }
  }
  return vars;
}

export default function (pi: ExtensionAPI) {
  const cwd = process.cwd();

  // In-memory store of loaded secrets
  let loadedSecrets: Record<string, string> = {};
  let loadedNames: string[] = [];
  const loadedEnvVarNames = new Set<string>();

  // Override bash tool to inject secrets via spawnHook
  const bashTool = createBashTool(cwd, {
    spawnHook: ({ command, cwd, env }) => ({
      command,
      cwd,
      env: { ...env, ...loadedSecrets },
    }),
  });

  pi.registerTool({
    ...bashTool,
    execute: async (id, params, signal, onUpdate, _ctx) => {
      return bashTool.execute(id, params, signal, onUpdate);
    },
  });

  // Register tool for LLM to load secrets
  pi.registerTool({
    name: "load_secrets",
    label: "Load Secrets",
    description:
      "Load environment variables from an ejson secret file. Once loaded, secrets are available in all subsequent bash commands.",
    promptSnippet:
      "Load env vars from ~/.secrets.d/ ejson files into all bash commands",
    promptGuidelines: [
      "Use load_secrets when a command needs API tokens or secrets (e.g. CLOUDFLARE_API_TOKEN).",
      "Never output secret values to the user.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description:
          'Name of the secrets file (without .ejson extension). Defaults to "secrets". Available files are in ~/.secrets.d/.',
      }),
    }),
    async execute(_toolCallId, params) {
      try {
        const vars = loadSecretsFromEjson(params.name);
        loadedSecrets = { ...loadedSecrets, ...vars };
        for (const [key, value] of Object.entries(vars)) {
          process.env[key] = value!;
          loadedEnvVarNames.add(key);
        }
        if (!loadedNames.includes(params.name)) {
          loadedNames.push(params.name);
        }

        const varNames = Object.keys(vars);
        return {
          content: [
            {
              type: "text",
              text: `Loaded ${varNames.length} secret(s) from ${params.name}.ejson: ${varNames.join(", ")}\nThese are now available in all bash commands.`,
            },
          ],
          details: { name: params.name, variables: varNames },
        };
      } catch (e: any) {
        throw new Error(e.message);
      }
    },
  });

  // Register /secrets command for manual use
  pi.registerCommand("secrets", {
    description: "Load secrets from ejson files",
    handler: async (args, ctx) => {
      const name = args?.trim() || "secrets";

      if (name === "list") {
        const available = getAvailableSecrets();
        ctx.ui.notify(
          `Available: ${available.join(", ")}${loadedNames.length ? `\nLoaded: ${loadedNames.join(", ")}` : ""}`,
          "info",
        );
        return;
      }

      if (name === "clear") {
        loadedSecrets = {};
        loadedNames = [];
        for (const key of loadedEnvVarNames) {
          delete process.env[key];
        }
        loadedEnvVarNames.clear();
        ctx.ui.setStatus("secrets", undefined);
        ctx.ui.notify("Secrets cleared", "info");
        return;
      }

      try {
        const vars = loadSecretsFromEjson(name);
        loadedSecrets = { ...loadedSecrets, ...vars };
        for (const [key, value] of Object.entries(vars)) {
          process.env[key] = value!;
          loadedEnvVarNames.add(key);
        }
        if (!loadedNames.includes(name)) {
          loadedNames.push(name);
        }
        ctx.ui.setStatus("secrets", `🔑 ${loadedNames.join(", ")}`);
        ctx.ui.notify(
          `Loaded ${Object.keys(vars).length} secret(s) from ${name}: ${Object.keys(vars).join(", ")}`,
          "success",
        );
      } catch (e: any) {
        ctx.ui.notify(e.message, "error");
      }
    },
  });

  // Restore secrets on session resume
  pi.on("session_start", async (_event, ctx) => {
    for (const entry of ctx.sessionManager.getBranch()) {
      if (
        entry.type === "message" &&
        entry.message.role === "toolResult" &&
        entry.message.toolName === "load_secrets" &&
        !entry.message.isError
      ) {
        const name = entry.message.details?.name;
        if (name && typeof name === "string") {
          try {
            const vars = loadSecretsFromEjson(name);
            loadedSecrets = { ...loadedSecrets, ...vars };
            for (const [key, value] of Object.entries(vars)) {
              process.env[key] = value!;
              loadedEnvVarNames.add(key);
            }
            if (!loadedNames.includes(name)) {
              loadedNames.push(name);
            }
          } catch {
            // Silently skip if ejson file no longer available
          }
        }
      }
    }

    if (loadedNames.length > 0) {
      ctx.ui.setStatus("secrets", `🔑 ${loadedNames.join(", ")}`);
    }
  });

  // Show status when secrets are loaded
  pi.on("turn_start", async (_event, ctx) => {
    if (loadedNames.length > 0) {
      ctx.ui.setStatus(
        "secrets",
        `🔑 ${loadedNames.join(", ")}`,
      );
    }
  });
}
