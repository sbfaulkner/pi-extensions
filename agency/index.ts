import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

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
  const events = new EventEmitter();

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
          lines.push(theme.fg("dim", "Commands: /agency add [role], /agency list|remove, /agency assign <id> <text>"));
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
        // Notify listeners to re-render if widget is present
        try { events.emit("change"); } catch {}
      });

      // Send a configure message so mock member can set provider/model
      const cfg = { type: "configure", provider: m.provider || null, model: m.modelId || null, systemPrompt: m.systemPrompt || null };
      try { proc.stdin.write(JSON.stringify(cfg) + "\n"); } catch {}

      // trigger UI update
      try { events.emit("change"); } catch (e) { /* ignore */ }
      return session;
    } catch (e) {
      console.warn("Failed to spawn member", e);
      return null;
    }
  }

  // We'll capture a context for widget re-renders; it's set when commands run in interactive mode
  let ctxForRender: ExtensionCommandContext | null = null;
  let commandRegistered = false;

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

    // Notify listeners to re-render
    try { events.emit("change"); } catch {}
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

  pi.on("session_start", async (_event, ctx) => {
    await loadState();
    // Register interactive command only when UI is available
    if (!ctx.hasUI) return;
    if (commandRegistered) return;

    pi.registerCommand("agency", {
      description: "Toggle the agency widget or add items: /agency add <text>",
      handler: async (args: string | string[] | undefined, innerCtx) => {
        ctxForRender = innerCtx.hasUI ? innerCtx : null;
        const rawArgs = typeof args === "string" ? args.trim() : Array.isArray(args) ? args.join(" ").trim() : "";
        const parts = rawArgs ? rawArgs.split(/\s+/) : [];
        const verb = parts[0];

        // New shorthand: /agency add [role]
        if (verb === "add") {
          const role = parts[1] || "developer";
          const id = generateId(role);
          const member: Member = { id, role };
          members.set(id, member);
          await saveState();
          // Spawn the member process immediately
          const sess = spawnMemberProcess(member);
          if (sess) {
            innerCtx.ui.notify(`Member ${id} added and spawned (role=${role})`, "info");
          } else {
            innerCtx.ui.notify(`Member ${id} added (role=${role}) — failed to spawn`, "warning");
          }
          try { if (visible) events.emit("change"); } catch {}
          return;
        }

        // Shorthand remove: /agency remove <id>
        if (verb === "remove") {
          const id = parts[1];
          if (!id) { innerCtx.ui.notify("Usage: /agency remove <id>", "warning"); return; }
          if (!members.has(id)) { innerCtx.ui.notify(`Unknown member: ${id}`, "warning"); return; }
          // Kill session if running
          const s = sessions.get(id);
          if (s && s.proc) {
            try { s.proc.kill(); } catch (e) { /* ignore */ }
            sessions.delete(id);
          }
          members.delete(id);
          await saveState();
          innerCtx.ui.notify(`Member ${id} removed and process killed (if it was running)`, "info");
          try { if (visible) events.emit("change"); } catch {}
          return;
        }

        // Shorthand list: /agency list
        if (verb === "list") {
          if (members.size === 0) { innerCtx.ui.notify("No members configured", "info"); return; }
          const list = Array.from(members.values()).map(m => `${m.id}${m.role? ' ('+m.role+')':''}${m.modelId? ' @'+m.modelId:''}`).join("\n");
          innerCtx.ui.notify(`Members:\n${list}`, "info");
          return;
        }

        // Shorthand assign: /agency assign <id> <text>
        if (verb === "assign") {
          const id = parts[1];
          const text = parts.slice(2).join(" ").trim();
          if (!id || !text) { innerCtx.ui.notify("Usage: /agency assign <id> <task text>", "warning"); return; }
          const m = members.get(id);
          if (!m) { innerCtx.ui.notify(`Unknown member: ${id}`, "warning"); return; }
          // ensure session
          const sess = spawnMemberProcess(m);
          if (!sess) { innerCtx.ui.notify(`Failed to spawn ${id}`, "error"); return; }
          const taskId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
          sess.currentTaskId = taskId;
          sess.status = "busy";
          const sent = sendToMember(id, { id: taskId, type: "task", task: { text } });
          if (!sent) { innerCtx.ui.notify(`Failed to send task to ${id}`, "error"); sess.status = "idle"; return; }
          innerCtx.ui.notify(`Assigned to ${id}: ${text}`, "info");
          try { if (visible) events.emit("change"); } catch {}
          return;
        }

        // Toggle widget
        if (!visible) {
          // Show widget below the editor
          innerCtx.ui.setWidget("agency", makeWidgetFactory(innerCtx), { placement: "belowEditor" });
          visible = true;
          innerCtx.ui.notify("Agency widget shown", "info");
        } else {
          innerCtx.ui.setWidget("agency", undefined);
          visible = false;
          innerCtx.ui.notify("Agency widget hidden", "info");
        }
      },
    });

    commandRegistered = true;
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
