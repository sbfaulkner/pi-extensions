import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Map to track usage by provider
const usageByProvider: Map<string, { usage: number; limit?: number }> = new Map([
  ["github-copilot", { usage: 0, limit: 300 }],
]);

function getStatusText() {
  // Aggregate status for all supported providers
  return Array.from(usageByProvider.entries())
    .map(([provider, info]) => {
      const limitText = info.limit ? `/${info.limit}` : "";
      return `${info.usage}${limitText} (${provider})`;
    })
    .join(" | ");
}

function updateUsage(provider: string) {
  const info = usageByProvider.get(provider)!;

  switch (provider) {
    case "github-copilot":
      // TODO: fetch actual usage data from the provider's API instead of incrementing locally
      // gh api /users/sbfaulkner/settings/billing/premium_request/usage

      // Increment usage for the matched provider
      
      info.usage += 1;
      break;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("provider-usage", ctx.ui.theme.fg("dim", getStatusText()));
  });

  pi.on("turn_end", async (_event, ctx) => {
    const provider = ctx.model?.provider;
    
    if (!provider || !usageByProvider.has(provider)) return;

    updateUsage(provider);

    ctx.ui.setStatus("provider-usage", ctx.ui.theme.fg("dim", getStatusText()));
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("provider-usage", undefined);
  });
}