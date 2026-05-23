import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type Member = {
  id: string;
  displayName?: string;
  role?: string;
  provider?: string | null;
  modelId?: string | null;
  systemPrompt?: string | null;
  cmd?: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string> | null;
};

type Session = {
  proc: any;
  buffer: string;
  status: "idle" | "busy" | "offline";
  currentTaskId?: string | null;
};

const CONFIG_DIR = path.join(os.homedir() || ".", ".pi", "agent");
const CONFIG_PATH = path.join(CONFIG_DIR, "agency.json");

export default function (pi: ExtensionAPI) {
  let visible = false;
  const members = new Map<string, Member>();
  const sessions = new Map<string, Session>();

  async function loadState() {
    try {
      const raw = await readFile(CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.members)) {
        for (const m of parsed.members) {
          if (m && typeof m.id === "string") members.set(m.id, m as Member);
        }
      }
    } catch (e: any) {
      // ignore missing file
    }
  }

  async function saveState(): Promise<void> {
    await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    const obj = { members: Array.from(members.values()) };
    await writeFile(CONFIG_PATH, JSON.stringify(obj, null, 2) + "\n", "utf8");
  }

  function makeWidgetFactory(ctx: ExtensionCommandContext) {
    return (tui: any, theme: any) => {
      let cachedWidth: number | undefined;
      let cachedLines: string[] | undefined;

      const build = (width: number) => {
        if (cachedLines && cachedWidth === width) return cachedLines;

        const lines: string[] = [];
        lines.push(theme.fg("accent", "Agency Team"));
        lines.push("");

        if (members.size === 0) {
          lines.push(theme.fg("muted", "(no members) add with /agency add [role] — default role is developer"));
        } else {
          for (const m of Array.from(members.values())) {
            const s = sessions.get(m.id);
            const status = s ? s.status : "offline";
            const statusText =
              status === "idle" ? theme.fg("success", "idle") : status === "busy" ? theme.fg("accent", "busy") : theme.fg("dim", "offline");
            const model = m.modelId ? ` ${m.modelId}` : "";
            const role = m.role ? ` ${m.role}` : "";
            const line = `${theme.fg("dim", `${m.id}:`)}${m.displayName ? " " + m.displayName : ""}${role}${model} ${statusText}`;
            lines.push(line);
          }
          lines.push("");
          lines.push(theme.fg("dim", "Commands: /agency add [role], /agency member remove|list, /agency assign <id> <text>, /agency spawn <id>, /agency kill <id>"));
        }

        cachedLines = lines.map((l) => truncateToWidth(l, width));
        cachedWidth = width;
        return cachedLines;
      };

      return {
        render: (w: number) => build(w),
        invalidate: () => {
          cachedWidth = undefined;
          cachedLines = undefined;
        },
      };
    };
  }

  function normalizeArgs(args: string | string[] | undefined): string[] {
    if (!args) return [];
    if (typeof args === "string") {
      const s = args.trim();
      return s ? s.split(/\s+/) : [];
    }
    return args;
  }

  function generateId(role?: string): string {
    const base = (role || "member").replace(/[^a-z0-9]+/gi, "").toLowerCase() || "member";
    const time = Date.now().toString(36).slice(-4);
    const rand = Math.random().toString(36).slice(2, 6);
    return `${base}-${time}${rand}`;
  }

  function spawnMemberProcess(m: Member): Session | null {
    // If already spawned return
    const existing = sessions.get(m.id);
    if (existing && existing.proc && !existing.proc.killed) return existing;

    // Default to mock-member.js if no cmd provided
    const cmd = m.cmd || process.execPath; // node
    const args = (m.args && m.args.length > 0) ? m.args : [path.join(__dirname, "mock-member.js")];

    try {
      const proc = spawn(cmd, args, {
        cwd: m.cwd || process.cwd(),
        env: { ...(process.env as any), ...(m.env || {}) },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const session: Session = { proc, buffer: "", status: "idle", currentTaskId: null };
      sessions.set(m.id, session);

      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        session.buffer += chunk;
        let idx: number;
        while ((idx = session.buffer.indexOf("\n")) >= 0) {
          const line = session.buffer.slice(0, idx).trim();
          session.buffer = session.buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            handleMemberMessage(m.id, parsed);
          } catch (e) {
            // ignore parse errors
          }
        }
      });

      proc.stderr.setEncoding("utf8");
      proc.stderr.on("data", (s) => console.warn(`[agency:${m.id}] stderr:`, s));

      proc.on("exit", (code) => {
        session.status = "offline";
        session.proc = null as any;
        // re-render widget if visible
        if (visible) pi.ui.setWidget("agency", makeWidgetFactory(ctxForRender), { placement: "belowEditor" });
      });

      // Send a configure message so mock member can set provider/model
      const cfg = { type: "configure", provider: m.provider || null, model: m.modelId || null, systemPrompt: m.systemPrompt || null };
      try { proc.stdin.write(JSON.stringify(cfg) + "\n"); } catch {}

      // trigger UI update
      if (visible) pi.ui.setWidget("agency", makeWidgetFactory(ctxForRender), { placement: "belowEditor" });
      return session;
    } catch (e) {
      console.warn("Failed to spawn member", e);
      return null;
    }
  }

  // We'll capture a context for widget re-renders; it's set when commands run in interactive mode
  let ctxForRender: ExtensionCommandContext | null = null;

  function handleMemberMessage(memberId: string, msg: any) {
    const session = sessions.get(memberId);
    if (!session) return;
    // simple handler for ack/log/done
    if (msg.type === "ack") {
      session.status = "busy";
    } else if (msg.type === "log") {
      // For now just print logs to console and keep status
      console.log(`[agency:${memberId}]`, msg.line);
    } else if (msg.type === "done") {
      session.status = "idle";
      session.currentTaskId = null;
    } else if (msg.type === "configured") {
      // noop
    }

    // Re-render widget if visible and we have a context
    if (visible && ctxForRender) {
      try {
        ctxForRender.ui.setWidget("agency", makeWidgetFactory(ctxForRender), { placement: "belowEditor" });
      } catch {}
    }
  }

  // Simple send utility
  function sendToMember(memberId: string, obj: any) {
    const session = sessions.get(memberId);
    if (!session || !session.proc || !session.proc.stdin) return false;
    try {
      session.proc.stdin.write(JSON.stringify(obj) + "\n");
      return true;
    } catch (e) {
      return false;
    }
  }

  pi.registerCommand("agency", {
    description: "Toggle the agency widget or add items: /agency add <text>",
    handler: async (args: string | string[] | undefined, ctx) => {
      ctxForRender = ctx;
      const rawArgs = typeof args === "string" ? args.trim() : Array.isArray(args) ? args.join(" ").trim() : "";
      const parts = rawArgs ? rawArgs.split(/\s+/) : [];
      const verb = parts[0];

      if (verb === "member") {
        const sub = parts[1];
        if (sub === "add") {
          const id = parts[2];
          if (!id) { ctx.ui.notify("Usage: /agency member add <id>", "warning"); return; }
          const roleIndex = parts.indexOf("--role");
          const role = roleIndex >= 0 ? parts[roleIndex + 1] : "developer";
          const providerIndex = parts.indexOf("--provider");
          const provider = providerIndex >= 0 ? parts[providerIndex + 1] : null;
          const modelIndex = parts.indexOf("--model");
          const model = modelIndex >= 0 ? parts[modelIndex + 1] : null;
          const cmdIndex = parts.indexOf("--cmd");
          const cmd = cmdIndex >= 0 ? parts[cmdIndex + 1] : undefined;
          const argsIndex = parts.indexOf("--args");
          const cmdArgs = argsIndex >= 0 ? parts[argsIndex + 1].split(",") : undefined;

          const member: Member = { id, role, provider, modelId: model, cmd, args: cmdArgs };
          members.set(id, member);
          await saveState();
          ctx.ui.notify(`Member ${id} added`, "info");
          if (visible) ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
          return;
        }
        if (sub === "remove") {
          const id = parts[2];
          if (!id) { ctx.ui.notify("Usage: /agency member remove <id>", "warning"); return; }
          members.delete(id);
          sessions.delete(id);
          await saveState();
          ctx.ui.notify(`Member ${id} removed`, "info");
          if (visible) ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
          return;
        }
        if (sub === "list") {
          if (members.size === 0) { ctx.ui.notify("No members configured", "info"); return; }
          const list = Array.from(members.values()).map(m => `${m.id}${m.role? ' ('+m.role+')':''}${m.modelId? ' @'+m.modelId:''}`).join("\n");
          ctx.ui.notify(`Members:\n${list}`, "info");
          return;
        }

        ctx.ui.notify("Usage: /agency member add|remove|list ...", "info");
        return;
      }

      // New shorthand: /agency add [role]
      if (verb === "add") {
        const role = parts[1] || "developer";
        const id = generateId(role);
        const member: Member = { id, role };
        members.set(id, member);
        await saveState();
        ctx.ui.notify(`Member ${id} added (role=${role})`, "info");
        if (visible) ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
        return;
      }

      if (verb === "spawn") {
        const id = parts[1];
        if (!id) { ctx.ui.notify("Usage: /agency spawn <id>", "warning"); return; }
        const m = members.get(id);
        if (!m) { ctx.ui.notify(`Unknown member: ${id}`, "warning"); return; }
        const sess = spawnMemberProcess(m);
        if (!sess) ctx.ui.notify(`Failed to spawn ${id}`, "error"); else ctx.ui.notify(`${id} spawned`, "info");
        return;
      }

      if (verb === "kill") {
        const id = parts[1];
        if (!id) { ctx.ui.notify("Usage: /agency kill <id>", "warning"); return; }
        const s = sessions.get(id);
        if (s && s.proc) {
          try { s.proc.kill(); } catch {}
          sessions.delete(id);
          ctx.ui.notify(`${id} killed`, "info");
        } else {
          ctx.ui.notify(`${id} not running`, "info");
        }
        if (visible) ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
        return;
      }

      if (verb === "assign") {
        const id = parts[1];
        const text = parts.slice(2).join(" ").trim();
        if (!id || !text) { ctx.ui.notify("Usage: /agency assign <id> <task text>", "warning"); return; }
        const m = members.get(id);
        if (!m) { ctx.ui.notify(`Unknown member: ${id}`, "warning"); return; }
        // ensure session
        const sess = spawnMemberProcess(m);
        if (!sess) { ctx.ui.notify(`Failed to spawn ${id}`, "error"); return; }
        const taskId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
        sess.currentTaskId = taskId;
        sess.status = "busy";
        const sent = sendToMember(id, { id: taskId, type: "task", task: { text } });
        if (!sent) { ctx.ui.notify(`Failed to send task to ${id}`, "error"); sess.status = "idle"; return; }
        ctx.ui.notify(`Assigned to ${id}: ${text}`, "info");
        if (visible) ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
        return;
      }

      // Toggle widget
      if (!visible) {
        // Show widget below the editor
        ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
        visible = true;
        ctx.ui.notify("Agency widget shown", "info");
      } else {
        ctx.ui.setWidget("agency", undefined);
        visible = false;
        ctx.ui.notify("Agency widget hidden", "info");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    await loadState();
    // nothing else on start
  });

  pi.on("session_shutdown", (_event, ctx) => {
    // Ensure the UI is cleared of any agency artifacts
    if (ctx?.ui) {
      try {
        ctx.ui.setWidget("agency", undefined);
      } catch (e) {
        // ignore - some hosts may not provide full UI on shutdown
      }
    }

    // Kill any spawned procs we own
    for (const [id, s] of sessions.entries()) {
      if (s && s.proc) {
        try { s.proc.kill(); } catch {}
      }
    }
    sessions.clear();
    visible = false;
  });
}
