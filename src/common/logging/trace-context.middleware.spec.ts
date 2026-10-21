import { TraceContextMiddleware } from './trace-context.middleware';
import { traceContextStorage } from './trace-context.storage';
import type { Request, Response } from 'express';

describe('TraceContextMiddleware', () => {
  let middleware: TraceContextMiddleware;

  beforeEach(() => {
    middleware = new TraceContextMiddleware();
  });

  it('should parse valid X-Cloud-Trace-Context header and set AsyncLocalStorage context', (done) => {
    const req = {
      headers: {
        'x-cloud-trace-context': '105445aa7843bc8bf206b12000100000/12345;o=1',
      },
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store).toBeDefined();
      expect(store?.traceId).toBe('105445aa7843bc8bf206b12000100000');
      expect(store?.spanId).toBe('12345');
      done();
    });
  });

  it('should parse trace ID without span ID', (done) => {
    const req = {
      headers: {
        'x-cloud-trace-context': 'abcdef1234567890abcdef1234567890',
      },
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store).toBeDefined();
      expect(store?.traceId).toBe('abcdef1234567890abcdef1234567890');
      expect(store?.spanId).toBeUndefined();
      done();
    });
  });

  it('should handle missing header gracefully with empty store', (done) => {
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store).toBeDefined();
      expect(store?.traceId).toBeUndefined();
      expect(store?.spanId).toBeUndefined();
      done();
    });
  });

  it('should parse hexadecimal span IDs from OpenTelemetry/W3C bridges', (done) => {
    const req = {
      headers: {
        'x-cloud-trace-context':
          '105445aa7843bc8bf206b12000100000/000000000000004a;o=1',
      },
    } as unknown as Request;
    const res = {} as Response;

    middleware.use(req, res, () => {
      const store = traceContextStorage.getStore();
      expect(store?.traceId).toBe('105445aa7843bc8bf206b12000100000');
      expect(store?.spanId).toBe('000000000000004a');
      done();
    });
  });

  it('should isolate trace contexts across concurrent asynchronous requests without leaking', async () => {
    const reqA = {
      headers: {
        'x-cloud-trace-context': 'aaaa1111aaaa1111aaaa1111aaaa1111/101;o=1',
      },
    } as unknown as Request;
    const reqB = {
      headers: {
        'x-cloud-trace-context': 'bbbb2222bbbb2222bbbb2222bbbb2222/202;o=1',
      },
    } as unknown as Request;
    const res = {} as Response;

    const runRequest = (req: Request, delayMs: number) =>
      new Promise<{ traceId?: string; spanId?: string }>((resolve) => {
        middleware.use(req, res, () => {
          setTimeout(() => {
            const store = traceContextStorage.getStore();
            resolve({ traceId: store?.traceId, spanId: store?.spanId });
          }, delayMs);
        });
      });

    const [resultA, resultB] = await Promise.all([
      runRequest(reqA, 25),
      runRequest(reqB, 5),
    ]);

    expect(resultA).toEqual({
      traceId: 'aaaa1111aaaa1111aaaa1111aaaa1111',
      spanId: '101',
    });
    expect(resultB).toEqual({
      traceId: 'bbbb2222bbbb2222bbbb2222bbbb2222',
      spanId: '202',
    });
  });
});
