import { createHash, timingSafeEqual } from "node:crypto";

// Shared password for the internal panel. Server-only: no public prefix, so
// it can never reach the client bundle. This protects against someone who
// finds the URL, not against someone who already has the password — which is
// proportional to a single-operator workflow, and documented as such.
//
// This module deliberately imports nothing but node builtins. The rest of
// api/roseta/ uses extensionless relative imports, which Vercel's bundler
// resolves but Node's native ESM does not — keeping this file import-free is
// what lets the unit tests load it directly. The request-shaped guard that
// needs the rate limiter lives in _adminGuard.ts.
export const ADMIN_HEADER = "x-roseta-admin";

// Hashing both sides first normalises length, so timingSafeEqual never throws
// on a length mismatch and the comparison leaks nothing through timing.
export function passwordMatches(provided: string, expected: string): boolean {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (!expected) return false; // unset env var must fail closed, never open
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
