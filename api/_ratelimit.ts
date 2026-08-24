// api/_ratelimit.ts
import type { VercelRequest } from "@vercel/node";

// Simple in-memory sliding-window rate limit — same pattern as
// api/roseta/_ratelimit.ts, duplicated here rather than imported across
// directories (each api/ subtree in this repo keeps its own colocated
// copies of small stateless helpers, so touching one flow never risks
// another). Persists across warm invocations, resets on cold start; good
// enough for a low-traffic public form, not meant to survive a distributed
// serverless fleet at scale.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = (hits.get(key) || []).filter((ts) => ts > windowStart);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) hits.clear(); // guard against unbounded growth
  return recent.length > max;
}

export function getClientKey(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  const ip = Array.isArray(fwd) ? fwd[0] : (fwd || "").split(",")[0].trim();
  return ip || req.socket?.remoteAddress || "unknown";
}
