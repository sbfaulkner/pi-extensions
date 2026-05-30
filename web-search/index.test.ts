import assert from "node:assert/strict";
import test from "node:test";

type Handler = (...args: any[]) => unknown;
type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

let importCounter = 0;

async function loadWebSearchModule(apiKey?: string) {
  const originalApiKey = process.env.GEMINI_API_KEY;

  if (apiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = apiKey;
  }

  const mod = await import(`./index.ts?test=${Date.now()}-${importCounter++}`);

  return {
    mod,
    restoreEnv() {
      if (originalApiKey === undefined) {
        delete process.env.GEMINI_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = originalApiKey;
      }
    },
  };
}

function createPi() {
  const tools = new Map<string, any>();
  const handlers = new Map<string, Handler[]>();

  const pi = {
    registerTool(tool: any) {
      tools.set(tool.name, tool);
    },
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
  };

  return { pi, tools, handlers };
}

function createContext() {
  const notifications: Array<{ message: string; level: string }> = [];
  let abortCount = 0;

  return {
    notifications,
    get abortCount() {
      return abortCount;
    },
    ctx: {
      hasUI: true,
      ui: {
        notify(message: string, level: string) {
          notifications.push({ message, level });
        },
      },
      abort() {
        abortCount += 1;
      },
    },
  };
}

async function setupExtension(apiKey?: string) {
  const { mod, restoreEnv } = await loadWebSearchModule(apiKey);
  const harness = createPi();

  mod.default(harness.pi as any);

  return { ...harness, restoreEnv };
}

function installFetch(fetchImpl: typeof fetch) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("session_start warns when GEMINI_API_KEY is missing", async () => {
  const harness = await setupExtension();

  try {
    const { ctx, notifications } = createContext();

    for (const handler of harness.handlers.get("session_start") ?? []) {
      await handler({}, ctx);
    }

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].level, "warning");
    assert.match(notifications[0].message, /GEMINI_API_KEY environment variable is not set/);
  } finally {
    harness.restoreEnv();
  }
});

test("web_search aborts and notifies when GEMINI_API_KEY is missing", async () => {
  const harness = await setupExtension();

  try {
    const context = createContext();

    await assert.rejects(
      () =>
        harness.tools
          .get("web_search")
          .execute("tool-call", { query: "pi extensions" }, undefined, undefined, context.ctx),
      { name: "AbortError", message: /GEMINI_API_KEY is not set/ },
    );

    assert.equal(context.abortCount, 1);
    assert.equal(context.notifications.length, 1);
    assert.equal(context.notifications[0].level, "error");
    assert.match(context.notifications[0].message, /GEMINI_API_KEY environment variable is not set/);
  } finally {
    harness.restoreEnv();
  }
});

test("search tools call Gemini with concise and detailed prompts", async () => {
  const calls: Array<{ url: string; body: any }> = [];
  const restoreFetch = installFetch(async (input: FetchInput, init: FetchInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: "Search answer" }] },
            groundingMetadata: {
              groundingChunks: [
                { web: { title: "Pi Docs", uri: "https://example.com/pi" } },
                { web: { title: "Pi Docs Duplicate", uri: "https://example.com/pi" } },
              ],
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  const harness = await setupExtension("test-key");

  try {
    const searchResult = await harness.tools
      .get("web_search")
      .execute("tool-call", { query: "pi testing" }, undefined, undefined, {});
    const summaryResult = await harness.tools
      .get("web_search_summary")
      .execute("tool-call", { query: "pi testing" }, undefined, undefined, {});

    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
    assert.match(calls[0].url, /key=test-key/);
    assert.match(calls[0].body.contents[0].parts[0].text, /Return a concise list/);
    assert.match(calls[1].body.contents[0].parts[0].text, /provide:\n- Title/);
    assert.match(calls[1].body.contents[0].parts[0].text, /detailed summary/);

    assert.equal(searchResult.details.sources, 1);
    assert.match(searchResult.content[0].text, /Search answer/);
    assert.match(searchResult.content[0].text, /1\. Pi Docs — https:\/\/example\.com\/pi/);
    assert.equal(summaryResult.details.sources, 1);
  } finally {
    restoreFetch();
    harness.restoreEnv();
  }
});

test("web_fetch extracts readable text from HTML", async () => {
  const restoreFetch = installFetch(async (input: FetchInput) => {
    assert.equal(String(input), "https://example.com/page");

    return new Response(
      `<!doctype html>
<html>
  <head><title>Hidden title</title><script>console.log("skip")</script></head>
  <body>
    <nav>Skip navigation links</nav>
    <main>
      <h1>Main &amp; Title</h1>
      <p>Useful paragraph with more than enough readable content to pass the minimum extraction length.</p>
    </main>
    <footer>Skip footer text</footer>
  </body>
</html>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  });
  const harness = await setupExtension("test-key");

  try {
    const result = await harness.tools
      .get("web_fetch")
      .execute("tool-call", { url: "https://example.com/page" }, undefined, undefined, {});

    assert.equal(result.details.url, "https://example.com/page");
    assert.equal(result.details.chars, result.content[0].text.length);
    assert.match(result.content[0].text, /Main & Title/);
    assert.match(result.content[0].text, /Useful paragraph/);
    assert.doesNotMatch(result.content[0].text, /Skip navigation/);
    assert.doesNotMatch(result.content[0].text, /console\.log/);
  } finally {
    restoreFetch();
    harness.restoreEnv();
  }
});

test("web_fetch reports allowlist blocks with the requested hostname", async () => {
  const restoreFetch = installFetch(async () => {
    return new Response("blocked-by-allowlist", { status: 200, headers: { "content-type": "text/html" } });
  });
  const harness = await setupExtension("test-key");

  try {
    const result = await harness.tools
      .get("web_fetch")
      .execute("tool-call", { url: "https://blocked.example/path" }, undefined, undefined, {});

    assert.deepEqual(result.details, { error: true });
    assert.equal(
      result.content[0].text,
      'Domain "blocked.example" is not in the network allowlist. Add it to continue.',
    );
  } finally {
    restoreFetch();
    harness.restoreEnv();
  }
});

test("web_fetch rejects binary content types", async () => {
  const restoreFetch = installFetch(async () => {
    return new Response("binary", { status: 200, headers: { "content-type": "application/pdf" } });
  });
  const harness = await setupExtension("test-key");

  try {
    const result = await harness.tools
      .get("web_fetch")
      .execute("tool-call", { url: "https://example.com/file.pdf" }, undefined, undefined, {});

    assert.deepEqual(result.details, { error: true });
    assert.equal(result.content[0].text, "Cannot extract text from binary content type: application/pdf");
  } finally {
    restoreFetch();
    harness.restoreEnv();
  }
});
