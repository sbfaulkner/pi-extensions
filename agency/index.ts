import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

type Member = {
  id: string;
  displayName?: string;
  role?: string;
  provider?: string | null;
  modelId?: string | null;
  thinking?: string | null;
  systemPrompt?: string | null;
  cmd?: string;
  args?: string[];
  cwd?: string | null;
  env?: Record<string, string> | null;
};

type Session = {
  proc: any;
  buffer: string;
  status: "idle" | "busy" | "offline" | "initializing" | "pending" | "error";
  currentTaskId?: string | null;
  lastActivity?: number | null;
};


export default function (pi: ExtensionAPI) {
  let visible = false;
  const members = new Map<string, Member>();
  const sessions = new Map<string, Session>();
  const events = new EventEmitter();
  const roles = new Map<string, any>();
  const verbMap = new Map<string, string>(); // verb -> role id


  async function loadRoles() {
    try {
      const raw = await readFile(path.join(__dirname, "roles.json"), "utf8");
      const parsed = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed || {})) {
        // If there is a roles/<role>/SYSTEM.md file, prefer its contents as the systemPrompt
        const roleDir = path.join(__dirname, "roles", k);
        try {
          const systemPath = path.join(roleDir, "SYSTEM.md");
          const systemText = await readFile(systemPath, "utf8");
          (v as any).systemPrompt = systemText;
        } catch {
          // no SYSTEM.md, keep whatever is in roles.json
        }
        roles.set(k, v);
        // collect verbs (if present) for shorthand commands
        try {
          const verbs = (v as any).verbs;
          if (verbs) {
            if (Array.isArray(verbs)) {
              for (const vb of verbs) verbMap.set(String(vb).toLowerCase(), String(k));
            } else if (typeof verbs === "string") {
              verbMap.set(String(verbs).toLowerCase(), String(k));
            }
          }
        } catch {}
      }
    } catch (e) {
      // ignore - roles may be missing; defaults are minimal
    }
  }

  // Load state from the current session only (no global fallback).
  async function loadState(ctx?: ExtensionCommandContext) {
    try {
      if (ctx && ctx.sessionManager) {
        const entries = ctx.sessionManager.getEntries();
        for (let i = entries.length - 1; i >= 0; i--) {
          const e: any = entries[i];
          if (e && e.type === "custom" && e.customType === "agency" && e.data && Array.isArray(e.data.members)) {
            members.clear();
            for (const m of e.data.members) {
              if (m && typeof m.id === "string") members.set(m.id, m as Member);
            }
            return;
          }
        }
      }
    } catch (e) {
      // ignore session restore failures
    }
    // No fallback: leave members empty if no session entry found
  }

  // Persist state to the current session only.
  async function saveState(ctx?: ExtensionCommandContext): Promise<void> {
    try {
      if (ctx && typeof (pi as any).appendEntry === "function") {
        await (pi as any).appendEntry("agency", { members: Array.from(members.values()) });
      }
    } catch (e) {
      // ignore persistence failure in headless contexts
    }
  }

  function makeWidgetFactory(ctx: ExtensionCommandContext) {
    return (tui: any, theme: any) => {
      let cachedWidth: number | undefined;
      let cachedLines: string[] | undefined;

      const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

      const build = (width: number) => {
        if (cachedLines && cachedWidth === width) return cachedLines;

        const lines: string[] = [];

        if (members.size === 0) {
          lines.push(theme.fg("muted", "0 members"));
          lines.push("");
        } else {
          for (const m of Array.from(members.values())) {
            const s = sessions.get(m.id);
            const status = s ? s.status : "offline";
            let statusText: string;
            if (status === "idle") {
              statusText = theme.fg("success", "idle");
            } else if (status === "pending") {
              statusText = theme.fg("muted", "pending");
            } else if (status === "initializing") {
              statusText = theme.fg("warning", "starting");
            } else if (status === "busy") {
              statusText = theme.fg("accent", "busy");
            } else if (status === "error") {
              statusText = theme.fg("error", "error");
            } else {
              statusText = theme.fg("dim", "offline");
            }
            const name = m.displayName ?? m.id;
            const roleName = m.role ?? "unknown";
            const pidColored = s && s.proc && typeof s.proc.pid === "number" ? theme.fg("dim", ` [pid:${s.proc.pid}]`) : "";

            const left = `${name} (${roleName}): ${statusText}`;

            // Right-align pidColored within the given width. Prefer to keep pid visible; truncate left if necessary.
            let line: string;
            if (pidColored) {
              const pidRawLen = stripAnsi(pidColored).length;
              const allowedLeftWidth = Math.max(0, width - pidRawLen - 1);
              const leftPart = truncateToWidth(left, allowedLeftWidth);
              const spacer = allowedLeftWidth > 0 ? " " : "";
              line = `${leftPart}${spacer}${pidColored}`;
            } else {
              line = left;
            }

            lines.push(line);
          }
        }

        cachedLines = lines.map((l) => truncateToWidth(l, width));
        cachedWidth = width;
        return cachedLines;
      };

      const onChange = () => {
        // Clear caches so render() rebuilds with latest data, then request a redraw
        cachedWidth = undefined;
        cachedLines = undefined;
        try { tui.requestRender(); } catch {}
      };
      events.on("change", onChange);

      return {
        render: (w: number) => build(w),
        invalidate: () => {
          cachedWidth = undefined;
          cachedLines = undefined;
        },
        dispose: () => {
          events.off("change", onChange);
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

  async function spawnMemberProcess(m: Member): Promise<Session | null> {
    // If already spawned return
    const existing = sessions.get(m.id);
    if (existing && existing.proc && !existing.proc.killed) return existing;

    // Always spawn pi in RPC mode by default; allow m.cmd/m.args to override if provided
    const cmd = m.cmd || "pi";
    const args: string[] = [];
    // ensure RPC mode
    args.push("--mode", "rpc");
    if (m.provider) args.push("--provider", String(m.provider));
    if (m.modelId) args.push("--model", String(m.modelId));
    if ((m as any).thinking) args.push("--thinking", String((m as any).thinking));

    // If a roles/<role>/SYSTEM.md file exists, pass its path via --system-prompt; otherwise do not override the default
    const roleDef = m.role ? roles.get(m.role) : undefined;
    if (!roleDef) {
      // Role missing in roles.json — caller should validate; log and continue without system-prompt
      console.warn(`spawnMemberProcess: role '${m.role}' not defined in roles.json`);
    } else {
      const roleFile = path.join(__dirname, "roles", String(m.role || ""), "SYSTEM.md");
      try {
        await readFile(roleFile, "utf8");
        args.push("--system-prompt", roleFile);
      } catch {
        // file doesn't exist; do not pass --system-prompt
      }
    }

    if (m.args && m.args.length > 0) args.push(...m.args);

    try {
      const proc = spawn(cmd, args, {
        cwd: m.cwd || process.cwd(),
        env: { ...(process.env as any), ...(m.env || {}) },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const session: Session = { proc, buffer: "", status: "initializing", currentTaskId: null, lastActivity: Date.now() };
      sessions.set(m.id, session);

      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        session.buffer += chunk;
        session.lastActivity = Date.now();
        let idx: number;
        while ((idx = session.buffer.indexOf("\n")) >= 0) {
          // Use strict LF framing per RPC docs
          const line = session.buffer.slice(0, idx).replace(/\r$/, "").trim();
          session.buffer = session.buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            // Emit raw parsed events for listeners (handshake, debugging)
            try { events.emit("raw", m.id, parsed); } catch (e) {}
            // Persist raw events into the session history so they appear in session output
            try {
              if (typeof (pi as any).appendEntry === "function") {
                (pi as any).appendEntry("agency-log", { time: Date.now(), member: m.id, event: parsed }).catch(() => {});
              }
            } catch {}
            // If we were initializing, the first parsed event means the process is alive; mark idle unless the event indicates activity
            if (session.status === "initializing") session.status = "idle";
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

  // Busy reaper: reset sessions stuck in 'busy' if no activity for this threshold
  const BUSY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
  let busyReaperTimer: NodeJS.Timeout | null = null;

  function handleMemberMessage(memberId: string, msg: any) {
    const session = sessions.get(memberId);
    if (!session) return;
    session.lastActivity = Date.now();
    // RPC-mode event handling: treat streaming and tool events as busy, message_end/tool_execution_end as idle
    if (msg.type === "response") {
      // command responses — no-op here (handshake handled elsewhere)
    } else if (msg.type === "message_start" || msg.type === "message_update") {
      session.status = "busy";
    } else if (msg.type === "message_end") {
      session.status = "idle";
      session.currentTaskId = null;
    } else if (msg.type === "tool_execution_start" || msg.type === "tool_execution_update") {
      session.status = "busy";
    } else if (msg.type === "tool_execution_end") {
      session.status = "idle";
    } else {
      // Fallback for mock/simple messages
      if (msg.type === "ack") session.status = "busy";
      if (msg.type === "log") console.log(`[agency:${memberId}]`, msg.line);
      if (msg.type === "done") {
        session.status = "idle";
        session.currentTaskId = null;
      }
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

  // Assign a text task to a member. This handles spawning, sets a pending state,
  // sends the prompt, waits briefly for an explicit confirmation response, and
  // transitions to busy/idle accordingly. Returns true on success.
  async function assignTaskToMember(member: Member, text: string, innerCtx: ExtensionCommandContext): Promise<boolean> {
    const sess = await spawnMemberProcess(member);
    if (!sess) {
      innerCtx.ui.notify(`Failed to spawn member ${member.id} - spawn failed`, "error");
      return false;
    }

    const taskId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    sess.currentTaskId = taskId;
    // mark as pending until we confirm the child accepted the prompt
    sess.status = "pending" as any;

    const sent = sendToMember(member.id, { id: taskId, type: "prompt", message: text });
    if (!sent) {
      sess.status = "idle";
      sess.currentTaskId = null;
      innerCtx.ui.notify(`Failed to send task to ${member.id} - send failed`, "error");
      try { events.emit("change"); } catch {}
      return false;
    }

    // Wait for a response with matching id (response.type === 'response' && id === taskId)
    let confirmed: boolean | undefined = undefined;
    try {
      confirmed = await new Promise<boolean | undefined>((resolve) => {
        const onRaw = (memberId: string, parsed: any) => {
          if (memberId !== member.id) return;
          if (parsed && parsed.type === "response" && parsed.id === taskId) {
            try { events.off("raw", onRaw); } catch {}
            resolve(parsed.success === true);
          }
        };
        events.on("raw", onRaw);
        // Timeout after 6s
        setTimeout(() => { try { events.off("raw", onRaw); } catch {} ; resolve(undefined); }, 6000);
      });
    } catch (e) {
      confirmed = undefined;
    }

    if (confirmed === true) {
      sess.status = "busy";
      innerCtx.ui.notify(`Assigned ${member.role} task to ${member.displayName ?? member.id}`, "info");
      try { events.emit("change"); } catch {}
      return true;
    }

    if (confirmed === false) {
      // explicit rejection
      sess.status = "idle";
      sess.currentTaskId = null;
      innerCtx.ui.notify(`Failed to assign task to ${member.id} - rejected`, "error");
      try { events.emit("change"); } catch {}
      return false;
    }

    // Timeout: assume accepted but we didn't get explicit confirmation; transition to busy
    sess.status = "busy";
    innerCtx.ui.notify(`Assigned ${member.role} task to ${member.displayName ?? member.id}`, "info");
    try { events.emit("change"); } catch {}
    return true;
  }

  pi.on("session_start", async (_event, ctx) => {
    await loadRoles();
    await loadState(ctx);
    // Register interactive command only when UI is available
    if (!ctx.hasUI) return;
    if (commandRegistered) return;

    // Raw event -> UI notifications for debugging. Uses ctxForRender so notifications appear in the active UI context.


    // Helper: create and spawn a member for a role (returns the member or null)
    async function createMemberForRole(role: string, explicitName: string | undefined, innerCtx: ExtensionCommandContext): Promise<Member | null> {
      const roleId = role.toLowerCase();
      const roleDef = roles.get(roleId);
      if (!roleDef) {
        innerCtx.ui.notify(`Failed to add member ${roleId} - unknown role`, "error");
        return null;
      }
      // Default provider/model/thinking to the current session if missing in the role definition
      const sessionProvider = innerCtx.model?.provider ?? null;
      const sessionModelId = (innerCtx.model as any)?.id ?? null;
      const sessionThinking = (innerCtx.model as any)?.thinking ?? null;
      const provider = roleDef.provider ?? sessionProvider;
      const modelId = roleDef.modelId ?? sessionModelId;
      const thinking = roleDef.thinking ?? sessionThinking;
      if (!provider || !modelId || !thinking) {
        innerCtx.ui.notify(`Failed to add member ${roleId} - role definition missing provider/modelId/thinking and no session defaults available`, "error");
        return null;
      }

      // Build set of used display names (case-insensitive)
      const usedNames = new Set(
        Array.from(members.values()).map((m) => (m.displayName || "").toLowerCase()).filter((s) => !!s),
      );

      let displayName: string | undefined = undefined;
      if (explicitName) {
        if (usedNames.has(explicitName.toLowerCase())) {
          innerCtx.ui.notify(`Failed to add member ${roleId} ${explicitName} - name already in use`, "error");
          return null;
        }
        displayName = explicitName;
      } else if (roleDef && Array.isArray(roleDef.names) && roleDef.names.length > 0) {
        const unused = roleDef.names.filter((n: string) => !usedNames.has(n.toLowerCase()));
        if (unused.length === 0) {
          innerCtx.ui.notify(`Failed to add member ${roleId} - no unused names available`, "error");
          return null;
        }
        displayName = unused[Math.floor(Math.random() * unused.length)];
      } else {
        innerCtx.ui.notify(`Failed to add member ${roleId} - no names configured`, "error");
        return null;
      }

      function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
      let id: string;
      if (displayName) {
        const base = `${slugify(displayName)}`;
        id = base;
        let suffix = 2;
        while (members.has(id)) {
          id = `${base}-${suffix++}`;
        }
      } else {
        id = generateId(roleId);
      }

      const member: Member = { id, role: roleId, displayName, provider: provider ?? null, modelId: modelId ?? null, thinking: thinking ?? null } as Member;
      members.set(id, member);
      await saveState(innerCtx);
      const sess = await spawnMemberProcess(member);
      try { events.emit("change"); } catch {}
      return member;
    }

    pi.registerCommand("agency", {
      description: "Toggle the agency widget or add items: /agency add <text>",
      handler: async (args: string | string[] | undefined, innerCtx) => {
        ctxForRender = innerCtx.hasUI ? innerCtx : null;
        const rawArgs = typeof args === "string" ? args.trim() : Array.isArray(args) ? args.join(" ").trim() : "";
        const parts = rawArgs ? rawArgs.split(/\s+/) : [];
        const verb = parts[0];

        // Help: /agency help
        if (verb === "help") {
          // Build verbs mapping text
          const verbsLines = Array.from(verbMap.entries())
            .map(([v, r]) => `  ${v} → ${r}`)
            .sort()
            .join("\n");

          const usage = [
            "Agency commands:",
            " /agency                     - toggle the agency widget (UI)",
            " /agency help                - show this help message",
            " /agency add <role> [name]   - add a member for <role>; optional explicit name (Title Case)",
            " /agency remove <id|displayName> - remove a member by id or display name (case-insensitive)",
            " /agency list                - list configured members",
            " /agency assign <id> <task>  - assign a task to a member (by id)",
            " /agency stop                - stop all member processes (keeps member entries)",
            " /agency <verb> [task]       - shorthand: create/assign using role verbs (examples below)",
            "",
            "Role verb shorthands:",
            verbsLines || "  (no verbs configured)",
            "",
            "Notes:",
            " - If <task> is omitted the command only adds a member of the role.",
            " - If <task> is provided the command will try to assign it to an idle member of that role; otherwise it creates a new member and assigns the task.",
            " - Names are unique and case-insensitive; if no explicit name is given a random unused name from roles.json is chosen.",
          ].join("\n");

          innerCtx.ui.notify(usage, "info");
          return;
        }

        // Role verb shorthand: /agency <verb> <task>
        // If no task is provided: add a member of that role.
        // If task is provided: assign to an idle member of that role if present; otherwise add a member and assign.
        if (verb && verbMap.has(verb.toLowerCase())) {
          const role = verbMap.get(verb.toLowerCase())!;
          const taskText = parts.slice(1).join(" ").trim();

          if (!taskText) {
            const member = await createMemberForRole(role, undefined, innerCtx);
            if (!member) return;
            innerCtx.ui.notify(`Added ${role} ${member.displayName ?? member.id}`, "info");
            return;
          }

          // Find an idle member for this role
          let targetMember: Member | null = null;
          for (const m of Array.from(members.values())) {
            if (m.role === role) {
              const s = sessions.get(m.id);
              if (s && s.status === "idle") { targetMember = m; break; }
            }
          }

          if (!targetMember) {
            // create new member and assign
            const member = await createMemberForRole(role, undefined, innerCtx);
            if (!member) return;
            targetMember = member;
            innerCtx.ui.notify(`Added ${role} ${targetMember.displayName ?? targetMember.id}`, "info");
          }

          await assignTaskToMember(targetMember, taskText, innerCtx);
          return;
        }

        // New shorthand: /agency add [role]
        if (verb === "add") {
          // Normalize role to lowercase to match roles.json keys and enforce existence
          const role = (parts[1] || "developer").toLowerCase();
          const roleDef = roles.get(role);
          if (!roleDef) { innerCtx.ui.notify(`Failed to add member ${role} - unknown role`, "error"); return; }
          // Default provider/model/thinking to the current session if missing in the role definition
          const sessionProvider = innerCtx.model?.provider ?? null;
          const sessionModelId = (innerCtx.model as any)?.id ?? null;
          const sessionThinking = (innerCtx.model as any)?.thinking ?? null;
          const provider = roleDef.provider ?? sessionProvider;
          const modelId = roleDef.modelId ?? sessionModelId;
          const thinking = roleDef.thinking ?? sessionThinking;
          if (!provider || !modelId || !thinking) {
            innerCtx.ui.notify(`Failed to add member ${role} - role definition missing provider/modelId/thinking and no session defaults available`, "error");
            return;
          }

          // Determine displayName: optional user-provided name as parts[2], otherwise pick an unused name from role definition
          const explicitName = parts[2] ? parts.slice(2).join(" ").trim() : undefined;
          let displayName: string | undefined = undefined;

          // Build set of used display names (case-insensitive)
          const usedNames = new Set(
            Array.from(members.values())
              .map((m) => (m.displayName || "").toLowerCase())
              .filter((s) => !!s),
          );

          if (explicitName) {
            // Explicit names must not collide with existing displayNames
            if (usedNames.has(explicitName.toLowerCase())) {
              innerCtx.ui.notify(`Failed to add member ${role} ${explicitName} - name already in use`, "error");
              return;
            }
            displayName = explicitName;
          } else if (roleDef && Array.isArray(roleDef.names) && roleDef.names.length > 0) {
            // Randomly select an unused name only; if none available, error
            const unused = roleDef.names.filter((n: string) => !usedNames.has(n.toLowerCase()));
            if (unused.length === 0) {
              innerCtx.ui.notify(`Failed to add member ${role} - no unused names available`, "error");
              return;
            }
            displayName = unused[Math.floor(Math.random() * unused.length)];
          } else {
            // No name provided and no role-defined names to choose from
            innerCtx.ui.notify(`Failed to add member ${role} - no names configured`, "error");
            return;
          }

          // Generate a stable id based on role + slug(displayName) or fallback
          function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
          let id: string;
          if (displayName) {
            // Prefer using the displayName as the unique id (slugified). Only append a numeric suffix on collisions.
            const base = `${slugify(displayName)}`;
            id = base;
            let suffix = 2;
            while (members.has(id)) {
              id = `${base}-${suffix++}`;
            }
          } else {
            id = generateId(role);
          }

          // Apply role defaults (provider/model/thinking) to the member so spawnMemberProcess can pass CLI args
          const member: Member = { id, role, displayName, provider: provider ?? null, modelId: modelId ?? null, thinking: thinking ?? null };
          members.set(id, member);
          await saveState(innerCtx);
          // Spawn the member process immediately
          const sess = await spawnMemberProcess(member);
          if (sess) {
            innerCtx.ui.notify(`Added ${role} ${displayName ?? id}`, "info");
          } else {
            innerCtx.ui.notify(`Failed to spawn member ${role} ${displayName ?? id} - spawn failed`, "error");
          }
          try { events.emit("change"); } catch {}
          return;
        }

        // Shorthand clear: /agency clear  (stop and remove all members)
        if (verb === "clear") {
          try {
            // detect any busy members
            const busy = Array.from(sessions.values()).some((s) => s && s.status === "busy");
            if (busy) {
              // Prefer a UI confirmation if available
              try {
                if (innerCtx && innerCtx.ui && typeof (innerCtx.ui as any).confirm === "function") {
                  const ok = await (innerCtx.ui as any).confirm("Some members are busy. Stop and remove all members?");
                  if (!ok) { innerCtx.ui.notify("Clear cancelled", "info"); return; }
                } else {
                  const args = parts.slice(1).join(" ").toLowerCase();
                  const force = args.includes("confirm") || args.includes("--confirm") || args.includes("yes") || args.includes("--force");
                  if (!force) {
                    // No confirmation available and no force token: remove only idle members and warn
                    const removed: string[] = [];
                    for (const [id, s] of sessions.entries()) {
                      if (!s || s.status !== "busy") {
                        if (s && s.proc) {
                          try { s.proc.kill(); } catch (e) { /* ignore */ }
                        }
                        sessions.delete(id);
                        if (members.has(id)) {
                          members.delete(id);
                        }
                        removed.push(id);
                      }
                    }
                    await saveState(innerCtx);
                    try { events.emit("change"); } catch {}
                    innerCtx.ui.notify(`Removed idle members (${removed.join(", ")}); busy members were not cleared. Run '/agency clear confirm' to force.`, "warning");
                    return;
                  }
                }
              } catch (e) {
                // If confirmation UI throws or rejects, abort
                innerCtx.ui.notify("Clear cancelled", "info");
                return;
              }
            }

            // Either no busy members or confirmation was obtained: remove everything
            for (const [id, s] of sessions.entries()) {
              if (s && s.proc) {
                try { s.proc.kill(); } catch (e) { /* ignore individual failures */ }
              }
            }
            sessions.clear();
            members.clear();
            await saveState(innerCtx);
            try { events.emit("change"); } catch {}
            innerCtx.ui.notify("Removed all members", "info");
          } catch (e) {
            innerCtx.ui.notify(`Failed to clear agency - ${String(e)}`, "error");
          }
          return;
        }

        // Shorthand remove: /agency remove <id|displayName>
        if (verb === "remove") {
          const target = parts.slice(1).join(" ").trim();
          if (!target) { innerCtx.ui.notify("Usage: /agency remove <id|displayName>", "warning"); return; }
          // Allow removing by id or by displayName (case-insensitive)
          let idToRemove: string | undefined = undefined;
          const maybeId = target.toLowerCase();
          if (members.has(maybeId)) {
            idToRemove = maybeId;
          } else {
            for (const [id, m] of members.entries()) {
              if ((m.displayName || "").toLowerCase() === target.toLowerCase()) {
                idToRemove = id;
                break;
              }
            }
          }
          if (!idToRemove) { innerCtx.ui.notify(`Failed to remove member ${target} - unknown member`, "warning"); return; }
          // Kill session if running
          const s = sessions.get(idToRemove);
          if (s && s.proc) {
            try { s.proc.kill(); } catch (e) { /* ignore */ }
            sessions.delete(idToRemove);
          }
          members.delete(idToRemove);
          await saveState(innerCtx);
          innerCtx.ui.notify(`Removed member ${idToRemove}`, "info");
          try { events.emit("change"); } catch {}
          return;
        }

        // Shorthand list: /agency list
        if (verb === "list") {
          if (members.size === 0) { innerCtx.ui.notify("No members configured", "info"); return; }
          const list = Array.from(members.values()).map(m => {
            const s = sessions.get(m.id);
            const pidText = s && s.proc && typeof s.proc.pid === "number" ? ` [pid:${s.proc.pid}]` : "";
            return `${m.displayName ?? m.id} (${m.role ? m.role : 'unknown'}): ${s ? s.status : 'offline'}${pidText}`;
          }).join("\n");
          innerCtx.ui.notify(`Members:\n${list}`, "info");
          return;
        }

        // Shorthand assign: /agency assign <id> <text>
        if (verb === "assign") {
          const id = parts[1];
          const text = parts.slice(2).join(" ").trim();
          if (!id || !text) { innerCtx.ui.notify("Usage: /agency assign <id> <task text>", "warning"); return; }
          const m = members.get(id);
          if (!m) { innerCtx.ui.notify(`Failed to assign member ${id} - unknown member`, "warning"); return; }
          // ensure session
          await assignTaskToMember(m, text, innerCtx);
          return;
        }

        // Toggle widget
        if (!visible) {
          // Show widget below the editor
          innerCtx.ui.setWidget("agency", makeWidgetFactory(innerCtx), { placement: "belowEditor" });
          visible = true;
          innerCtx.ui.notify("Displayed agency widget", "info");
        } else {
          innerCtx.ui.setWidget("agency", undefined);
          visible = false;
          innerCtx.ui.notify("Hidden agency widget", "info");
        }
      },
    });

    // Start busy reaper that auto-resets stuck busy sessions
    if (!busyReaperTimer) {
      busyReaperTimer = setInterval(() => {
        try {
          const now = Date.now();
          for (const [id, s] of sessions.entries()) {
            if (!s) continue;
            if (s.status === "busy" && s.lastActivity && now - s.lastActivity > BUSY_TIMEOUT_MS) {
              // reset
              s.status = "idle";
              s.currentTaskId = null as any;
              const m = members.get(id);
              const name = m ? m.displayName ?? id : id;
              try {
                if (ctxForRender && ctxForRender.ui) ctxForRender.ui.notify(`${name} was reset to idle due to inactivity`, "warning");
              } catch (e) {}
              try { events.emit("change"); } catch (e) {}
            }
          }
        } catch (e) {}
      }, 30 * 1000);
    }

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
    try { if (busyReaperTimer) { clearInterval(busyReaperTimer); busyReaperTimer = null; } } catch {}
  });
}
