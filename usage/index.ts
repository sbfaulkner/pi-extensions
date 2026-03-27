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

async function updateUsage(provider: string) {
  const info = usageByProvider.get(provider)!;

  switch (provider) {
    case "github-copilot":
      try {
        // Get authenticated user
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);
        
        const { stdout: username } = await execAsync("gh api /user --jq '.login'");
        const user = username.trim();
        
        // Fetch current usage for Copilot Pro
        const { stdout: usageData } = await execAsync(
          `gh api "/users/${user}/settings/billing/usage/summary?product=copilot&sku=copilot_premium_request"`
        );
        
        const data = JSON.parse(usageData);
        if (data.usageItems && data.usageItems.length > 0) {
          info.usage = Math.floor(data.usageItems[0].grossQuantity);
        }
      } catch (error) {
        // Silently fail if we can't fetch usage (e.g., gh not authenticated)
        console.error("Failed to fetch GitHub Copilot usage:", error);
      }
      break;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const provider = ctx.model?.provider;
    
    if (provider && usageByProvider.has(provider)) {
      await updateUsage(provider);
    }
    
    ctx.ui.setStatus("provider-usage", ctx.ui.theme.fg("dim", getStatusText()));
  });

  pi.on("turn_end", async (_event, ctx) => {
    const provider = ctx.model?.provider;
    
    if (!provider || !usageByProvider.has(provider)) return;

    await updateUsage(provider);

    ctx.ui.setStatus("provider-usage", ctx.ui.theme.fg("dim", getStatusText()));
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("provider-usage", undefined);
  });
}