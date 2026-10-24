/**
 * Tests for boot-time environment validation.
 *
 * Run: node --test server/src/env.test.ts   (after `pnpm --filter @golive/server typecheck`)
 * or  npx tsx --test server/src/env.test.ts
 *
 * The property under test: a production process never reaches app.listen with an
 * environment that would silently put it on MemoryStore.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkBootEnvironment,
  validateEnvStrict,
  readEnum,
  readRequired,
  readHttpsUrl,
  isLoopback,
  EnvError,
  PRODUCTION_SPEC,
} from "./env.js";

const GOOD = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://postgres:pw@db.example.supabase.co:6543/postgres",
  SUPABASE_JWT_SECRET: "x".repeat(40),
  CORS_ORIGINS: "https://golive.wiki",
  SMARTGLASS_STREAM_BASE: "https://stream.golive.wiki",
};

test("production boot succeeds with every required variable present", () => {
  const result = checkBootEnvironment(GOOD);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "strict");
  assert.deepEqual(result.problems, []);
});

test("production boot refuses to start without DATABASE_URL", () => {
  const { DATABASE_URL, ...withoutDb } = GOOD;
  assert.throws(
    () => checkBootEnvironment(withoutDb),
    (err: unknown) => {
      assert.ok(err instanceof EnvError);
      assert.match((err as EnvError).message, /DATABASE_URL/);
      assert.match((err as EnvError).message, /Refusing to start in production/);
      return true;
    },
    "a missing DATABASE_URL in production must not fall back to MemoryStore",
  );
});

test("a blank DATABASE_URL counts as missing", () => {
  assert.throws(
    () => checkBootEnvironment({ ...GOOD, DATABASE_URL: "   " }),
    (err: unknown) => err instanceof EnvError && /DATABASE_URL/.test((err as EnvError).message),
  );
});

test("an http stream base is rejected in production", () => {
  assert.throws(
    () => checkBootEnvironment({ ...GOOD, SMARTGLASS_STREAM_BASE: "http://stream.golive.wiki" }),
    (err: unknown) => err instanceof EnvError && /https/.test((err as EnvError).message),
  );
});

test("loopback is allowed only when the rule says so", () => {
  assert.equal(
    readHttpsUrl("U", { allowLoopback: true, env: { U: "http://127.0.0.1:8787" } }),
    "http://127.0.0.1:8787",
  );
  assert.throws(() => readHttpsUrl("U", { env: { U: "http://127.0.0.1:8787" } }));
});

test("a hostname that merely looks local is not loopback", () => {
  assert.equal(isLoopback(new URL("http://localhost")), true);
  assert.equal(isLoopback(new URL("http://127.0.0.1")), true);
  assert.equal(isLoopback(new URL("http://[::1]")), true);
  assert.equal(isLoopback(new URL("http://localhost.evil.test")), false);
  assert.equal(isLoopback(new URL("http://127.0.0.1.evil.test")), false);
});

test("an unknown NODE_ENV value is rejected, not coerced", () => {
  assert.throws(
    () => checkBootEnvironment({ ...GOOD, NODE_ENV: "prod" }),
    (err: unknown) => err instanceof EnvError && /NODE_ENV/.test((err as EnvError).message),
  );
});

test("development boots and reports problems instead of throwing", () => {
  const result = checkBootEnvironment({ NODE_ENV: "development" });
  assert.equal(result.ok, false);
  assert.equal(result.mode, "lenient");
  assert.ok(result.problems.length >= 3, `expected several problems, got ${result.problems.length}`);
  assert.ok(result.problems.some((p) => p.includes("DATABASE_URL")));
});

test("validateEnvStrict reports every problem at once", () => {
  assert.throws(
    () =>
      validateEnvStrict(
        {
          NODE_ENV: { kind: "enum", allowed: ["development", "production"] },
          DATABASE_URL: { kind: "required" },
          SMARTGLASS_STREAM_BASE: { kind: "https" },
        },
        { NODE_ENV: "zzz", SMARTGLASS_STREAM_BASE: "http://x" },
      ),
    (err: unknown) => {
      assert.ok(err instanceof EnvError);
      // 3 variables, 3 problems: one message, not one-at-a-time restarts.
      assert.match((err as EnvError).message, /3 problem/);
      return true;
    },
  );
});

test("readEnum falls back only when the variable is absent or blank", () => {
  assert.equal(readEnum("MODE", ["memory", "postgres"], "memory", {}), "memory");
  assert.equal(readEnum("MODE", ["memory", "postgres"], "memory", { MODE: "  " }), "memory");
  assert.equal(readEnum("MODE", ["memory", "postgres"], "memory", { MODE: "POSTGRES" }), "postgres");
  assert.throws(() => readEnum("MODE", ["memory", "postgres"], "memory", { MODE: "postgresql" }));
});

test("readRequired rejects unset, blank and whitespace-only values", () => {
  for (const env of [{}, { X: "" }, { X: "   " }, { X: "\n\t" }]) {
    assert.throws(() => readRequired("X", env), (e: unknown) => e instanceof EnvError);
  }
  assert.equal(readRequired("X", { X: " value " }), "value");
});

test("PRODUCTION_SPEC covers the variables DEPLOY-A.md documents", () => {
  // Guard against the spec silently drifting away from the deployment guide.
  for (const name of ["DATABASE_URL", "SUPABASE_JWT_SECRET", "CORS_ORIGINS", "SMARTGLASS_STREAM_BASE"]) {
    assert.ok(name in PRODUCTION_SPEC, `${name} missing from PRODUCTION_SPEC`);
  }
});
