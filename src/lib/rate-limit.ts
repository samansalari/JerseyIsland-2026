import Redis from "ioredis";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const redisGlobal = globalThis as unknown as {
  __votepulseRedis?: Redis | null;
};

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (redisGlobal.__votepulseRedis) return redisGlobal.__votepulseRedis;

  const client = new Redis(process.env.REDIS_URL, {
    family: 0, // dual-stack IPv4+IPv6 — required for Railway
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  redisGlobal.__votepulseRedis = client;
  return client;
}

function getClientIp(req: NextRequest): string {
  const fromReq =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip");
  if (fromReq) return fromReq;
  return "unknown";
}

export async function checkRateLimit(
  req: NextRequest,
  limit = 20,
  windowSecs = 10,
): Promise<{ success: boolean; response?: NextResponse }> {
  const client = getRedis();
  if (!client) return { success: true };

  const h = await headers();
  let ip = getClientIp(req);
  if (ip === "unknown") {
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown";
  }

  const key = `votepulse:rl:${ip}`;
  const now = Date.now();
  const windowMs = windowSecs * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  try {
    // Sliding window: drop entries outside the window, count, add only if under limit
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(key, 0, now - windowMs);
    pipeline.zcard(key);

    const results = await pipeline.exec();
    const err0 = results?.[0]?.[0];
    const err1 = results?.[1]?.[0];
    if (err0 || err1) {
      console.warn("[rate-limit] Redis pipeline error:", err0 ?? err1);
      return { success: true };
    }

    const count = Number(results?.[1]?.[1] ?? 0);
    if (count >= limit) {
      return {
        success: false,
        response: NextResponse.json(
          { error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: { "Retry-After": String(windowSecs) },
          },
        ),
      };
    }

    await client
      .pipeline()
      .zadd(key, now, member)
      .pexpire(key, windowMs)
      .exec();
  } catch (e) {
    console.warn("[rate-limit] Redis error:", e);
    return { success: true };
  }

  return { success: true };
}
