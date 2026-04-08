import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Text } from "@mariozechner/pi-tui";

// TODO: Replace with your Gemini API key or ensure the user sets GEMINI_API_KEY in their environment.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function withApiKey(url: string) {
  return `${url}?key=${encodeURIComponent(GEMINI_API_KEY || "")}`;
}

async function callGemini(query: string, detailed: boolean, signal?: AbortSignal): Promise<{ text: string, sources: { title: string, uri: string }[] }> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable is not set.");
  const prompt = detailed
    ? `Search for: ${query}\n\nFor each result, provide:\n- Title and the full original URL (not a redirect URL)\n- A detailed summary of the key information from that page\n- Any code examples, commands, or specific steps mentioned\n\nAlways include the actual source URL for every piece of information. Be thorough.`
    : `Search for: ${query}\n\nReturn a concise list of the most relevant results. For each result give the title, the full original URL (not a redirect URL), and a one-line description. Always include the actual source URL for every piece of information.`;

  const body = JSON.stringify({
    contents: [
      { role: "user", parts: [{ text: prompt }] }
    ],
    tools: [{ google_search: {} }]
  });
  const response = await fetch(withApiKey(GEMINI_ENDPOINT), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Unknown Gemini API error");
  const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Extract sources (titles + uris)
  const chunks: Array<any> = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map((c: any) => c.web).filter((x: any) => x && x.title && x.uri);
  return { text: answer, sources };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Search the web using Google Search. Returns summarized results with source URLs.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" })
    }),
    async execute(_id, params, signal) {
      try {
        const { text, sources } = await callGemini(params.query, false, signal);
        let formattedSources = sources.length
          ? "\n\n## Sources\n" + sources.map((s, i) => `${i+1}. ${s.title} — ${s.uri}`).join("\n")
          : "";
        return { content: [{ type: "text", text: text + formattedSources }], details: { sources: sources.length } };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `Web search error: ${e.message}` }], details: { error: true } };
      }
    },
    renderCall(args, theme) {
      return Text.bold("web_search") + Text.muted(" " + args.query.slice(0, 80));
    },
    renderResult(result, _opts, theme) {
      return result.isError ? "✗" : `✓ ${result.details?.sources ?? 0} sources`;
    }
  });

  pi.registerTool({
    name: "web_search_summary",
    label: "Web Search (Summary)",
    description: "Search the web and return detailed summaries of each result.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" })
    }),
    async execute(_id, params, signal) {
      try {
        const { text, sources } = await callGemini(params.query, true, signal);
        let formattedSources = sources.length
          ? "\n\n## Sources\n" + sources.map((s, i) => `${i+1}. ${s.title} — ${s.uri}`).join("\n")
          : "";
        return { content: [{ type: "text", text: text + formattedSources }], details: { sources: sources.length } };
      } catch (e: any) {
        return { isError: true, content: [{ type: "text", text: `Web search error: ${e.message}` }], details: { error: true } };
      }
    },
    renderCall(args, theme) {
      return Text.bold("web_search_summary") + Text.muted(" " + args.query.slice(0, 80));
    },
    renderResult(result, _opts, theme) {
      return result.isError ? "✗" : `✓ ${result.details?.sources ?? 0} sources`;
    }
  });

  // TODO: Implement `web_fetch` — for now, registering a stub that just returns an error.
  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description: "Fetch a URL and extract its readable text content.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" })
    }),
    async execute(_id, params, signal) {
      return { isError: true, content: [{ type: "text", text: "web_fetch not yet implemented." }], details: { error: true } };
    },
    renderCall(args, theme) {
      return Text.bold("web_fetch") + Text.muted(" " + args.url.slice(0, 80));
    },
    renderResult(result, _opts, theme) {
      return result.isError ? "✗" : `✓ ${result.details?.chars ? result.details.chars + ' chars' : ''}`;
    }
  });
}
