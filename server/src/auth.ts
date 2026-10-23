import { createHmac, createPublicKey, timingSafeEqual, verify as verifySignature, type JsonWebKey, type KeyObject } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Supabase-compatible JWT verification.
 *
 * Hosted Supabase signs user access tokens with the project JWT secret (HS256), so set
 * SUPABASE_JWT_SECRET. Projects on asymmetric signing keys can set SUPABASE_JWKS_URL instead.
 * Client-supplied identity is never trusted: `sub` is the only source of a user id.
 */
export interface AuthenticatedRequest extends Request {
  user?: { id: string; role?: string };
}

interface JwtPayload {
  sub?: string;
  role?: string;
  exp?: number;
  nbf?: number;
  [key: string]: unknown;
}

const decoder = new TextDecoder();

function base64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJwt(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(decoder.decode(base64urlToBuffer(parts[0]))) as Record<string, unknown>;
    const payload = JSON.parse(decoder.decode(base64urlToBuffer(parts[1]))) as JwtPayload;
    return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: base64urlToBuffer(parts[2]) };
  } catch {
    return null;
  }
}

let cachedJwks: { url: string; keys: Map<string, KeyObject>; fetchedAt: number } | null = null;

async function getJwksKeys(url: string): Promise<Map<string, KeyObject>> {
  if (cachedJwks && cachedJwks.url === url && Date.now() - cachedJwks.fetchedAt < 10 * 60_000) return cachedJwks.keys;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: JsonWebKey[] };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys) {
    const kid = jwk.kid;
    if (typeof kid !== "string" || kid.length === 0) continue;
    try { keys.set(kid, createPublicKey({ key: jwk, format: "jwk" })); } catch { /* skip unusable key */ }
  }
  cachedJwks = { url, keys, fetchedAt: Date.now() };
  return keys;
}

async function verifyToken(token: string): Promise<JwtPayload | null> {
  const parsed = parseJwt(token);
  if (!parsed) return null;
  const { header, payload, signingInput, signature } = parsed;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) return null;
  if (!payload.sub) return null;

  const secret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (header.alg === "HS256" && secret) {
    const expected = createHmac("sha256", secret).update(signingInput).digest();
    if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) return null;
    return payload;
  }

  const jwksUrl = process.env.SUPABASE_JWKS_URL?.trim();
  if (jwksUrl && typeof header.kid === "string") {
    const key = (await getJwksKeys(jwksUrl)).get(header.kid);
    if (!key) return null;
    const alg = header.alg === "RS256" ? "RSA-SHA256" : header.alg === "ES256" ? "SHA256" : null;
    if (!alg) return null;
    if (!verifySignature(alg, Buffer.from(signingInput), key, signature)) return null;
    return payload;
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "auth_required" });
  void verifyToken(token)
    .then((payload) => {
      if (!payload?.sub) return res.status(401).json({ error: "invalid_token" });
      req.user = { id: payload.sub, role: payload.role };
      return next();
    })
    .catch(() => res.status(401).json({ error: "invalid_token" }));
}

/** Caller identity. Never read actor/worker identity from the request body. */
export function currentUserId(req: AuthenticatedRequest): string {
  const id = req.user?.id;
  if (!id) throw new Error("currentUserId called without requireAuth");
  return id;
}
