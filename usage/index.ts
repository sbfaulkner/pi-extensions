import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const GITHUB_API_VERSION = "2026-03-10";
const GITHUB_COPILOT_PROVIDER = "github-copilot";

type UsageInfo = {
  statusText: string;
};

type BillingUsageItem = Record<string, unknown>;

type AiCreditUsage = {
  credits?: number;
  grossAmount?: number;
  netAmount?: number;
};

type LegacyPremiumRequestUsage = {
  requests: number;
};

// Map to track usage by provider.
const usageByProvider: Map<string, UsageInfo> = new Map([
  [GITHUB_COPILOT_PROVIDER, { statusText: "usage unavailable" }],
]);

function getStatusText(provider: string) {
  const info = usageByProvider.get(provider);
  if (!info) return "";

  return `${info.statusText} (${provider})`;
}

function setUsageStatus(provider: string, statusText: string) {
  const info = usageByProvider.get(provider);
  if (!info) return;

  info.statusText = statusText;
}

function getCurrentUtcMonth() {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

function buildEndpoint(path: string, query: Record<string, string | number>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  return `${path}?${params.toString()}`;
}

function getString(item: BillingUsageItem, key: string) {
  const value = item[key];
  return typeof value === "string" ? value : "";
}

function getNumber(item: BillingUsageItem, key: string) {
  const value = item[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function firstNumber(item: BillingUsageItem, keys: string[]) {
  for (const key of keys) {
    const value = getNumber(item, key);
    if (value !== undefined) return value;
  }

  return undefined;
}

function getUsageItems(data: unknown): BillingUsageItem[] | undefined {
  if (typeof data !== "object" || data === null) return undefined;

  const response = data as Record<string, unknown>;
  const items = response.usageItems ?? response.usage_items;
  if (!Array.isArray(items)) return undefined;

  return items.filter((item): item is BillingUsageItem => typeof item === "object" && item !== null);
}

function itemSearchText(item: BillingUsageItem) {
  return [getString(item, "product"), getString(item, "sku"), getString(item, "unitType"), getString(item, "unit_type")]
    .join(" ")
    .toLowerCase();
}

function isAiCreditItem(item: BillingUsageItem) {
  if (firstNumber(item, ["aicQuantity", "aic_quantity", "aiCreditQuantity", "ai_credit_quantity"]) !== undefined) {
    return true;
  }

  const text = itemSearchText(item);
  return text.includes("ai credit") || text.includes("aic") || text.includes("credit");
}

function isPremiumRequestItem(item: BillingUsageItem) {
  const text = itemSearchText(item);
  return text.includes("premium request") || text.includes("premium_request") || text.includes("requests");
}

function sumNumbers(items: BillingUsageItem[], keys: string[]) {
  let total = 0;
  let found = false;

  for (const item of items) {
    const value = firstNumber(item, keys);
    if (value === undefined) continue;

    total += value;
    found = true;
  }

  return found ? total : undefined;
}

function parseAiCreditUsage(data: unknown): AiCreditUsage | undefined {
  const items = getUsageItems(data);
  if (!items) return undefined;
  if (items.length === 0) return { credits: 0 };

  const aiCreditItems = items.filter(isAiCreditItem);
  if (aiCreditItems.length === 0) return undefined;

  const credits = sumNumbers(aiCreditItems, [
    "aicQuantity",
    "aic_quantity",
    "aiCreditQuantity",
    "ai_credit_quantity",
    "grossQuantity",
    "gross_quantity",
    "quantity",
  ]);
  const grossAmount = sumNumbers(aiCreditItems, ["aicGrossAmount", "aic_gross_amount", "grossAmount", "gross_amount"]);
  const netAmount = sumNumbers(aiCreditItems, ["aicNetAmount", "aic_net_amount", "netAmount", "net_amount"]);

  if (credits === undefined && grossAmount === undefined && netAmount === undefined) return undefined;

  return { credits, grossAmount, netAmount };
}

function parseLegacyPremiumRequestUsage(data: unknown): LegacyPremiumRequestUsage | undefined {
  const items = getUsageItems(data);
  if (!items) return undefined;
  if (items.length === 0) return { requests: 0 };

  const premiumRequestItems = items.filter(isPremiumRequestItem);
  if (premiumRequestItems.length === 0) return undefined;

  const requests = sumNumbers(premiumRequestItems, [
    "grossQuantity",
    "gross_quantity",
    "quantity",
    "netQuantity",
    "net_quantity",
  ]);
  if (requests === undefined) return undefined;

  return { requests };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAiCreditStatus(usage: AiCreditUsage) {
  const parts: string[] = [];

  if (usage.credits !== undefined) {
    parts.push(formatNumber(usage.credits));
  }

  if (usage.grossAmount !== undefined) {
    parts.push(formatCurrency(usage.grossAmount));
  }

  if (usage.netAmount !== undefined && usage.netAmount > 0) {
    parts.push(`${formatCurrency(usage.netAmount)} billed`);
  }

  return parts.join(" · ") || "0";
}

function formatLegacyPremiumRequestStatus(usage: LegacyPremiumRequestUsage) {
  return `${formatNumber(Math.floor(usage.requests))} premium requests`;
}

async function ghApiJson(execFileAsync: typeof import("node:child_process").execFile.__promisify__, endpoint: string) {
  const { stdout } = await execFileAsync("gh", ["api", "-H", `X-GitHub-Api-Version: ${GITHUB_API_VERSION}`, endpoint]);
  return JSON.parse(stdout);
}

async function updateGitHubCopilotUsage() {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const { stdout: username } = await execFileAsync("gh", ["api", "/user", "--jq", ".login"]);
  const user = username.trim();
  const { year, month } = getCurrentUtcMonth();
  const encodedUser = encodeURIComponent(user);

  const aiCreditEndpoint = buildEndpoint(`/users/${encodedUser}/settings/billing/usage/summary`, {
    year,
    month,
    product: "copilot",
  });
  const aiCreditUsage = parseAiCreditUsage(await ghApiJson(execFileAsync, aiCreditEndpoint));
  if (aiCreditUsage) {
    setUsageStatus(GITHUB_COPILOT_PROVIDER, formatAiCreditStatus(aiCreditUsage));
    return;
  }

  // Annual Copilot Pro/Pro+ subscribers may still be on legacy premium-request billing.
  const legacyEndpoint = buildEndpoint(`/users/${encodedUser}/settings/billing/premium_request/usage`, {
    year,
    month,
    product: "copilot",
  });
  const legacyUsage = parseLegacyPremiumRequestUsage(await ghApiJson(execFileAsync, legacyEndpoint));
  if (legacyUsage) {
    setUsageStatus(GITHUB_COPILOT_PROVIDER, formatLegacyPremiumRequestStatus(legacyUsage));
    return;
  }

  setUsageStatus(GITHUB_COPILOT_PROVIDER, "usage unavailable");
}

async function updateUsage(provider: string) {
  if (!usageByProvider.has(provider)) return;

  switch (provider) {
    case GITHUB_COPILOT_PROVIDER:
      try {
        await updateGitHubCopilotUsage();
      } catch (error) {
        setUsageStatus(provider, "usage unavailable");
        console.error("Failed to fetch GitHub Copilot usage:", error);
      }
      break;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const provider = ctx.model?.provider;

    if (!provider || !usageByProvider.has(provider)) {
      ctx.ui.setStatus("provider-usage", undefined);
      return;
    }

    await updateUsage(provider);

    ctx.ui.setStatus("provider-usage", ctx.ui.theme.fg("dim", getStatusText(provider)));
  });

  pi.on("turn_end", async (_event, ctx) => {
    const provider = ctx.model?.provider;

    if (!provider || !usageByProvider.has(provider)) return;

    await updateUsage(provider);

    ctx.ui.setStatus("provider-usage", ctx.ui.theme.fg("dim", getStatusText(provider)));
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("provider-usage", undefined);
  });
}
