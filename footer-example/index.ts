/**
 * Custom Footer Extension - demonstrates ctx.ui.setFooter()
 *
 * footerData exposes data not otherwise accessible:
 * - getGitBranch(): current git branch
 * - getExtensionStatuses(): texts from ctx.ui.setStatus()
 *
 * Token stats come from ctx.sessionManager/ctx.model (already accessible).
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  let enabled = false;

  pi.registerCommand("footer", {
    description: "Toggle custom footer",
    handler: async (_args, ctx) => {
      enabled = !enabled;

      if (enabled) {
        ctx.ui.setFooter((tui, theme, footerData) => {
          const unsub = footerData.onBranchChange(() => tui.requestRender());

          return {
            dispose: unsub,
            invalidate() {},
            render(width: number): string[] {
              // Compute tokens from ctx.sessionManager (if available)
              let input = 0,
                output = 0,
                cost = 0;
              for (const e of ctx.sessionManager.getBranch()) {
                if (e.type === "message" && (e.message as any).role === "assistant") {
                  const m = e.message as AssistantMessage;
                  // usage may be undefined in some hosts; guard
                  if (m?.usage) {
                    input += (m.usage.input || 0) as number;
                    output += (m.usage.output || 0) as number;
                    cost += (m.usage.cost?.total || 0) as number;
                  }
                }
              }

              const branch = footerData.getGitBranch();
              const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

              const left = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);
              const branchStr = branch ? ` (${branch})` : "";
              const right = theme.fg("dim", `${ctx.model?.id || "no-model"}${branchStr}`);

              const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
              return [truncateToWidth(left + pad + right, width)];
            },
          };
        });
        ctx.ui.notify("Custom footer enabled", "info");
      } else {
        ctx.ui.setFooter(undefined);
        ctx.ui.notify("Default footer restored", "info");
      }
    },
  });
}
