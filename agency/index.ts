/**
 * Agency extension
 *
 * Simple experiment showing a persistent widget above the editor (Pattern 5).
 * - /agency           Toggle the widget on/off
 * - /agency add TEXT  Add a line to the widget list
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import path from "node:path";

export default function (pi: ExtensionAPI) {
  let visible = false;
  const items: string[] = [];

  function makeWidgetFactory(ctx: ExtensionCommandContext) {
    return (tui: any, theme: any) => {
      const render = (width: number) => {
        if (items.length === 0) {
          return [theme.fg("muted", "(agency) no items — use /agency add <text> to add")];
        }
        const lines = [theme.fg("accent", "Agency"), ""]; // title + spacer
        for (let i = 0; i < items.length; i++) {
          const prefix = theme.fg("dim", `${i + 1}. `);
          const text = items[i];
          lines.push(prefix + text);
        }
        return lines.map((l) => (l.length > width ? l.slice(0, width) : l));
      };

      return {
        render: (w: number) => render(w),
        invalidate: () => {},
      };
    };
  }

  // Footer factory maker so we can re-register on updates
  function makeFooterFactory(ctx: ExtensionCommandContext) {
    return (tui: any, theme: any, footerData: any) => {
      const unsub = typeof footerData.onBranchChange === "function" ? footerData.onBranchChange(() => tui.requestRender()) : () => {};

      return {
        dispose: unsub,
        invalidate() {
          // no cache
        },
        render(width: number): string[] {
          // --- Token / usage stats from sessionManager ---
          let input = 0,
            output = 0,
            cost = 0;
          try {
            for (const e of ctx.sessionManager.getBranch()) {
              if (e.type === "message" && (e.message as any)?.role === "assistant") {
                const m = e.message as any;
                if (m?.usage) {
                  input += (m.usage.input || 0) as number;
                  output += (m.usage.output || 0) as number;
                  cost += (m.usage.cost?.total || 0) as number;
                }
              }
            }
          } catch {
            // ignore if sessionManager not available
          }

          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

          // Left side: Agency label, item count, token stats
          const left =
            theme.fg("accent", "Agency") +
            " " +
            theme.fg("muted", `items=${items.length}`) +
            " " +
            theme.fg("dim", `↑${fmt(input)}↓${fmt(output)} $${cost.toFixed(3)}`);

          // Right side: model id, branch, cwd
          const branch = typeof footerData.getGitBranch === "function" ? footerData.getGitBranch() : null;
          const branchStr = branch ? ` branch=${branch}` : "";
          const cwdBase = ctx.cwd ? path.basename(ctx.cwd) : null;
          const cwdStr = cwdBase ? ` cwd=${cwdBase}` : "";
          const right = theme.fg("dim", `${ctx.model?.id || "no-model"}${branchStr}${cwdStr}`);

          const firstLine = truncateToWidth(
            left + " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right))) + right,
            width,
          );

          // Secondary line: extension statuses with their ids
          const statusesMap: ReadonlyMap<string, string> | undefined =
            typeof footerData.getExtensionStatuses === "function" ? footerData.getExtensionStatuses() : undefined;

          let secondLine = "";
          if (statusesMap) {
            const entries = Array.from(statusesMap.entries()).map(([id, text]) => `${id}=${text}`);
            if (entries.length > 0) {
              const joined = entries.join(" • ");
              secondLine = truncateToWidth(theme.fg("dim", joined), width);
            }
          }

          return secondLine ? [firstLine, secondLine] : [firstLine];
        },
      };
    };
  }

  pi.registerCommand("agency", {
    description: "Toggle the agency widget or add items: /agency add <text> (use 'footer' to toggle footer)",
    handler: async (args: string | string[] | undefined, ctx) => {
      // args may be a single raw string or an array depending on host. Normalize to a single string.
      const rawArgs = typeof args === "string" ? args.trim() : Array.isArray(args) ? args.join(" ").trim() : "";
      const parts = rawArgs ? rawArgs.split(/\s+/) : [];
      const verb = parts[0];

      if (verb === "add") {
        const text = parts.slice(1).join(" ").trim();
        if (!text) {
          ctx.ui.notify("Usage: /agency add <text>", "warning");
          return;
        }
        items.push(text);
        ctx.ui.notify(`Added (${items.length}): ${text}`, "info");
        // If visible, update widget lines directly using themed lines (preferred over requestRender)
        if (visible) {
          const theme = ctx.ui.theme;
          let lines: string[];
          if (items.length === 0) {
            lines = [theme.fg("muted", "(agency) no items — use /agency add <text> to add")];
          } else {
            lines = [theme.fg("accent", "Agency"), ""];
            for (let i = 0; i < items.length; i++) {
              const prefix = theme.fg("dim", `${i + 1}. `);
              lines.push(prefix + items[i]);
            }
          }
          ctx.ui.setWidget("agency", lines);
        }
        // If footer is active (widget visible), re-register it so counts update immediately
        if (visible) ctx.ui.setFooter(makeFooterFactory(ctx));
        return;
      }

      if (verb === "footer") {
        // Toggle a custom footer for the agency extension
        footerEnabled = !footerEnabled;
        if (footerEnabled) {
          ctx.ui.setFooter(makeFooterFactory(ctx));
          ctx.ui.notify("Agency footer enabled", "info");
        } else {
          ctx.ui.setFooter(undefined);
          ctx.ui.notify("Agency footer disabled", "info");
        }
        return;
      }

      // Toggle widget
      if (!visible) {
        ctx.ui.setWidget("agency", makeWidgetFactory(ctx));
        // Ensure the custom footer is active whenever the widget is shown
        ctx.ui.setFooter(makeFooterFactory(ctx));
        visible = true;
        ctx.ui.notify("Agency widget shown", "info");
      } else {
        ctx.ui.setWidget("agency", undefined);
        ctx.ui.setFooter(undefined);
        visible = false;
        ctx.ui.notify("Agency widget hidden", "info");
      }
    },
  });

  // Clean up on session end
  pi.on("session_shutdown", (_event, ctx) => {
    // Ensure the UI is cleared of any agency artifacts
    if (ctx?.ui) {
      try {
        ctx.ui.setWidget("agency", undefined);
        ctx.ui.setFooter(undefined);
      } catch (e) {
        // ignore - some hosts may not provide full UI on shutdown
      }
    }

    visible = false;
    footerEnabled = false;
  });
}
