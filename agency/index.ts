/**
 * Agency extension
 *
 * Simple experiment showing a persistent widget above the editor (Pattern 5).
 * - /agency           Toggle the widget on/off
 * - /agency add TEXT  Add a line to the widget list
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  let visible = false;
  let footerEnabled = false;
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
        return;
      }

      if (verb === "footer") {
        // Toggle a custom footer for the agency extension
        footerEnabled = !footerEnabled;
        if (footerEnabled) {
          ctx.ui.setFooter((tui, theme, footerData) => {
            const unsub = footerData.onBranchChange(() => tui.requestRender());

            return {
              dispose: unsub,
              invalidate() {},
              render(width: number): string[] {
                const themeLeft = theme.fg("accent", "Agency");
                const themeCount = theme.fg("muted", ` ${items.length} items`);
                const left = themeLeft + themeCount;

                const branch = footerData.getGitBranch();
                const branchStr = branch ? ` (${branch})` : "";
                const right = theme.fg("dim", `${ctx.model?.id || "no-model"}${branchStr}`);

                const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
                return [truncateToWidth(left + pad + right, width)];
              },
            };
          });
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
        ctx.ui.setStatus("agency", ctx.ui.theme.fg("accent", "agency: on"));
        visible = true;
        ctx.ui.notify("Agency widget shown", "info");
      } else {
        ctx.ui.setWidget("agency", undefined);
        ctx.ui.setStatus("agency", undefined);
        visible = false;
        ctx.ui.notify("Agency widget hidden", "info");
      }
    },
  });

  // Clean up on session end
  pi.on("session_shutdown", () => {
    visible = false;
  });
}
