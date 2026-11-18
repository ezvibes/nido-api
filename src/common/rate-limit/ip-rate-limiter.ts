import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';

export interface IpRateLimiterOptions {
  windowMs: number;
  maxAttempts: number;
  message?: string;
  maxTrackedIps?: number;
}

/**
 * Extracts the rightmost proxy-appended client IP from x-forwarded-for (preventing left-side header spoofing behind Cloud Run / GFE), falling back to socket IP.
 */
export function extractClientIp(
  req?: Pick<Request, 'headers' | 'ip' | 'socket'>,
): string {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const rawList = Array.isArray(forwarded)
    ? forwarded
    : typeof forwarded === 'string'
      ? [forwarded]
      : [];
  const entries = rawList
    .flatMap((value) => value.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length > 0) {
    return entries[entries.length - 1]!;
  }
  return req?.ip || req?.socket?.remoteAddress || 'anonymous';
}

/**
 * Bounded-memory sliding-window rate limiter keyed by client IP (or IP + bucket).
 */
export class SlidingWindowIpRateLimiter {
  private readonly attemptsByKey = new Map<string, number[]>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly message: string;
  private readonly maxTrackedIps: number;

  constructor(options: IpRateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxAttempts = options.maxAttempts;
    this.message =
      options.message ?? 'Too many requests. Please try again later.';
    this.maxTrackedIps = options.maxTrackedIps ?? 5000;
  }

  enforce(key: string, now = Date.now()): void {
    const cutoff = now - this.windowMs;
    const recent = (this.attemptsByKey.get(key) ?? []).filter(
      (timestamp) => timestamp > cutoff,
    );

    if (recent.length >= this.maxAttempts) {
      this.attemptsByKey.set(key, recent);
      throw new HttpException(this.message, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (
      !this.attemptsByKey.has(key) &&
      this.attemptsByKey.size >= this.maxTrackedIps
    ) {
      this.pruneExpiredEntries(cutoff);
      if (this.attemptsByKey.size >= this.maxTrackedIps) {
        const oldestKey = this.attemptsByKey.keys().next().value;
        if (oldestKey !== undefined) {
          this.attemptsByKey.delete(oldestKey);
        }
      }
    }

    recent.push(now);
    this.attemptsByKey.set(key, recent);
  }

  reset(): void {
    this.attemptsByKey.clear();
  }

  private pruneExpiredEntries(cutoff: number): void {
    for (const [entryKey, timestamps] of this.attemptsByKey.entries()) {
      const fresh = timestamps.filter((timestamp) => timestamp > cutoff);
      if (fresh.length === 0) {
        this.attemptsByKey.delete(entryKey);
      } else {
        this.attemptsByKey.set(entryKey, fresh);
      }
    }
  }
}
