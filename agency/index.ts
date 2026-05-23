/**
 * Agency extension
 *
 * Simple experiment showing a persistent widget above the editor (Pattern 5).
 * - /agency           Toggle the widget on/off
 * - /agency add TEXT  Add a line to the widget list
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  let visible = false;
  const items: string[] = [];

  function makeWidgetFactory(ctx: ExtensionCommandContext) {
    return (tui: any, theme: any) => {
      let cachedWidth: number | undefined;
      let cachedLines: string[] | undefined;

      function buildLines(width: number): string[] {
        if (cachedLines && cachedWidth === width) return cachedLines;

        if (items.length === 0) {
          cachedLines = [theme.fg("muted", "(agency) no items — use /agency add <text> to add")];
          cachedWidth = width;
          return cachedLines;
        }

        const lines: string[] = [theme.fg("accent", "Agency"), ""];
        for (let i = 0; i < items.length; i++) {
          const prefix = theme.fg("dim", `${i + 1}. `);
          const text = items[i];
          lines.push(prefix + text);
        }

        // Truncate each line to the available width using truncateToWidth (ANSI-aware)
        cachedLines = lines.map((l) => truncateToWidth(l, width));
        cachedWidth = width;
        return cachedLines;
      }

      return {
        render: (w: number) => buildLines(w),
        invalidate: () => {
          cachedWidth = undefined;
          cachedLines = undefined;
        },
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
        // If visible, update widget lines directly using themed lines (preferred over requestRender)
        if (visible) {
          // Re-register the factory so the widget updates (caches cleared via factory.invalidate)
          ctx.ui.setWidget("agency", makeWidgetFactory(ctx), { placement: "belowEditor" });
        }
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

  // Clean up on session end
  pi.on("session_shutdown", (_event, ctx) => {
    // Ensure the UI is cleared of any agency artifacts
    if (ctx?.ui) {
      try {
        ctx.ui.setWidget("agency", undefined);
      } catch (e) {
        // ignore - some hosts may not provide full UI on shutdown
      }
    }

    visible = false;
  });
}
