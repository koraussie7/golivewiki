/**
 * Fail-closed environment validation, enforced at boot.
 *
 * Adapted from different-ai/openwork `packages/evidence-provider/src/provider.ts`
 * (MIT): an unrecognised value is an error, never a silent fallback.
 *
 * The bug this prevents
 *   `index.ts:42` chose the store with a truthiness check:
 *       process.env.DATABASE_URL?.trim() ? new PostgresStore(...) : new MemoryStore()
 *   When .env was not loaded — the exact failure recorded in DEPLOY-A.md — the server
 *   started happily on MemoryStore, logged `(memory)`, and silently discarded every
 *   task on restart. A configuration typo looked like a working deployment.
 *
 * Design
 *   - In production, a missing or invalid required variable aborts the process before
 *     `app.listen`. There is no degraded mode to fall back to.
 *   - Outside production the same checks run but only warn, so local development still
 *     works with a bare `DATABASE_URL` absent.
 *   - Errors are collected and reported together so one boot attempt reveals every
 *     problem, not just the first.
 */

export class EnvError extends Error {
  readonly variable: string;
  constructor(variable: string, message: string) {
    super(`environment variable ${variable}: ${message}`);
    this.name = "EnvError";
    this.variable = variable;
  }
}

export type EnvSource = Record<string, string | undefined>;

/** Non-HTTP-only loopback check used by URL validation. */
export function isLoopback(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function readEnum<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T | undefined,
  env: EnvSource = process.env,
): T {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) {
    if (fallback === undefined) throw new EnvError(name, "is required");
    return fallback;
  }
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new EnvError(name, `must be one of ${allowed.join(", ")} (got "${raw}")`);
  }
  return raw as T;
}

/** Blank counts as missing: an empty DATABASE_URL must not mean "memory mode". */
export function readRequired(name: string, env: EnvSource = process.env): string {
  const raw = env[name]?.trim();
  if (!raw) throw new EnvError(name, "is required and must not be blank");
  return raw;
}

export function readHttpsUrl(
  name: string,
  { allowLoopback = false, env = process.env }: { allowLoopback?: boolean; env?: EnvSource } = {},
): string {
  const raw = readRequired(name, env);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new EnvError(name, `is not a valid URL (got "${raw}")`);
  }
  if (parsed.protocol === "https:") return raw;
  if (allowLoopback && isLoopback(parsed)) return raw;
  throw new EnvError(name, `must use https (got "${parsed.protocol}")`);
}

export type EnvRule =
  | { kind: "required" }
  | { kind: "enum"; allowed: readonly string[]; fallback?: string }
  | { kind: "https"; allowLoopback?: boolean }
  | { kind: "optional" };

export interface EnvSpec {
  [name: string]: EnvRule;
}

export function validateEnvStrict(spec: EnvSpec, env: EnvSource = process.env): Record<string, string | undefined> {
  const errors: string[] = [];
  const result: Record<string, string | undefined> = {};

  for (const [name, rule] of Object.entries(spec)) {
    try {
      switch (rule.kind) {
        case "required":
          result[name] = readRequired(name, env);
          break;
        case "enum":
          result[name] = readEnum(name, rule.allowed, rule.fallback, env);
          break;
        case "https":
          result[name] = readHttpsUrl(name, { allowLoopback: rule.allowLoopback, env });
          break;
        case "optional":
          result[name] = env[name]?.trim() || undefined;
          break;
      }
    } catch (error) {
      errors.push(error instanceof EnvError ? error.message : String(error));
    }
  }

  if (errors.length > 0) {
    throw new EnvError(
      "(multiple)",
      `${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`,
    );
  }
  return result;
}

/**
 * The variables this API cannot run correctly without in production.
 *
 * `PORT` is intentionally absent: it has a working default. `DEMO_MODE` is absent: it
 * does not exist in this codebase and inventing a flag that gates every check would
 * make the checks easy to disable in an emergency, which is when they matter most.
 */
export const PRODUCTION_SPEC: EnvSpec = {
  NODE_ENV: { kind: "enum", allowed: ["development", "test", "production"], fallback: "development" },
  DATABASE_URL: { kind: "required" },
  SUPABASE_JWT_SECRET: { kind: "required" },
  CORS_ORIGINS: { kind: "required" },
  SMARTGLASS_STREAM_BASE: { kind: "https" },
};

export interface BootCheckResult {
  ok: boolean;
  mode: "strict" | "lenient";
  problems: string[];
}

/**
 * Run the boot check.
 *
 * Production: throws on the first boot that cannot work, so pm2 surfaces a crash loop
 *              instead of a healthy-looking process serving an empty in-memory store.
 * Otherwise : returns the problems as warnings and lets the server start.
 */
export function checkBootEnvironment(env: EnvSource = process.env): BootCheckResult {
  const rawNodeEnv = env.NODE_ENV?.trim().toLowerCase();

  // An unrecognised NODE_ENV is the dangerous case: "prod" or "production " typed by
  // hand would otherwise fail the === "production" test and silently run leniently,
  // i.e. a typo would disable every production check. Treat an unknown non-empty value
  // as strict so the mistake surfaces immediately.
  const isKnown = rawNodeEnv === undefined || rawNodeEnv === "" ||
    rawNodeEnv === "development" || rawNodeEnv === "test" || rawNodeEnv === "production";
  if (!isKnown) {
    throw new EnvError(
      "NODE_ENV",
      `must be one of development, test, production (got "${rawNodeEnv}"). ` +
        "An unrecognised value is treated as an error so a typo cannot bypass production checks.",
    );
  }

  const isProduction = rawNodeEnv === "production";

  try {
    validateEnvStrict(PRODUCTION_SPEC, env);
    return { ok: true, mode: isProduction ? "strict" : "lenient", problems: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isProduction) {
      // A production boot with a broken environment is always a bug. Fail loudly.
      throw new EnvError(
        "(boot)",
        `${message}\n\nRefusing to start in production. See DEPLOY-A.md §3 for the required variables.`,
      );
    }

    // Local development: keep the old behaviour available, but say exactly what is wrong.
    const problems = message
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter((line) => line.startsWith("environment variable"));
    return { ok: false, mode: "lenient", problems };
  }
}
