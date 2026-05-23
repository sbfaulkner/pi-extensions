/**
 * Agency extension
 *
 * Simple experiment showing a persistent widget above the editor (Pattern 5).
 * - /agency           Toggle the widget on/off
 * - /agency add TEXT  Add a line to the widget list
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

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

  pi.registerCommand("agency", {
    description: "Toggle the agency widget or add items: /agency add <text>",
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
        // If visible, request a re-render
        if (visible) ctx.ui.requestRender();
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
