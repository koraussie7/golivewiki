/**
 * Tests for the .env loader.
 *
 * Run: npx tsx --test server/src/load-env.test.ts
 *
 * The property under test: a value already present in the process environment is NEVER
 * overwritten by the file, and a missing file is not an error.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnvFile, applyEnv } from "./load-env.js";

test("parses plain KEY=value lines", () => {
  const parsed = parseEnvFile("A=1\nB=two\n");
  assert.deepEqual(parsed, { A: "1", B: "two" });
});

test("ignores comments and blank lines", () => {
  const parsed = parseEnvFile("# comment\nA=1\n   # indented comment\nB=2\n");
  assert.deepEqual(parsed, { A: "1", B: "2" });
});

test("strips double and single quotes", () => {
  const parsed = parseEnvFile('A="quoted value"\nB=\'literal $x\'\n');
  assert.equal(parsed.A, "quoted value");
  assert.equal(parsed.B, "literal $x", "single quotes must not expand variables");
});

test("interprets escapes only inside double quotes", () => {
  const parsed = parseEnvFile('A="line1\\nline2"\nB=\'line1\\nline2\'\n');
  assert.equal(parsed.A, "line1\nline2");
  assert.equal(parsed.B, "line1\\nline2");
});

test("supports the export prefix", () => {
  const parsed = parseEnvFile("export DATABASE_URL=postgres://x\n");
  assert.equal(parsed.DATABASE_URL, "postgres://x");
});

test("strips an inline comment from an unquoted value", () => {
  const parsed = parseEnvFile("A=value # not part of the value\n");
  assert.equal(parsed.A, "value");
});

test("keeps '#' inside a quoted value", () => {
  const parsed = parseEnvFile('A="value # kept"\n');
  assert.equal(parsed.A, "value # kept");
});

test("accepts values containing '=' (connection strings)", () => {
  const parsed = parseEnvFile("DATABASE_URL=postgresql://u:p@h:6543/db?sslmode=require&x=1\n");
  assert.equal(parsed.DATABASE_URL, "postgresql://u:p@h:6543/db?sslmode=require&x=1");
});

test("skips lines with an invalid key", () => {
  const parsed = parseEnvFile("1BAD=x\nGOOD=y\n=orphan\n");
  assert.deepEqual(parsed, { GOOD: "y" });
});

test("applyEnv never overwrites an existing value", () => {
  const target: Record<string, string | undefined> = {
    DATABASE_URL: "from-supervisor",
    EMPTY: "",
  };
  const { applied, skipped } = applyEnv({ DATABASE_URL: "from-file", EMPTY: "from-file", NEW: "from-file" }, target);

  assert.equal(target.DATABASE_URL, "from-supervisor", "supervisor value must win");
  assert.equal(target.NEW, "from-file");
  assert.equal(target.EMPTY, "from-file", "a blank value is treated as unset, so the file fills it");
  assert.deepEqual(applied.sort(), ["EMPTY", "NEW"]);
  assert.deepEqual(skipped, ["DATABASE_URL"]);
});

test("applyEnv does not leak values in its return shape", () => {
  const target: Record<string, string | undefined> = {};
  const result = applyEnv({ SECRET: "hunter2" }, target);
  // The returned lists must contain names only; the secret lives on the target object.
  assert.deepEqual(result.applied, ["SECRET"]);
  assert.equal(JSON.stringify(result).includes("hunter2"), false);
});
