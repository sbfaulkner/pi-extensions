import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

let importCounter = 0;

function which(binary: string): string {
  return execFileSync("which", [binary], { encoding: "utf8" }).trim();
}

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), `pi-extensions-${prefix}-`));
}

async function makePathWithGit(options: { includeGt?: boolean } = {}): Promise<string> {
  const binDir = await makeTempDir("bin");
  await symlink(which("git"), path.join(binDir, "git"));
  await symlink(which("which"), path.join(binDir, "which"));

  if (options.includeGt) {
    await writeFile(path.join(binDir, "gt"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  }

  return binDir;
}

async function makeGitRepo(remoteUrl?: string): Promise<string> {
  const repo = await makeTempDir("repo");
  execFileSync("git", ["init"], { cwd: repo, stdio: "ignore" });
  if (remoteUrl) {
    execFileSync("git", ["remote", "add", "origin", remoteUrl], { cwd: repo, stdio: "ignore" });
  }
  return repo;
}

async function loadModule(agentDir: string, pathValue: string) {
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.PATH = pathValue;
  return import(`./index.ts?test=${Date.now()}-${importCounter++}`);
}

test("git-workflow config round-trips through the configured agent dir", async () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalPath = process.env.PATH;
  const agentDir = await makeTempDir("agent");
  const pathValue = await makePathWithGit();

  try {
    const workflow = await loadModule(agentDir, pathValue);

    assert.deepEqual(workflow.loadConfig(), { graphiteOrgs: [] });

    workflow.saveConfig({ graphiteOrgs: ["Shopify"] });

    assert.deepEqual(workflow.loadConfig(), { graphiteOrgs: ["Shopify"] });
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PATH = originalPath;
  }
});

test("getRemoteOrg extracts GitHub orgs and ignores non-GitHub remotes", async () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalPath = process.env.PATH;
  const agentDir = await makeTempDir("agent");
  const pathValue = await makePathWithGit();

  try {
    const workflow = await loadModule(agentDir, pathValue);
    const httpsRepo = await makeGitRepo("https://github.com/Shopify/shopify.git");
    const sshRepo = await makeGitRepo("git@github.com:sbfaulkner/pi-extensions.git");
    const gitlabRepo = await makeGitRepo("git@gitlab.com:example/project.git");

    assert.equal(workflow.getRemoteOrg(httpsRepo), "shopify");
    assert.equal(workflow.getRemoteOrg(sshRepo), "sbfaulkner");
    assert.equal(workflow.getRemoteOrg(gitlabRepo), undefined);
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PATH = originalPath;
  }
});

test("remote workflow contexts default new PRs to drafts and require explicit readiness", async () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalPath = process.env.PATH;
  const agentDir = await makeTempDir("agent");
  const pathValue = await makePathWithGit();

  try {
    const workflow = await loadModule(agentDir, pathValue);

    assert.match(workflow.GITHUB_CONTEXT, /gh pr create --draft/);
    assert.match(workflow.GITHUB_CONTEXT, /do not mark them ready unless the user explicitly asks/);
    assert.match(workflow.GRAPHITE_CONTEXT, /gt submit --draft/);
    assert.match(workflow.GRAPHITE_CONTEXT, /do not publish them unless the user explicitly asks/);
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PATH = originalPath;
  }
});

test("detectWorkflow distinguishes local, non-GitHub, GitHub, and Graphite workflows", async () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalPath = process.env.PATH;
  const agentDir = await makeTempDir("agent");
  const pathWithoutGt = await makePathWithGit();

  try {
    const workflow = await loadModule(agentDir, pathWithoutGt);
    const localRepo = await makeGitRepo();
    const nonGithubRepo = await makeGitRepo("git@gitlab.com:example/project.git");
    const githubRepo = await makeGitRepo("https://github.com/example/project.git");

    assert.equal(workflow.detectWorkflow(localRepo), "git");
    assert.equal(workflow.detectWorkflow(nonGithubRepo), "remote-git");
    assert.equal(workflow.detectWorkflow(githubRepo), "github");
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PATH = originalPath;
  }

  const graphiteAgentDir = await makeTempDir("agent");
  const pathWithGt = await makePathWithGit({ includeGt: true });

  try {
    const workflow = await loadModule(graphiteAgentDir, pathWithGt);
    const graphiteRepo = await makeGitRepo("https://github.com/Shopify/shopify.git");
    workflow.saveConfig({ graphiteOrgs: ["Shopify"] });

    assert.equal(workflow.detectWorkflow(graphiteRepo), "graphite");
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PATH = originalPath;
  }
});
