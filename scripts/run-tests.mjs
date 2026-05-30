#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([".git", "node_modules"]);
const NODE_TEST_FLAGS = [
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  "--test",
];

function isTestFile(filePath) {
  return filePath.endsWith(".test.ts");
}

function relative(filePath) {
  return path.relative(ROOT, filePath) || ".";
}

function findTestFiles(dir) {
  const tests = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        tests.push(...findTestFiles(path.join(dir, entry.name)));
      }
      continue;
    }

    if (entry.isFile() && isTestFile(entry.name)) {
      tests.push(path.join(dir, entry.name));
    }
  }

  return tests;
}

function resolveTarget(rawTarget) {
  const target = rawTarget.replace(/\/$/, "");
  const absolute = path.resolve(ROOT, target);

  if (existsSync(absolute)) {
    const stats = statSync(absolute);
    if (stats.isDirectory()) return findTestFiles(absolute);
    if (stats.isFile() && isTestFile(absolute)) return [absolute];
    throw new Error(`Target is not a test file or directory: ${rawTarget}`);
  }

  const indexTest = path.join(ROOT, target, "index.test.ts");
  if (existsSync(indexTest)) return [indexTest];

  const suffixedTest = path.join(ROOT, `${target}.test.ts`);
  if (existsSync(suffixedTest)) return [suffixedTest];

  throw new Error(`No test files found for target: ${rawTarget}`);
}

function uniqueSorted(filePaths) {
  return [...new Set(filePaths.map((filePath) => path.resolve(filePath)))].sort((a, b) =>
    relative(a).localeCompare(relative(b)),
  );
}

function main() {
  const targets = process.argv.slice(2);
  let testFiles;

  try {
    testFiles = uniqueSorted(targets.length === 0 ? findTestFiles(ROOT) : targets.flatMap(resolveTarget));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (testFiles.length === 0) {
    console.error(targets.length === 0 ? "No test files found." : `No test files found for: ${targets.join(", ")}`);
    process.exit(1);
  }

  const result = spawnSync(process.execPath, [...NODE_TEST_FLAGS, ...testFiles.map(relative)], { stdio: "inherit" });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
