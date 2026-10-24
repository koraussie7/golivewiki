/**
 * Load `.env` before anything reads process.env.
 *
 * Why this file exists
 *   DEPLOY-A.md §3 tells the operator to create `/opt/smartglass/app/.env`, and §4
 *   starts the server with `node --import tsx server/src/index.ts`. Nothing in that
 *   command reads the file, so DATABASE_URL, SUPABASE_JWT_SECRET, CORS_ORIGINS and
 *   SMARTGLASS_STREAM_BASE were all undefined. The server then started on MemoryStore
 *   and discarded every task on restart — the single most damaging defect found in
 *   the deployment review.
 *
 * Why not dotenv
 *   Node >= 20.6 has process.loadEnvFile(), which does the same parsing without a
 *   dependency. This project already requires Node 20+ for tsx.
 *
 * Precedence
 *   Process environment WINS over the file. A variable already set (pm2, systemd,
 *   a shell export, a CI runner) is never overwritten by a stale .env on disk. This
 *   matters because .env files drift, and production must be driven by the real
 *   environment the supervisor provided.
 *
 * Safety
 *   - Missing file is not an error: production may supply everything via EnvironmentFile.
 *   - The file path is decided here, never from user input.
 *   - Keys are never logged; only the file name and the count of applied variables.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface EnvLoadResult {
  loaded: boolean;
  /** Path that was read, or the path that was looked for. */
  path: string;
  /** Variables taken from the file (not already present in process.env). */
  applied: string[];
  /** Variables skipped because the environment already defined them. */
  skipped: string[];
  /** Set when the file existed but could not be parsed. */
  error?: string;
}

/**
 * Parse a .env body the way loadEnvFile does, so this module can be tested without
 * touching the filesystem or process.env.
 *
 * Supported: KEY=value, KEY="value", KEY='value', `export KEY=value`, comments,
 * blank lines, and inline `#` after an unquoted value.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();
    const quote = value[0];

    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
      // Only double quotes interpret escapes; single quotes are literal.
      if (quote === '"') {
        value = value.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
    } else {
      // Unquoted: an inline comment starts at " #".
      const hash = value.indexOf(" #");
      if (hash !== -1) value = value.slice(0, hash).trim();
    }

    result[key] = value;
  }

  return result;
}

/**
 * Apply a parsed env to an object, without overwriting keys that already have a value.
 * Exported so tests can exercise the precedence rule directly.
 */
export function applyEnv(
  parsed: Record<string, string>,
  target: Record<string, string | undefined> = process.env,
): { applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    const existing = target[key];
    if (existing !== undefined && existing !== "") {
      skipped.push(key);
      continue;
    }
    target[key] = value;
    applied.push(key);
  }

  return { applied, skipped };
}

/**
 * Load `.env` from the current working directory (or an explicit path).
 *
 * Call this as the very first statement of the entry point, before importing
 * anything that reads configuration at module scope.
 */
export function loadDotEnv(options: { path?: string; quiet?: boolean } = {}): EnvLoadResult {
  const path = options.path ?? resolve(process.cwd(), ".env");

  if (!existsSync(path)) {
    return { loaded: false, path, applied: [], skipped: [] };
  }

  try {
    // Node's own parser is used when available; parseEnvFile is the fallback so the
    // behaviour is identical on older runtimes.
    if (typeof process.loadEnvFile === "function") {
      // loadEnvFile does NOT overwrite existing variables, which is the precedence we
      // want. Track what changed by diffing a snapshot.
      const before = new Set(Object.keys(process.env));
      process.loadEnvFile(path);
      const applied = Object.keys(process.env).filter((k) => !before.has(k));
      const result: EnvLoadResult = { loaded: true, path, applied, skipped: [] };
      if (!options.quiet) report(result);
      return result;
    }

    const parsed = parseEnvFile(readFileSync(path, "utf8"));
    const { applied, skipped } = applyEnv(parsed);

    const result: EnvLoadResult = { loaded: true, path, applied, skipped };
    if (!options.quiet) report(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result: EnvLoadResult = { loaded: false, path, applied: [], skipped: [], error: message };
    if (!options.quiet) {
      console.warn(`[env] failed to load ${path}: ${message}`);
    }
    return result;
  }
}

/** Log the outcome without ever printing a value. */
function report(result: EnvLoadResult): void {
  if (result.applied.length === 0 && result.skipped.length === 0) {
    console.log(`[env] ${result.path} loaded (no variables)`);
    return;
  }
  console.log(
    `[env] ${result.path}: applied ${result.applied.length} variable(s)` +
      (result.skipped.length > 0 ? `, kept ${result.skipped.length} from environment` : ""),
  );
}
