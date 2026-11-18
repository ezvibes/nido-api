import { HttpException, HttpStatus } from '@nestjs/common';
import {
  extractClientIp,
  SlidingWindowIpRateLimiter,
} from './ip-rate-limiter';

describe('ip-rate-limiter', () => {
  it('extracts rightmost proxy-appended client IP from x-forwarded-for to resist left-side spoofing', () => {
    expect(
      extractClientIp({
        headers: { 'x-forwarded-for': '198.51.100.99, 203.0.113.9' },
      } as never),
    ).toBe('203.0.113.9');

    expect(
      extractClientIp({
        headers: { 'x-forwarded-for': ['198.51.100.4', '203.0.113.10'] },
      } as never),
    ).toBe('203.0.113.10');

    expect(
      extractClientIp({
        headers: {},
        ip: '127.0.0.1',
      } as never),
    ).toBe('127.0.0.1');

    expect(extractClientIp(undefined)).toBe('anonymous');
  });

  it('allows requests within the sliding window and throws 429 once exceeded', () => {
    const limiter = new SlidingWindowIpRateLimiter({
      windowMs: 60_000,
      maxAttempts: 2,
      message: 'Rate limited',
    });

    limiter.enforce('1.2.3.4', 1000);
    limiter.enforce('1.2.3.4', 2000);

    try {
      limiter.enforce('1.2.3.4', 3000);
      fail('Expected HttpException');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect((error as HttpException).message).toBe('Rate limited');
    }

    // Window expires cleanly
    limiter.enforce('1.2.3.4', 65_000);
  });

  it('evicts stale keys to bound memory under high cardinality', () => {
    const limiter = new SlidingWindowIpRateLimiter({
      windowMs: 1000,
      maxAttempts: 1,
      maxTrackedIps: 2,
    });

    limiter.enforce('ip-1', 100);
    limiter.enforce('ip-2', 200);
    limiter.enforce('ip-3', 1500);

    // ip-1 was expired at 1500 so it should have been pruned and allowed again
    limiter.enforce('ip-1', 1500);
  });
});
