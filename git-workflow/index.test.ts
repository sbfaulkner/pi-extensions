import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, symlink } from "node:fs/promises";
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

async function makePathWithGit(): Promise<string> {
  const binDir = await makeTempDir("bin");
  await symlink(which("git"), path.join(binDir, "git"));
  await symlink(which("which"), path.join(binDir, "which"));
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

test("GitHub workflow context defaults new PRs to drafts and require explicit readiness", async () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalPath = process.env.PATH;
  const agentDir = await makeTempDir("agent");
  const pathValue = await makePathWithGit();

  try {
    const workflow = await loadModule(agentDir, pathValue);

    assert.match(workflow.GITHUB_CONTEXT, /gh pr create --draft/);
    assert.match(workflow.GITHUB_CONTEXT, /do not mark them ready unless the user explicitly asks/);
  } finally {
    process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    process.env.PATH = originalPath;
  }
});

test("detectWorkflow distinguishes local, non-GitHub, and GitHub workflows", async () => {
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalPath = process.env.PATH;
  const agentDir = await makeTempDir("agent");
  const pathValue = await makePathWithGit();

  try {
    const workflow = await loadModule(agentDir, pathValue);
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
});
