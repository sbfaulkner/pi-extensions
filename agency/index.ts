import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";

type Member = {
  id: string;
  displayName?: string;
  role?: string;
  provider?: string | null;
  modelId?: string | null;
  thinking?: string | null;
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

  // Minimize timer and delay (also used for temporary expand -> minimize)
  let minimizeTimer: ReturnType<typeof setTimeout> | null = null;
  const AUTO_HIDE_DELAY = 5000; // ms

  // Reference to an interactive context for UI actions (widget)
  let uiCtx: ExtensionCommandContext | undefined = undefined;

  // Minimized state: when true the widget renders as a single-line summary.
  let minimized = true;
  // Highlighted member id (when temporarily expanded)
  let highlightMemberId: string | null = null;

  function cancelAutoHide() {
    if (minimizeTimer) {
      try { clearTimeout(minimizeTimer); } catch {}
      minimizeTimer = null;
    }
  }

  function showAgencyWidget(ctx?: ExtensionCommandContext) {
    const c = ctx || uiCtx;
    if (!c || !c.hasUI) return;
    try {
      // Ensure widget is registered
      c.ui.setWidget("agency", makeWidgetFactory(c), { placement: "belowEditor" });
      visible = true;
      // Expand to full view
      minimized = false;
      try { events.emit("change"); } catch {}
    } catch (e) {
      // ignore
    }
    cancelAutoHide();
  }

  function hideAgencyWidget(ctx?: ExtensionCommandContext) {
    // Minimize the widget to a single-line summary (do not unregister)
    const c = ctx || uiCtx;
    if (!c || !c.hasUI) return;
    try {
      minimized = true;
      highlightMemberId = null;
      try { events.emit("change"); } catch {}
    } catch (e) {
      // ignore
    }
    cancelAutoHide();
  }

  function scheduleAutoHide() {
    cancelAutoHide();
    const active = Array.from(sessions.values()).some((s) => s && (s.status === "busy" || s.status === "pending" || s.status === "initializing"));
    if (!active && visible) {
      minimizeTimer = setTimeout(() => {
        try { hideAgencyWidget(); } catch {}
        minimizeTimer = null;
      }, AUTO_HIDE_DELAY);
    }
  }

  function scheduleTemporaryMinimize() {
    // Always schedule a minimize after AUTO_HIDE_DELAY and clear highlight
    cancelAutoHide();
    minimizeTimer = setTimeout(() => {
      try {
        minimized = true;
        highlightMemberId = null;
        try { events.emit("change"); } catch {}
      } catch (e) {}
      minimizeTimer = null;
    }, AUTO_HIDE_DELAY);
  }

  async function loadRoles() {
    try {
      const raw = await readFile(path.join(__dirname, "roles.json"), "utf8");
      const parsed = JSON.parse(raw);
      for (const [k, v] of Object.entries(parsed || {})) {
        // roles/<role>/SYSTEM.md is read at spawn time if present. Store the role definition as-is.
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

        // If minimized, render a single summary line (plus a blank line)
        if (minimized) {
          if (members.size === 0) {
            lines.push(theme.fg("muted", "0 members"));
          } else {
            let busy = 0, idle = 0, pending = 0, initializing = 0, offline = 0, error = 0;
            for (const m of Array.from(members.values())) {
              const s = sessions.get(m.id);
              const status = s ? s.status : "offline";
              if (status === "busy") busy++;
              else if (status === "idle") idle++;
              else if (status === "pending") pending++;
              else if (status === "initializing") initializing++;
              else if (status === "error") error++;
              else offline++;
            }
            const parts: string[] = [];
            if (busy > 0) parts.push(`${busy} active`);
            if (idle > 0) parts.push(`${idle} idle`);
            if (pending > 0) parts.push(`${pending} pending`);
            if (initializing > 0) parts.push(`${initializing} starting`);
            if (offline > 0 && parts.length === 0) parts.push(`${offline} offline`);
            const summary = parts.join('; ');
            lines.push(theme.fg("muted", `${members.size} members — ${summary}`));
          }
          lines.push("");
          cachedLines = lines.map((l) => truncateToWidth(l, width));
          cachedWidth = width;
          return cachedLines;
        }

        // Full expanded view
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

            const leftRaw = `${name} (${roleName}): ${statusText}`;

            // Highlight if requested
            let left = leftRaw;
            if (highlightMemberId && highlightMemberId === m.id) {
              left = theme.fg("accent", leftRaw);
            }

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

    // Always spawn the pi binary in RPC mode; do not allow overriding the command.
    const cmd = "pi";
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

            // Optionally log raw events to console for debugging if runtime toggle enabled
            try {
              if (debugRawLogging) {
                try {
                  const MAX_STR = 40;
                  function truncateStr(s: string) {
                    if (s.length > MAX_STR) return s.slice(0, MAX_STR) + "...";
                    return s;
                  }
                  function truncateDeep(v: any, depth: number): any {
                    if (depth <= 0) return "...";
                    if (v === null || v === undefined) return v;
                    const t = typeof v;
                    if (t === "string") return truncateStr(v);
                    if (t === "number" || t === "boolean") return v;
                    if (Array.isArray(v)) {
                      const out = v.slice(0, 3).map((x) => truncateDeep(x, depth - 1));
                      if (v.length > 3) out.push("...");
                      return out;
                    }
                    if (t === "object") {
                      const keys = Object.keys(v);
                      const out: any = {};
                      let i = 0;
                      for (const k of keys) {
                        if (i >= 6) { out["..."] = true; break; }
                        out[k] = truncateDeep(v[k], depth - 1);
                        i++;
                      }
                      return out;
                    }
                    try { return String(v).slice(0, MAX_STR); } catch { return v; }
                  }

                  let summary = "";
                  if (parsed && typeof parsed === "object") {
                    if (parsed.type === "extension_ui_request" || parsed.type === "message_end") {
                      summary = JSON.stringify(truncateDeep(parsed, 3));
                    } else if (parsed.type === "message_update") {
                      const rep: any = { type: parsed.type };
                      try {
                        const ame = parsed.assistantMessageEvent;
                        if (ame && typeof ame === "object") {
                          rep.assistantMessageEvent = { type: String(ame.type) };
                          if (Object.keys(ame).length > 1) rep.assistantMessageEvent["..."] = true;
                        }
                      } catch {}
                      // include other top-level keys truncated
                      try {
                        for (const k of Object.keys(parsed)) {
                          if (k === "type" || k === "assistantMessageEvent") continue;
                          rep[k] = truncateDeep(parsed[k], 1);
                        }
                      } catch {}
                      summary = JSON.stringify(rep);
                    } else {
                      summary = JSON.stringify(truncateDeep(parsed, 2));
                    }
                  } else {
                    summary = JSON.stringify(parsed);
                  }

                  try { console.log(`[agency:${m.id}] ${new Date().toISOString()} RAW ${summary}`); } catch (e) { /* ignore */ }
                } catch (e) { /* ignore */ }
              }
            } catch (e) { /* ignore */ }
            // If we were initializing, the first parsed event means the process is alive; mark idle unless the event indicates activity
                    if (session.status === "initializing") session.status = "idle";
            handleMemberMessage(m.id, parsed);
            // If this event made the session idle, schedule auto-hide; otherwise cancel auto-hide
            try { scheduleAutoHide(); } catch {}

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

  let commandRegistered = false;

  // runtime debug toggle: when true, log raw parsed events to console
  let debugRawLogging = false;

  function handleMemberMessage(memberId: string, msg: any) {
    const session = sessions.get(memberId);
    if (!session) return;

    // Ignore UI-only extension requests that don't represent activity
    try {
      if (msg && msg.type === "extension_ui_request" && msg.method === "setStatus") return;
    } catch (e) {}

    session.lastActivity = Date.now();

    // Helper to emit a completion notify when a task id was present
    const maybeNotifyCompletion = (label: string, finishedTaskId: string | null) => {
      if (!finishedTaskId) return;
      try {
        if (uiCtx && uiCtx.ui && typeof (uiCtx.ui as any).notify === 'function') {
          const m = members.get(memberId);
          const disp = m ? (m.displayName ?? m.id) : memberId;
          try { (uiCtx.ui as any).notify(`${disp} ${label}${finishedTaskId ? ` (${finishedTaskId})` : ''}`, "info"); } catch {}
        }
      } catch {}
    };

    // RPC-mode event handling: treat streaming and tool events as busy, message_end/tool_execution_end as idle
    if (msg.type === "response") {
      // command responses — no-op here (handshake handled elsewhere)
    } else if (msg.type === "message_start" || msg.type === "message_update") {
      session.status = "busy";
      // cancel any pending minimize while active
      try { cancelAutoHide(); } catch {}
      // clear highlight when activity resumes
      highlightMemberId = null;
    } else if (msg.type === "message_end") {
      // Member finished a message: mark idle and highlight/expand widget briefly
      const finishedTaskId = session.currentTaskId ?? null;
      session.status = "idle";
      session.currentTaskId = null;

      // Highlight the member and expand the widget if minimized
      highlightMemberId = memberId;
      try { showAgencyWidget(uiCtx); } catch {}
      try { scheduleTemporaryMinimize(); } catch {}

      // Notify lead of final task completion if we had a task id
      maybeNotifyCompletion('completed task', finishedTaskId);
    } else if (msg.type === "tool_execution_start" || msg.type === "tool_execution_update") {
      session.status = "busy";
      try { cancelAutoHide(); } catch {}
      highlightMemberId = null;
    } else if (msg.type === "tool_execution_end") {
      // Finish of tool execution
      const finishedTaskId = session.currentTaskId ?? null;
      session.status = "idle";
      session.currentTaskId = null;
      highlightMemberId = memberId;
      try { showAgencyWidget(uiCtx); } catch {}
      try { scheduleTemporaryMinimize(); } catch {}

      maybeNotifyCompletion('finished tool execution', finishedTaskId);
    } else {
      // Fallback for simple messages
      if (msg.type === "ack") session.status = "busy";
      if (msg.type === "log") console.log(`[agency:${memberId}]`, msg.line);
      if (msg.type === "done") {
        const finishedTaskId = session.currentTaskId ?? null;
        session.status = "idle";
        session.currentTaskId = null;
        highlightMemberId = memberId;
        try { showAgencyWidget(uiCtx); } catch {}
        try { scheduleTemporaryMinimize(); } catch {}

        maybeNotifyCompletion('done', finishedTaskId);
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
      try { showAgencyWidget(innerCtx); } catch {}
      try { cancelAutoHide(); } catch {}
      return true;
    }

    if (confirmed === false) {
      // explicit rejection
      sess.status = "idle";
      sess.currentTaskId = null;
      innerCtx.ui.notify(`Failed to assign task to ${member.id} - rejected`, "error");
      try { events.emit("change"); } catch {}
      try { scheduleAutoHide(); } catch {}
      return false;
    }

    // Timeout: assume accepted but we didn't get explicit confirmation; transition to busy
    sess.status = "busy";
    innerCtx.ui.notify(`Assigned ${member.role} task to ${member.displayName ?? member.id}`, "info");
    try { events.emit("change"); } catch {}
    try { showAgencyWidget(innerCtx); } catch {}
    try { cancelAutoHide(); } catch {}
    return true;
  }

  pi.on("session_start", async (_event, ctx) => {
    await loadRoles();
    await loadState(ctx);

    // If we have a UI context, keep a reference so we can perform UI actions.
    if (ctx && ctx.hasUI) uiCtx = ctx;

    // Register interactive command only when UI is available
    if (!ctx.hasUI) return;
    if (commandRegistered) return;

    // On interactive session start, automatically restart member processes that were persisted
    // (assume members were saved via saveState). This lets `pi --continue` / `pi --resume`
    // restore the member sessions in interactive contexts only. We respawn sequentially and notify via ctx.ui.
    try {
      for (const m of Array.from(members.values())) {
        const existing = sessions.get(m.id);
        if (existing && existing.proc && !existing.proc.killed) continue;
        try {
          const sess = await spawnMemberProcess(m);
          if (sess) {
            try { ctx.ui.notify(`Resumed ${m.role} ${m.displayName ?? m.id}`, "info"); } catch {}
          } else {
            try { ctx.ui.notify(`Failed to spawn member ${m.role} ${m.displayName ?? m.id} - spawn failed`, "error"); } catch {}
          }
        } catch (e) {
          try { ctx.ui.notify(`Failed to spawn member ${m.role} ${m.displayName ?? m.id} - spawn failed`, "error"); } catch {}
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch (e) {
      // ignore spawn errors during resume
    }

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
      try { showAgencyWidget(innerCtx); } catch {}
      try { cancelAutoHide(); } catch {}
      return member;
    }

    pi.registerCommand("agency", {
      description: "Toggle the agency widget or add items: /agency add <text>",
      handler: async (args: string | string[] | undefined, innerCtx) => {

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
            " /agency log on|off|status   - toggle raw event console logging",
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
        // Reserved commands (handled below) should take precedence over role verbs.
        const reservedCommands = new Set(["help","add","remove","list","assign","clear","log"]);
        if (verb && !reservedCommands.has(verb.toLowerCase()) && verbMap.has(verb.toLowerCase())) {
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
          try { showAgencyWidget(innerCtx); } catch {}
          try { cancelAutoHide(); } catch {}
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

        // Logging toggle: /agency log on|off|status
        if (verb === "log") {
          const arg = parts[1] ? parts[1].toLowerCase() : "status";
          if (arg === "on") {
            debugRawLogging = true;
            innerCtx.ui.notify("Enabled raw event console logging", "info");
          } else if (arg === "off") {
            debugRawLogging = false;
            innerCtx.ui.notify("Disabled raw event console logging", "info");
          } else {
            innerCtx.ui.notify(`Raw event console logging is ${debugRawLogging ? 'on' : 'off'}`, "info");
          }
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

        // Toggle widget: expand/minimize rather than fully unregistering
        if (!visible) {
          // Show and expand widget below the editor
          try { showAgencyWidget(innerCtx); } catch {}
          // No noisy notification for auto/show
        } else {
          // Minimize the widget to the summary line
          try { hideAgencyWidget(innerCtx); } catch {}
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

    // Clear ui context reference
    uiCtx = undefined;

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
