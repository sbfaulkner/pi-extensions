import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SEARCH_TIMEOUT_MS = 30_000;
const REDIRECT_TIMEOUT_MS = 5_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_EXTRACTED_TEXT = 20_000;
const MIN_EXTRACTED_TEXT = 50;

const REDIRECT_PATTERN = "vertexaisearch.cloud.google.com/grounding-api-redirect/";

const BINARY_CONTENT_TYPES = [
  "image/",
  "audio/",
  "video/",
  "font/",
  "model/",
  "application/pdf",
  "application/zip",
  "application/octet-stream",
  "application/wasm",
];

const FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

// Elements whose subtrees should be removed entirely
const STRIP_ELEMENTS_RE =
  /<(script|style|nav|header|footer|aside|head|svg|form|iframe|noscript|link|meta)\b[^>]*>[\s\S]*?<\/\1>/gi;

// HTML entity decoding
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&#x27;": "'",
  "&#x2F;": "/",
};
const ENTITY_RE = new RegExp(Object.keys(ENTITIES).join("|"), "gi");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout(ms: number, signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

function isAuthError(code?: number, message?: string): boolean {
  if (code === 401 || code === 403) return true;
  if (message && /(expired|unauthorized|permission)/i.test(message)) return true;
  return false;
}

function formatAuthError(): string {
  return (
    "Your GEMINI_API_KEY may be invalid or expired. " +
    "Get a free key at https://aistudio.google.com/apikey"
  );
}

// ---------------------------------------------------------------------------
// Gemini grounding
// ---------------------------------------------------------------------------

interface Source {
  title: string;
  uri: string;
}

async function resolveRedirects(
  sources: Source[],
  signal?: AbortSignal,
): Promise<Source[]> {
  const results = await Promise.allSettled(
    sources.map(async (src) => {
      if (!src.uri.includes(REDIRECT_PATTERN)) return src;
      try {
        const res = await fetch(src.uri, {
          redirect: "follow",
          signal: withTimeout(REDIRECT_TIMEOUT_MS, signal),
        });
        const resolvedUri = res.url;
        await res.body?.cancel();
        return { title: src.title, uri: resolvedUri };
      } catch {
        return src; // keep original on failure
      }
    }),
  );

  const resolved = results
    .filter((r): r is PromiseFulfilledResult<Source> => r.status === "fulfilled")
    .map((r) => r.value);

  // Deduplicate by URI
  const seen = new Set<string>();
  return resolved.filter((s) => {
    if (seen.has(s.uri)) return false;
    seen.add(s.uri);
    return true;
  });
}

async function callGemini(
  query: string,
  detailed: boolean,
  signal?: AbortSignal,
): Promise<{ text: string; sources: Source[] }> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
        "Get a free key at https://aistudio.google.com/apikey",
    );
  }

  const prompt = detailed
    ? `Search for: ${query}\n\nFor each result, provide:\n- Title and the full original URL (not a redirect URL)\n- A detailed summary of the key information from that page\n- Any code examples, commands, or specific steps mentioned\n\nAlways include the actual source URL for every piece of information. Be thorough.`
    : `Search for: ${query}\n\nReturn a concise list of the most relevant results. For each result give the title, the full original URL (not a redirect URL), and a one-line description. Always include the actual source URL for every piece of information.`;

  const combinedSignal = withTimeout(SEARCH_TIMEOUT_MS, signal);

  const response = await fetch(
    `${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
      signal: combinedSignal,
    },
  );

  let data: any;
  try {
    data = await response.json();
  } catch {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gemini API returned non-JSON response (${response.status} ${response.statusText}): ${text.slice(0, 200)}`,
    );
  }

  if (data.error) {
    if (isAuthError(data.error.code, data.error.message)) {
      throw new Error(formatAuthError());
    }
    throw new Error(data.error.message || "Unknown Gemini API error");
  }

  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const chunks: Array<{ web?: { title: string; uri: string } }> =
    data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const rawSources = chunks
    .map((c) => c.web)
    .filter((x): x is Source => !!(x && x.title && x.uri));

  const sources = await resolveRedirects(rawSources, signal);

  return { text: answer, sources };
}

// ---------------------------------------------------------------------------
// HTML-to-text extraction
// ---------------------------------------------------------------------------

function htmlToText(html: string): string {
  let text = html;
  // Remove non-content element subtrees
  text = text.replace(STRIP_ELEMENTS_RE, " ");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode entities
  text = text.replace(ENTITY_RE, (m) => ENTITIES[m.toLowerCase()] || m);
  // Decode numeric entities
  text = text.replace(/&#(\d+);/g, (_, n) => {
    const cp = Number(n);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  });
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
    const cp = parseInt(h, 16);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  });
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ---------------------------------------------------------------------------
// web_fetch
// ---------------------------------------------------------------------------

class BlockedDomainError extends Error {
  domain: string;
  constructor(domain: string) {
    super(`Domain "${domain}" is not in the network allowlist. Add it to continue.`);
    this.domain = domain;
  }
}

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024; // 2MB max download

async function readWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        chunks.push(value.slice(0, value.byteLength - (totalBytes - maxBytes)));
        break;
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }

  const decoder = new TextDecoder();
  return chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();
}

async function fetchPageText(url: string, signal?: AbortSignal): Promise<string> {
  // Validate URL scheme
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol} (only http and https are supported)`);
  }

  // Check fetch guard hook
  const hook = (globalThis as any).__piFetchReviewHook;
  if (typeof hook === "function") {
    await hook(url);
  }

  const combinedSignal = withTimeout(FETCH_TIMEOUT_MS, signal);

  const response = await fetch(url, {
    headers: { "User-Agent": FETCH_USER_AGENT },
    redirect: "follow",
    signal: combinedSignal,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const lowerCT = contentType.toLowerCase();

  // Reject binary content types
  for (const binary of BINARY_CONTENT_TYPES) {
    if (lowerCT.includes(binary)) {
      throw new Error(`Cannot extract text from binary content type: ${contentType}`);
    }
  }

  const html = await readWithLimit(response, MAX_DOWNLOAD_BYTES);

  // Detect sandbox allowlist blocks
  if (html.includes("blocked-by-allowlist") || html.includes("domain is not allowed")) {
    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }
    throw new BlockedDomainError(domain);
  }

  const text = htmlToText(html);

  if (text.length < MIN_EXTRACTED_TEXT) {
    throw new Error("Could not extract meaningful content from the page.");
  }

  return text.slice(0, MAX_EXTRACTED_TEXT);
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatSources(sources: Source[]): string {
  if (sources.length === 0) return "";
  return (
    "\n\n## Sources\n" +
    sources.map((s, i) => `${i + 1}. ${s.title} — ${s.uri}`).join("\n")
  );
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web using Google Search. Returns summarized results with source URLs.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
    }),
    async execute(_id, params, signal) {
      try {
        const { text, sources } = await callGemini(params.query, false, signal);
        return {
          content: [{ type: "text", text: text + formatSources(sources) }],
          details: { sources: sources.length },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err?.message || String(err) }],
          details: { error: true },
        };
      }
    },
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(theme.bold("web_search") + " " + theme.fg("muted", args.query));
      return text;
    },
    renderResult(result, _opts, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(
        context.isError || result.details?.error
          ? theme.fg("error", "✗")
          : theme.fg("success", `✓ ${result.details?.sources ?? 0} sources`),
      );
      return text;
    },
  });

  pi.registerTool({
    name: "web_search_summary",
    label: "Web Search (Summary)",
    description: "Search the web and return detailed summaries of each result.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
    }),
    async execute(_id, params, signal) {
      try {
        const { text, sources } = await callGemini(params.query, true, signal);
        return {
          content: [{ type: "text", text: text + formatSources(sources) }],
          details: { sources: sources.length },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: err?.message || String(err) }],
          details: { error: true },
        };
      }
    },
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(
        theme.bold("web_search_summary") + " " + theme.fg("muted", args.query),
      );
      return text;
    },
    renderResult(result, _opts, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(
        context.isError || result.details?.error
          ? theme.fg("error", "✗")
          : theme.fg("success", `✓ ${result.details?.sources ?? 0} sources`),
      );
      return text;
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description: "Fetch a URL and extract its readable text content.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
    }),
    async execute(_id, params, signal) {
      try {
        const extracted = await fetchPageText(params.url, signal);
        return {
          content: [{ type: "text", text: extracted }],
          details: { chars: extracted.length, url: params.url },
        };
      } catch (err: any) {
        if (err instanceof BlockedDomainError) {
          return {
            content: [{ type: "text", text: `Domain "${err.domain}" is not in the network allowlist. Add it to continue.` }],
            details: { error: true },
          };
        }
        return {
          content: [{ type: "text", text: err?.message || String(err) }],
          details: { error: true },
        };
      }
    },
    renderCall(args, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(theme.bold("web_fetch") + " " + theme.fg("muted", args.url));
      return text;
    },
    renderResult(result, _opts, theme, context) {
      const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
      text.setText(
        context.isError || result.details?.error
          ? theme.fg("error", "✗")
          : theme.fg("success", `✓ ${result.details?.chars ? result.details.chars + " chars" : ""}`),
      );
      return text;
    },
  });
}
