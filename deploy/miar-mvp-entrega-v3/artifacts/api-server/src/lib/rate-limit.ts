import type { RequestHandler } from 'express';
import { ApiError } from './current-user';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
};

type Bucket = { startedAt: number; count: number };

const buckets = new Map<string, Bucket>();
let requestCounter = 0;

function clientKey(request: Parameters<RequestHandler>[0], name: string) {
  const session = request.cookies?.miar_session;
  const developmentUser = request.header('x-miar-user');
  const address = request.ip || request.socket.remoteAddress || 'unknown';
  return `${name}:${session || developmentUser || address}`;
}

export function rateLimit({ windowMs, max, name }: RateLimitOptions): RequestHandler {
  return (request, response, next) => {
    const now = Date.now();
    const key = clientKey(request, name);
    const current = buckets.get(key);
    const bucket = current && now - current.startedAt < windowMs
      ? current
      : { startedAt: now, count: 0 };
    bucket.count += 1;
    buckets.set(key, bucket);

    if (++requestCounter % 256 === 0) {
      for (const [bucketKey, value] of buckets) {
        if (now - value.startedAt >= windowMs) buckets.delete(bucketKey);
      }
    }

    const remaining = Math.max(0, max - bucket.count);
    response.setHeader('X-RateLimit-Limit', String(max));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.startedAt + windowMs) / 1000)));
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + windowMs - now) / 1000));
      response.setHeader('Retry-After', String(retryAfter));
      next(new ApiError(429, `Too many ${name} requests. Try again later.`));
      return;
    }
    next();
  };
}
