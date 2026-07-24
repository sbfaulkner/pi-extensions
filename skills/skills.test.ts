import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SKILLS_ROOT = import.meta.dirname;

// --- helpers -----------------------------------------------------------------

function skillDirs(): string[] {
  return readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(SKILLS_ROOT, entry.name))
    .filter((dir) => existsSync(path.join(dir, "SKILL.md")))
    .sort();
}

function markdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(full);
  }
  return files.sort();
}

function parseFrontmatter(content: string): Record<string, string> | undefined {
  if (!content.startsWith("---\n")) return undefined;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return undefined;
  const fields: Record<string, string> = {};
  for (const line of content.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z-]*):\s*(.*)$/);
    if (match) fields[match[1]] = match[2].trim();
  }
  return fields;
}

/** Remove fenced code blocks and inline code spans so their contents are not parsed as markdown. */
function stripCode(markdown: string): string {
  return markdown.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

/** Extract relative link targets from markdown, ignoring external URLs and same-file anchors. */
function relativeLinkTargets(markdown: string): string[] {
  const targets: string[] = [];
  for (const match of stripCode(markdown).matchAll(/\[[^\]]*\]\(([^()\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z+.-]*:/i.test(target)) continue; // http:, https:, mailto:, ...
    if (target.startsWith("#")) continue; // same-file anchor
    targets.push(target.split("#")[0]);
  }
  return targets;
}

function rubyBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```ruby\n([\s\S]*?)```/g)].map((match) => match[1]);
}

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// --- generic checks for every skill -------------------------------------------

test("every skill has valid frontmatter", () => {
  const dirs = skillDirs();
  assert.ok(dirs.length > 0, "no skill directories found");

  for (const dir of dirs) {
    const skillPath = path.join(dir, "SKILL.md");
    const frontmatter = parseFrontmatter(readFileSync(skillPath, "utf8"));
    assert.ok(frontmatter, `${skillPath}: missing frontmatter`);

    const name = frontmatter.name;
    assert.ok(name, `${skillPath}: missing name`);
    assert.ok(name.length <= 64, `${skillPath}: name exceeds 64 chars`);
    assert.match(name, NAME_PATTERN, `${skillPath}: name must be lowercase a-z0-9 with single hyphens`);

    const description = frontmatter.description;
    assert.ok(description, `${skillPath}: missing description (skill would not load)`);
    assert.ok(description.length <= 1024, `${skillPath}: description exceeds 1024 chars (${description.length})`);
  }
});

test("every relative markdown link in every skill resolves to a file", () => {
  const broken: string[] = [];
  for (const dir of skillDirs()) {
    for (const file of markdownFiles(dir)) {
      for (const target of relativeLinkTargets(readFileSync(file, "utf8"))) {
        const resolved = path.resolve(path.dirname(file), target);
        if (!existsSync(resolved)) {
          broken.push(`${path.relative(SKILLS_ROOT, file)} -> ${target}`);
        }
      }
    }
  }
  assert.deepEqual(broken, [], `broken links:\n${broken.join("\n")}`);
});

// --- refactoring skill: catalog consistency ------------------------------------

const REFACTORING_DIR = path.join(SKILLS_ROOT, "refactoring");
const REFERENCES_DIR = path.join(REFACTORING_DIR, "references");

function referenceSlugs(): string[] {
  return readdirSync(REFERENCES_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

/** Parse the catalog section of the refactoring SKILL.md into (slug, tag) entries. */
function catalogEntries(): { slug: string; tag: string }[] {
  const content = readFileSync(path.join(REFACTORING_DIR, "SKILL.md"), "utf8");
  const start = content.indexOf("## Catalog");
  const end = content.indexOf("## How to use");
  assert.ok(start !== -1 && end > start, "SKILL.md catalog section not found");

  const entries: { slug: string; tag: string }[] = [];
  let tag = "";
  for (const line of content.slice(start, end).split("\n")) {
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      tag = heading[1];
      continue;
    }
    for (const match of line.matchAll(/references\/([a-z-]+)\.md/g)) {
      entries.push({ slug: match[1], tag });
    }
  }
  return entries;
}

test("refactoring: every reference file is linked from SKILL.md", () => {
  const content = readFileSync(path.join(REFACTORING_DIR, "SKILL.md"), "utf8");
  const linked = new Set([...content.matchAll(/references\/([a-z-]+)\.md/g)].map((match) => match[1]));
  const orphans = referenceSlugs().filter((slug) => !linked.has(slug));
  assert.deepEqual(orphans, [], `reference files not linked from SKILL.md: ${orphans.join(", ")}`);
});

test("refactoring: catalog lists each reference exactly once", () => {
  const seen = new Map<string, number>();
  for (const { slug } of catalogEntries()) {
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }

  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
  assert.deepEqual(duplicates, [], `duplicated catalog entries: ${duplicates.join(", ")}`);

  const missing = referenceSlugs().filter((slug) => !seen.has(slug));
  assert.deepEqual(missing, [], `reference files missing from the catalog index: ${missing.join(", ")}`);
});

test("refactoring: each reference file's Tag line matches its catalog section", () => {
  const sections = new Map(catalogEntries().map(({ slug, tag }) => [slug, tag]));
  const mismatches: string[] = [];
  for (const slug of referenceSlugs()) {
    const content = readFileSync(path.join(REFERENCES_DIR, `${slug}.md`), "utf8");
    const tagLine = content.match(/^\*\*Tag:\*\* ([a-z-]+)/m);
    if (!tagLine) {
      mismatches.push(`${slug}: missing "**Tag:**" line`);
      continue;
    }
    const section = sections.get(slug);
    if (section !== tagLine[1]) {
      mismatches.push(`${slug}: Tag line says "${tagLine[1]}" but catalog section is "${section}"`);
    }
  }
  assert.deepEqual(mismatches, [], `tag mismatches:\n${mismatches.join("\n")}`);
});

test("refactoring: each reference file has the required sections", () => {
  // Prefix match: files may qualify a heading, e.g. "## Mechanics (simple)".
  const required = ["Motivation", "Mechanics", "Example", "Related"];
  const problems: string[] = [];
  for (const slug of referenceSlugs()) {
    const content = readFileSync(path.join(REFERENCES_DIR, `${slug}.md`), "utf8");
    if (!content.startsWith("# ")) problems.push(`${slug}: missing H1 title`);
    for (const section of required) {
      if (!new RegExp(`^## ${section}\\b`, "m").test(content))
        problems.push(`${slug}: missing "## ${section}" section`);
    }
    if (rubyBlocks(content).length === 0) problems.push(`${slug}: example has no ruby code block`);
  }
  assert.deepEqual(problems, [], `structure problems:\n${problems.join("\n")}`);
});

test("refactoring: all ruby example blocks parse", (t) => {
  const probe = spawnSync("ruby", ["--version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) {
    t.skip("ruby not available");
    return;
  }

  const failures: string[] = [];
  for (const slug of referenceSlugs()) {
    const blocks = rubyBlocks(readFileSync(path.join(REFERENCES_DIR, `${slug}.md`), "utf8"));
    if (blocks.length === 0) continue;
    // Concatenated valid programs still parse, so one ruby -c per file keeps this fast.
    const combined = spawnSync("ruby", ["-c"], { input: blocks.join("\n"), encoding: "utf8" });
    if (combined.status === 0) continue;
    // Re-check block by block for a precise report.
    blocks.forEach((block, index) => {
      const single = spawnSync("ruby", ["-c"], { input: block, encoding: "utf8" });
      if (single.status !== 0) {
        failures.push(`${slug}.md block ${index + 1}: ${single.stderr.trim()}`);
      }
    });
  }
  assert.deepEqual(failures, [], `ruby syntax errors:\n${failures.join("\n")}`);
});
