import assert from "node:assert/strict";
import * as path from "node:path";
import test from "node:test";
import {
  checkRepo,
  createFreshnessExtension,
  enumerateCandidateRoots,
  formatAnnouncement,
  gatherFreshness,
  isOfflineModeEnabled,
  type FreshnessDependencies,
} from "./index.ts";

type GitCall = { cwd: string; args: string[] };
type GitResponse = { stdout: string; code: number };
type GitStub = (cwd: string, args: string[]) => GitResponse | Promise<GitResponse>;

const HOME = "/home/test";
const PI_DIR = `${HOME}/.pi`;
const EXT_DIR = `${PI_DIR}/agent/extensions`;
const SKILL_DIR = `${PI_DIR}/agent/skills`;

function createGitRecorder(stub: GitStub) {
  const calls: GitCall[] = [];
  const runGit: NonNullable<FreshnessDependencies["runGit"]> = async (cwd, args) => {
    calls.push({ cwd, args });
    return await stub(cwd, args);
  };
  return { calls, runGit };
}

function notFound(): GitResponse {
  return { stdout: "", code: 128 };
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("enumerateCandidateRoots filters realpaths under ~/.pi", async () => {
  const symlinkMap: Record<string, string> = {
    [`${EXT_DIR}/local`]: "/home/test/src/pi-extensions",
    [`${EXT_DIR}/managed`]: `${PI_DIR}/agent/git/github.com/x/y`,
    [`${EXT_DIR}/inside-pi`]: PI_DIR, // exact match
    [`${SKILL_DIR}/skill-a`]: "/home/test/src/other-repo",
    [`${SKILL_DIR}/non-git`]: "/home/test/.claude/skills/quick",
  };

  const deps: FreshnessDependencies = {
    homeDir: () => HOME,
    listDir: async (dir) => {
      if (dir === EXT_DIR) return ["local", "managed", "inside-pi"];
      if (dir === SKILL_DIR) return ["skill-a", "non-git"];
      return [];
    },
    realpath: async (p) => symlinkMap[p] ?? p,
    runGit: async (cwd, args) => {
      if (args[0] !== "rev-parse" || args[1] !== "--show-toplevel") return notFound();
      if (cwd === "/home/test/.claude/skills/quick") return notFound();
      return { stdout: `${cwd}\n`, code: 0 };
    },
  };

  const roots = await enumerateCandidateRoots(deps);
  assert.deepEqual(roots, ["/home/test/src/other-repo", "/home/test/src/pi-extensions"]);
});

test("enumerateCandidateRoots de-dups distinct entries pointing at the same git root", async () => {
  const deps: FreshnessDependencies = {
    homeDir: () => HOME,
    listDir: async (dir) => (dir === EXT_DIR ? ["a", "b"] : []),
    realpath: async (p) => (p === `${EXT_DIR}/a` ? "/repo/sub/a" : "/repo/sub/b"),
    runGit: async (_cwd, args) => {
      if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
        return { stdout: "/repo\n", code: 0 };
      }
      return notFound();
    },
  };
  const roots = await enumerateCandidateRoots(deps);
  assert.deepEqual(roots, ["/repo"]);
});

test("checkRepo reports behind count when upstream is strictly ahead", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
    if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
    if (key === "ls-remote origin main") return { stdout: "bbb\trefs/heads/main\n", code: 0 };
    if (key === "merge-base --is-ancestor aaa bbb") return { stdout: "", code: 0 };
    if (key === "rev-list --count aaa..bbb") return { stdout: "3\n", code: 0 };
    return notFound();
  });
  const status = await checkRepo("/repo", runGit);
  assert.deepEqual(status, { root: "/repo", name: "repo", branch: "main", behindCount: 3 });
});

test("checkRepo returns null when local matches upstream", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
    if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
    if (key === "ls-remote origin main") return { stdout: "aaa\trefs/heads/main\n", code: 0 };
    return notFound();
  });
  assert.equal(await checkRepo("/repo", runGit), null);
});

test("checkRepo returns null on detached HEAD", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "HEAD\n", code: 0 };
    return notFound();
  });
  assert.equal(await checkRepo("/repo", runGit), null);
});

test("checkRepo returns null when branch has no remote configured", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "feature\n", code: 0 };
    if (key === "config branch.feature.remote") return notFound();
    return notFound();
  });
  assert.equal(await checkRepo("/repo", runGit), null);
});

test("checkRepo returns null when local has diverged from upstream", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
    if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
    if (key === "ls-remote origin main") return { stdout: "bbb\trefs/heads/main\n", code: 0 };
    if (key === "merge-base --is-ancestor aaa bbb") return { stdout: "", code: 1 };
    return notFound();
  });
  assert.equal(await checkRepo("/repo", runGit), null);
});

test("checkRepo returns null when ls-remote returns no matching ref", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
    if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
    if (key === "ls-remote origin main") return { stdout: "", code: 0 };
    return notFound();
  });
  assert.equal(await checkRepo("/repo", runGit), null);
});

test("checkRepo returns null when ls-remote fails (offline / auth)", async () => {
  const { runGit } = createGitRecorder(async (_cwd, args) => {
    const key = args.join(" ");
    if (key === "rev-parse HEAD") return { stdout: "aaa\n", code: 0 };
    if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
    if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
    if (key === "ls-remote origin main") return { stdout: "", code: 128 };
    return notFound();
  });
  assert.equal(await checkRepo("/repo", runGit), null);
});

test("gatherFreshness aggregates only repos that are behind", async () => {
  const symlinkMap: Record<string, string> = {
    [`${EXT_DIR}/a`]: "/repos/a",
    [`${EXT_DIR}/b`]: "/repos/b",
    [`${EXT_DIR}/c`]: "/repos/c",
  };
  const deps: FreshnessDependencies = {
    homeDir: () => HOME,
    listDir: async (dir) => (dir === EXT_DIR ? ["a", "b", "c"] : []),
    realpath: async (p) => symlinkMap[p] ?? p,
    runGit: async (cwd, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --show-toplevel") return { stdout: `${cwd}\n`, code: 0 };
      if (key === "rev-parse HEAD") return { stdout: "local\n", code: 0 };
      if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
      if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
      if (key === "ls-remote origin main") {
        if (cwd === "/repos/a") return { stdout: "remote\trefs/heads/main\n", code: 0 };
        if (cwd === "/repos/b") return { stdout: "local\trefs/heads/main\n", code: 0 }; // current
        if (cwd === "/repos/c") return { stdout: "remote\trefs/heads/main\n", code: 0 };
      }
      if (key === "merge-base --is-ancestor local remote") return { stdout: "", code: 0 };
      if (key === "rev-list --count local..remote") {
        if (cwd === "/repos/a") return { stdout: "2\n", code: 0 };
        if (cwd === "/repos/c") return { stdout: "7\n", code: 0 };
      }
      return notFound();
    },
  };

  const result = await gatherFreshness(deps);
  assert.deepEqual(
    result.map((r) => ({ name: r.name, behindCount: r.behindCount })),
    [
      { name: "a", behindCount: 2 },
      { name: "c", behindCount: 7 },
    ],
  );
});

test("formatAnnouncement aligns names and branches and pluralizes the header", () => {
  const out = formatAnnouncement([
    { root: "/x/pi-extensions", name: "pi-extensions", branch: "main", behindCount: 3 },
    { root: "/x/cli", name: "cli", branch: "release-2.0", behindCount: 12 },
  ]);
  const lines = out.split("\n");
  assert.equal(lines[0], "2 repos behind upstream:");
  assert.equal(lines[1], "");
  assert.equal(lines[2], "  pi-extensions  main         ⇡3");
  assert.equal(lines[3], "  cli            release-2.0  ⇡12");
});

test("formatAnnouncement uses singular header for one repo", () => {
  const out = formatAnnouncement([{ root: "/x/cli", name: "cli", branch: "main", behindCount: 1 }]);
  assert.equal(out.split("\n")[0], "1 repo behind upstream:");
});

// ─── Extension harness tests ─────────────────────────────────────────────────

type Renderer = (message: { content: unknown }, opts: unknown, theme: unknown) => unknown;
type Handler = (event: { reason: string }, ctx: unknown) => void | Promise<void>;
type SentMessage = {
  msg: { customType: string; content: unknown; display?: boolean };
  opts?: unknown;
};

function createPi() {
  const handlers: Record<string, Handler[]> = {};
  const renderers = new Map<string, Renderer>();
  const messages: SentMessage[] = [];
  const pi = {
    on(event: string, handler: Handler) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    registerMessageRenderer(type: string, renderer: Renderer) {
      renderers.set(type, renderer);
    },
    sendMessage(msg: SentMessage["msg"], opts?: unknown) {
      messages.push({ msg, opts });
    },
  };
  return {
    pi: pi as unknown as Parameters<typeof createFreshnessExtension>[0],
    fire: async (event: string, payload: { reason: string }) => {
      for (const h of handlers[event] ?? []) await h(payload, {});
      // Allow the void IIFE inside session_start to settle.
      for (let i = 0; i < 5; i++) await flush();
    },
    messages,
    renderers,
  };
}

function makeListDir(home: string, behindRepoRoots: string[]): FreshnessDependencies {
  // Each root is reached via a single extension symlink under EXT_DIR.
  const ext = path.join(home, ".pi", "agent", "extensions");
  const skills = path.join(home, ".pi", "agent", "skills");
  const symlinks: Record<string, string> = {};
  for (const root of behindRepoRoots) {
    symlinks[path.join(ext, path.basename(root))] = root;
  }
  return {
    homeDir: () => home,
    listDir: async (dir) => {
      if (dir === ext) return behindRepoRoots.map((r) => path.basename(r));
      if (dir === skills) return [];
      return [];
    },
    realpath: async (p) => symlinks[p] ?? p,
    runGit: async (cwd, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --show-toplevel") return { stdout: `${cwd}\n`, code: 0 };
      if (key === "rev-parse HEAD") return { stdout: "local\n", code: 0 };
      if (key === "rev-parse --abbrev-ref HEAD") return { stdout: "main\n", code: 0 };
      if (key === "config branch.main.remote") return { stdout: "origin\n", code: 0 };
      if (key === "ls-remote origin main") return { stdout: "remote\trefs/heads/main\n", code: 0 };
      if (key === "merge-base --is-ancestor local remote") return { stdout: "", code: 0 };
      if (key === "rev-list --count local..remote") return { stdout: "4\n", code: 0 };
      return notFound();
    },
  };
}

test("extension announces on startup when at least one repo is behind", async () => {
  const harness = createPi();
  const deps = makeListDir(HOME, ["/repos/pi-extensions"]);
  createFreshnessExtension(harness.pi, deps);
  await harness.fire("session_start", { reason: "startup" });

  assert.equal(harness.messages.length, 1);
  const sent = harness.messages[0];
  assert.equal(sent.msg.customType, "freshness/announcement");
  assert.match(String(sent.msg.content), /1 repo behind upstream/);
  assert.match(String(sent.msg.content), /pi-extensions/);
  assert.match(String(sent.msg.content), /⇡4/);
  assert.deepEqual(sent.opts, { triggerTurn: false });
  // Structured details for the renderer
  const details = (sent.msg as { details?: { statuses?: unknown[] } }).details;
  assert.ok(details && Array.isArray(details.statuses), "details.statuses should be present");
  assert.equal(details.statuses?.length, 1);
});

test("extension stays silent at startup when PI_OFFLINE is set", async () => {
  const harness = createPi();
  // Use deps that *would* report a behind repo if invoked.
  const deps = makeListDir(HOME, ["/repos/pi-extensions"]);
  createFreshnessExtension(harness.pi, deps);

  const prev = process.env.PI_OFFLINE;
  process.env.PI_OFFLINE = "1";
  try {
    await harness.fire("session_start", { reason: "startup" });
    assert.equal(harness.messages.length, 0);
  } finally {
    if (prev === undefined) delete process.env.PI_OFFLINE;
    else process.env.PI_OFFLINE = prev;
  }
});

test("isOfflineModeEnabled recognizes the same env values pi does", () => {
  const prev = process.env.PI_OFFLINE;
  try {
    for (const v of ["1", "true", "TRUE", "yes", "Yes"]) {
      process.env.PI_OFFLINE = v;
      assert.equal(isOfflineModeEnabled(), true, `expected true for PI_OFFLINE=${v}`);
    }
    for (const v of ["", "0", "false", "no", "nope"]) {
      process.env.PI_OFFLINE = v;
      assert.equal(isOfflineModeEnabled(), false, `expected false for PI_OFFLINE=${v}`);
    }
    delete process.env.PI_OFFLINE;
    assert.equal(isOfflineModeEnabled(), false, "expected false when PI_OFFLINE unset");
  } finally {
    if (prev === undefined) delete process.env.PI_OFFLINE;
    else process.env.PI_OFFLINE = prev;
  }
});

test("extension stays silent when no repos are behind", async () => {
  const harness = createPi();
  const deps: FreshnessDependencies = {
    homeDir: () => HOME,
    listDir: async () => [],
    realpath: async (p) => p,
    runGit: async () => notFound(),
  };
  createFreshnessExtension(harness.pi, deps);
  await harness.fire("session_start", { reason: "startup" });
  assert.equal(harness.messages.length, 0);
});

test("extension ignores session_start reasons other than 'startup'", async () => {
  const harness = createPi();
  const deps = makeListDir(HOME, ["/repos/pi-extensions"]);
  createFreshnessExtension(harness.pi, deps);
  for (const reason of ["resume", "new", "reload", "fork"]) {
    await harness.fire("session_start", { reason });
  }
  assert.equal(harness.messages.length, 0);
});

test("extension registers a renderer for the announcement custom type", async () => {
  const harness = createPi();
  createFreshnessExtension(harness.pi, {
    homeDir: () => HOME,
    listDir: async () => [],
    realpath: async (p) => p,
    runGit: async () => notFound(),
  });
  assert.ok(harness.renderers.has("freshness/announcement"));
});
