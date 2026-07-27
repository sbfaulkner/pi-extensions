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

/** The 66 main entries of https://refactoring.com/catalog/ (verified against the index page's DOM). */
const CATALOG_SLUGS = [
  "change-function-declaration",
  "change-reference-to-value",
  "change-value-to-reference",
  "collapse-hierarchy",
  "combine-functions-into-class",
  "combine-functions-into-transform",
  "consolidate-conditional-expression",
  "decompose-conditional",
  "encapsulate-collection",
  "encapsulate-record",
  "encapsulate-variable",
  "extract-class",
  "extract-function",
  "extract-superclass",
  "extract-variable",
  "hide-delegate",
  "inline-class",
  "inline-function",
  "inline-variable",
  "introduce-assertion",
  "introduce-parameter-object",
  "introduce-special-case",
  "move-field",
  "move-function",
  "move-statements-into-function",
  "move-statements-to-callers",
  "parameterize-function",
  "preserve-whole-object",
  "pull-up-constructor-body",
  "pull-up-field",
  "pull-up-method",
  "push-down-field",
  "push-down-method",
  "remove-dead-code",
  "remove-flag-argument",
  "remove-middle-man",
  "remove-setting-method",
  "remove-subclass",
  "rename-field",
  "rename-variable",
  "replace-command-with-function",
  "replace-conditional-with-polymorphism",
  "replace-constructor-with-factory-function",
  "replace-control-flag-with-break",
  "replace-derived-variable-with-query",
  "replace-error-code-with-exception",
  "replace-exception-with-precheck",
  "replace-function-with-command",
  "replace-inline-code-with-function-call",
  "replace-loop-with-pipeline",
  "replace-magic-literal",
  "replace-nested-conditional-with-guard-clauses",
  "replace-parameter-with-query",
  "replace-primitive-with-object",
  "replace-query-with-parameter",
  "replace-subclass-with-delegate",
  "replace-superclass-with-delegate",
  "replace-temp-with-query",
  "replace-type-code-with-subclasses",
  "return-modified-value",
  "separate-query-from-modifier",
  "slide-statements",
  "split-loop",
  "split-phase",
  "split-variable",
  "substitute-algorithm",
];

/** Refactoring: Ruby Edition entries hosted under /catalog/ but not carded on the index page. */
const RUBY_EDITION_SLUGS = [
  "dynamic-method-definition",
  "eagerly-initialized-attribute",
  "extract-module",
  "extract-surrounding-method",
  "inline-module",
  "introduce-class-annotation",
  "introduce-expression-builder",
  "introduce-gateway",
  "introduce-named-parameter",
  "isolate-dynamic-receptor",
  "recompose-conditional",
  "replace-type-code-with-module-extension",
  "lazily-initialized-attribute",
  "move-eval-from-runtime-to-parse-time",
  "remove-named-parameter",
  "remove-unused-default-parameter",
  "replace-abstract-superclass-with-module",
  "replace-dynamic-receptor-with-dynamic-method-definition",
  "replace-hash-with-object",
  "replace-temp-with-chain",
];
// Aliases covered without separate files: replace-loop-with-collection-closure-method (→
// replace-loop-with-pipeline), replace-type-code-with-polymorphism (→
// replace-type-code-with-subclasses), replace-delegation-with-hierarchy (variant noted in
// replace-delegation-with-inheritance).

/** 1st-edition-only entries hosted under /catalog/ but not carded on the index page. */
const FIRST_EDITION_SLUGS = [
  "change-bidirectional-association-to-unidirectional",
  "change-unidirectional-association-to-bidirectional",
  "duplicate-observed-data",
  "encapsulate-downcast",
  "extract-interface",
  "form-template-method",
  "hide-method",
  "introduce-foreign-method",
  "introduce-local-extension",
  "replace-array-with-object",
  "replace-delegation-with-inheritance",
];

/** Dialect overlay notes under references/dialects/ (not catalog entries). */
const DIALECT_SLUGS = ["ruby", "rust", "sorbet"];

/** Guest-authored entries hosted under /catalog/ but not carded on the index page. */
const GUEST_SLUGS = [
  "reduce-scope-of-variable",
  "remove-double-negative",
  "replace-assignment-with-initialization",
  "replace-conditional-with-visitor",
  "replace-iteration-with-recursion",
  "replace-recursion-with-iteration",
  "reverse-conditional",
];
// Guest entries covered as see-also notes without separate files:
// replace-static-variable-with-parameter (Vittek → noted in replace-query-with-parameter),
// move-class + extract-package (Davison → noted in move-function),
// convert-dynamic-to-static-construction + convert-static-to-dynamic-construction
// (Davison → noted in replace-constructor-with-factory-function).

function referenceSlugs(): string[] {
  return readdirSync(REFERENCES_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
}

/** SKILL.md names reference files by convention: kebab-case of the refactoring name. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function refactoringSkillContent(): string {
  return readFileSync(path.join(REFACTORING_DIR, "SKILL.md"), "utf8");
}

/** Parse the catalog section of the refactoring SKILL.md into (name, slug, tag) entries. */
function catalogEntries(): { name: string; slug: string; tag: string }[] {
  const content = refactoringSkillContent();
  const start = content.indexOf("## Catalog");
  const end = content.indexOf("## How to use");
  assert.ok(start !== -1 && end > start, "SKILL.md catalog section not found");

  const entries: { name: string; slug: string; tag: string }[] = [];
  let tag = "";
  for (const line of content.slice(start, end).split("\n")) {
    const heading = line.match(/^### (.+)$/);
    if (heading) {
      tag = heading[1];
      continue;
    }
    // Entries look like "- Name" or "- Name — *(annotation)*".
    const item = line.match(/^- ([^—*]+?)(?:\s+—.*)?$/);
    if (item) {
      const name = item[1].trim();
      entries.push({ name, slug: slugify(name), tag });
    }
  }
  return entries;
}

/** Parse the smell-table section into the refactoring names it recommends. */
function smellTableNames(): string[] {
  const content = refactoringSkillContent();
  const start = content.indexOf("## Code smell");
  const end = content.indexOf("## Catalog");
  assert.ok(start !== -1 && end > start, "SKILL.md smell table section not found");

  const names: string[] = [];
  for (const line of content.slice(start, end).split("\n")) {
    const row = line.match(/^\| \*\*.+\*\*[^|]* \| (.+) \|$/);
    if (!row) continue;
    names.push(...row[1].split(", ").map((name) => name.trim()));
  }
  return names;
}

test("refactoring: reference files match the expected catalog coverage exactly", () => {
  const expected = [...CATALOG_SLUGS, ...RUBY_EDITION_SLUGS, ...FIRST_EDITION_SLUGS, ...GUEST_SLUGS].sort();
  const actual = referenceSlugs();
  const missing = expected.filter((slug) => !actual.includes(slug));
  const unexpected = actual.filter((slug) => !expected.includes(slug));
  assert.deepEqual(missing, [], `expected reference files are missing: ${missing.join(", ")}`);
  assert.deepEqual(
    unexpected,
    [],
    `unexpected reference files (add deliberately to the fixture): ${unexpected.join(", ")}`,
  );
});

test("refactoring: dialect notes match the expected set and are linked from SKILL.md", () => {
  const dialectsDir = path.join(REFERENCES_DIR, "dialects");
  const actual = readdirSync(dialectsDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  assert.deepEqual(actual, [...DIALECT_SLUGS].sort(), "dialect files do not match the fixture");

  const content = readFileSync(path.join(REFACTORING_DIR, "SKILL.md"), "utf8");
  const unlinked = DIALECT_SLUGS.filter((slug) => !content.includes(`references/dialects/${slug}.md`));
  assert.deepEqual(unlinked, [], `dialect notes not linked from SKILL.md: ${unlinked.join(", ")}`);
});

test("refactoring: catalog lists each reference exactly once, and every name resolves to a file", () => {
  const files = referenceSlugs();
  const seen = new Map<string, number>();
  const unresolved: string[] = [];
  for (const { name, slug } of catalogEntries()) {
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
    if (!files.includes(slug)) unresolved.push(`${name} -> references/${slug}.md`);
  }

  assert.deepEqual(unresolved, [], `catalog names with no reference file:\n${unresolved.join("\n")}`);

  const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
  assert.deepEqual(duplicates, [], `duplicated catalog entries: ${duplicates.join(", ")}`);

  const missing = files.filter((slug) => !seen.has(slug));
  assert.deepEqual(missing, [], `reference files missing from the catalog index: ${missing.join(", ")}`);
});

test("refactoring: every smell-table recommendation resolves to a reference file", () => {
  const files = referenceSlugs();
  const names = smellTableNames();
  assert.ok(names.length > 0, "no smell-table recommendations parsed");
  const unresolved = names.filter((name) => !files.includes(slugify(name)));
  assert.deepEqual(unresolved, [], `smell-table names with no reference file: ${unresolved.join(", ")}`);
});

test("refactoring: each reference file's H1 matches its filename under the slug convention", () => {
  const mismatches: string[] = [];
  for (const slug of referenceSlugs()) {
    const content = readFileSync(path.join(REFERENCES_DIR, `${slug}.md`), "utf8");
    const h1 = content.match(/^# (.+)$/m);
    if (!h1 || slugify(h1[1]) !== slug) {
      mismatches.push(`${slug}.md: H1 "${h1?.[1] ?? "(none)"}" does not slugify to "${slug}"`);
    }
  }
  assert.deepEqual(mismatches, [], `H1/filename mismatches:\n${mismatches.join("\n")}`);
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
  const files = [
    ...referenceSlugs().map((slug) => ({ slug, file: path.join(REFERENCES_DIR, `${slug}.md`) })),
    ...DIALECT_SLUGS.map((slug) => ({
      slug: `dialects/${slug}`,
      file: path.join(REFERENCES_DIR, "dialects", `${slug}.md`),
    })),
  ];
  for (const { slug, file } of files) {
    const blocks = rubyBlocks(readFileSync(file, "utf8"));
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
